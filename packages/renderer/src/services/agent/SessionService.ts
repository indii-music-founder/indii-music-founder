/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */

import { FirestoreService } from '../FirestoreService';
import { SessionPersistenceConflict } from './SessionPersistenceConflict';
import type { ConversationSession, AgentMessage } from '@/core/store/slices/agent'; // Direct import to avoid circular dep risks? Or from index?
import { OrganizationService } from '../OrganizationService';
import { auth } from '../firebase';
import { where, orderBy, limit, Timestamp, onSnapshot, collection, query, Unsubscribe, startAfter, getDocs, QueryConstraint, documentId, doc, serverTimestamp, writeBatch, runTransaction, getDocFromServer, getDocsFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '@/services/utils/firebase';
import { logger } from '@/utils/logger';
import { toMillisSafe } from '@/utils/timestamps';
import { platformBridge } from '../platform/PlatformBridgeService';
import { storeSessionAttachments, loadSessionAttachment, type StoredSessionAttachment } from './SessionAttachmentStorage';

// Define the Firestore document shape (handling timestamps)
interface SessionDocument extends Omit<ConversationSession, 'createdAt' | 'updatedAt'> {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    userId: string;
    orgId: string;
    messageEpoch?: number;
    clearingOperation?: string | null;
    lastClearedOperation?: string | null;
}

function messageEpoch(data: { messageEpoch?: unknown }): number {
    const epoch = data.messageEpoch ?? 0;
    if (!Number.isSafeInteger(epoch) || (epoch as number) < 0) throw new Error('Invalid conversation message generation.');
    return epoch as number;
}

function activeMessageEpoch(data: { messageEpoch?: unknown; deletingAt?: unknown; clearingOperation?: unknown }): number {
    if (data.deletingAt != null) throw new SessionPersistenceConflict('Cannot write a message while this conversation is being deleted.');
    if (data.clearingOperation != null) throw new SessionPersistenceConflict('Cannot write a message while this conversation is being cleared.');
    return messageEpoch(data);
}

/** Compound pagination cursor: (updatedAt, id) tiebreak avoids skipping same-millisecond docs. */
export interface SessionPageCursor {
    updatedAt: number;
    id: string;
}

function sameAttachments(saved: unknown, stored: StoredSessionAttachment[] | undefined, original: AgentMessage['attachments']): boolean {
    if (saved == null) return !stored?.length;
    if (!Array.isArray(saved) || saved.length !== (stored?.length ?? 0)) return false;
    return saved.every((item, index) => {
        if (!item || typeof item !== 'object') return false;
        const uploaded = stored?.[index];
        const source = original?.[index];
        if (typeof item.storagePath === 'string') {
            return item.storagePath === uploaded?.storagePath && item.mimeType === uploaded.mimeType && (item.filename ?? '') === (uploaded.filename ?? '');
        }
        return typeof item.base64 === 'string' && item.base64 === source?.base64 && item.mimeType === source.mimeType && (item.filename ?? '') === (source.filename ?? '');
    });
}

class SessionServiceImpl extends FirestoreService<SessionDocument> {
    private readonly clearEpochs = new WeakMap<object, number>();
    private readonly appendEpochs = new WeakMap<AgentMessage, Map<string, number>>();
    private readonly localDeletionFences = new Set<string>();
    private readonly localWrites = new Map<string, Set<Promise<void>>>();

    constructor() {
        super('sessions');
    }

    async createSession(session: ConversationSession): Promise<string> {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid;
        if (!userId) {
            throw new Error('User must be authenticated to create an agent session.');
        }

        const doc: SessionDocument = {
            ...session,
            createdAt: Timestamp.fromMillis(session.createdAt),
            updatedAt: Timestamp.fromMillis(session.updatedAt),
            userId,
            orgId
        };

        // We use set since we already generated an ID in the store
        await this.set(session.id, cleanFirestoreData(doc));

        // KEEPER: Dual Write for Electron Local Persistence
        this.saveToLocal(session.id, session);

        return session.id;
    }

    async updateSession(id: string, updates: Partial<ConversationSession>): Promise<void> {
        const firestoreUpdates: any = { ...updates };
        if (updates.updatedAt) {
            firestoreUpdates.updatedAt = Timestamp.fromMillis(updates.updatedAt);
        }
        // createdAt should not be updated usually, but if so:
        if (updates.createdAt) {
            // careful not to overwrite
            delete firestoreUpdates.createdAt;
        }

        await this.update(id, cleanFirestoreData(firestoreUpdates));

        // KEEPER: Dual Write for Electron Local Persistence
        this.saveToLocal(id, updates);
    }

    /**
     * Messages are append-only child documents. Updating a parent `messages`
     * array caused simultaneous desktop and phone writes to erase each other.
     */
    async appendMessage(sessionId: string, message: AgentMessage): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated to append a session message.');
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const sessionRef = doc(db, 'sessions', sessionId);
        const messageRef = doc(db, 'sessions', sessionId, 'messages', message.id);
        // Capture before uploads: a clear on another device must invalidate this
        // in-flight append even when clearing finishes before its commit.
        const beforeUpload = await getDocFromServer(sessionRef);
        if (!beforeUpload.exists()) throw new Error(`Session '${sessionId}' no longer exists.`);
        const liveEpoch = activeMessageEpoch(beforeUpload.data());
        const scope = `${userId}/${sessionId}`;
        const epochs = this.appendEpochs.get(message) ?? new Map<string, number>();
        const expectedEpoch = epochs.get(scope) ?? liveEpoch;
        if (expectedEpoch !== liveEpoch) throw new SessionPersistenceConflict('Conversation was cleared before this message could be retried.');
        epochs.set(scope, expectedEpoch);
        this.appendEpochs.set(message, epochs);
        // Preserve the original in-memory message for recovery if upload or commit fails.
        const attachments = message.attachments?.length
            ? await storeSessionAttachments(userId, sessionId, message.id, message.attachments)
            : undefined;
        await runTransaction(db, async transaction => {
            const current = await transaction.get(sessionRef);
            if (!current.exists()) throw new Error(`Session '${sessionId}' no longer exists.`);
            const data = current.data() as SessionDocument;
            if (activeMessageEpoch(data) !== expectedEpoch) throw new SessionPersistenceConflict('Conversation was cleared while this message was being saved.');
            const existingMessage = await transaction.get(messageRef);
            // A retried append must never replace a message already committed
            // by this or another client, including its attachment references.
            if (existingMessage.exists()) {
                const saved = existingMessage.data();
                if (saved.role !== message.role ||
                    (message.role === 'user' && saved.text !== message.text) ||
                    !sameAttachments(saved.attachments, attachments, message.attachments)) {
                    throw new Error('Message ID is already in use for a different message or attachment.');
                }
                return;
            }

            // One atomic, idempotent bridge for existing array-backed sessions.
            // Concurrent phone/desktop appends retry the transaction, so both
            // messages plus the legacy history survive the format transition.
            if (data.messageStorage !== 'subcollection') {
                // A legacy message may not have a child document yet. Never
                // overwrite it with a new append that happens to reuse its ID.
                if ((data.messages || []).some(legacyMessage => legacyMessage.id === message.id)) {
                    throw new Error('Message ID is already in use by legacy conversation history.');
                }
                for (const legacyMessage of data.messages || []) {
                    transaction.set(doc(db, 'sessions', sessionId, 'messages', legacyMessage.id), cleanFirestoreData({
                        ...legacyMessage,
                        messageEpoch: expectedEpoch,
                        userId,
                        orgId,
                        createdAt: serverTimestamp(),
                    }));
                }
            }
            transaction.set(messageRef, cleanFirestoreData({
                ...message,
                messageEpoch: expectedEpoch,
                attachments,
                userId,
                orgId,
                createdAt: serverTimestamp(),
            }));
            transaction.update(sessionRef, {
                updatedAt: serverTimestamp(),
                messageStorage: 'subcollection',
                ...(data.messageStorage !== 'subcollection' ? { messages: [] } : {}),
            });
        });
    }

    async updateMessage(sessionId: string, messageId: string, updates: Partial<AgentMessage>): Promise<void> {
        const sessionRef = doc(db, 'sessions', sessionId);
        const initial = await getDocFromServer(sessionRef);
        if (!initial.exists()) throw new Error(`Session '${sessionId}' no longer exists.`);
        const expectedEpoch = activeMessageEpoch(initial.data());
        const firestoreUpdates: Record<string, unknown> = { ...updates };
        if (updates.attachments !== undefined) {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User must be authenticated to update message attachments.');
            if (updates.attachments.some(attachment => attachment.loadFailed)) throw new Error('Cannot save an attachment that could not be loaded.');
            firestoreUpdates.attachments = await storeSessionAttachments(userId, sessionId, messageId, updates.attachments);
        }
        const messageRef = doc(db, 'sessions', sessionId, 'messages', messageId);
        await runTransaction(db, async transaction => {
            const parent = await transaction.get(sessionRef);
            if (!parent.exists() || activeMessageEpoch(parent.data()) !== expectedEpoch) throw new SessionPersistenceConflict('Conversation changed while this message was being saved.');
            const current = await transaction.get(messageRef);
            if (!current.exists() || messageEpoch(current.data()) !== expectedEpoch) throw new SessionPersistenceConflict('Message no longer belongs to the current conversation generation.');
            transaction.update(messageRef, cleanFirestoreData({ ...firestoreUpdates, messageEpoch: expectedEpoch }));
            transaction.update(sessionRef, { updatedAt: serverTimestamp(), messageStorage: 'subcollection' });
        });
    }

    async clearMessages(sessionId: string, operation: { id: string } = { id: crypto.randomUUID() }): Promise<void> {
        const operationId = operation.id;
        if (!operationId || operationId.length > 128) throw new Error('Invalid clear operation identifier.');
        const sessionRef = doc(db, 'sessions', sessionId);
        const epoch = await runTransaction(db, async transaction => {
            const current = await transaction.get(sessionRef);
            if (!current.exists()) throw new Error(`Session '${sessionId}' no longer exists.`);
            const data = current.data();
            if (data.lastClearedOperation === operationId) return null;
            const currentEpoch = messageEpoch(data);
            const startingEpoch = this.clearEpochs.get(operation) ?? currentEpoch;
            this.clearEpochs.set(operation, startingEpoch);
            if (currentEpoch !== startingEpoch && !(data.clearingOperation === operationId && currentEpoch === startingEpoch + 1)) {
                throw new SessionPersistenceConflict('Conversation clear was superseded. No further messages were deleted.');
            }
            if (data.deletingAt != null) throw new SessionPersistenceConflict('Cannot clear a conversation being deleted.');
            if (data.clearingOperation === operationId) return messageEpoch(data);
            const nextEpoch = messageEpoch(data) + 1;
            if (!Number.isSafeInteger(nextEpoch)) throw new Error('Conversation message generation is exhausted.');
            // A fresh clear explicitly takes over an interrupted clear. Older clear
            // workers verify this token before every batch and cannot delete new work.
            transaction.update(sessionRef, { messageEpoch: nextEpoch, clearingOperation: operationId,
                updatedAt: serverTimestamp(), messageStorage: 'subcollection', messages: [] });
            return nextEpoch;
        });
        if (epoch === null) return;
        while (true) {
            const snapshot = await getDocsFromServer(query(collection(db, 'sessions', sessionId, 'messages'), limit(400)));
            await runTransaction(db, async transaction => {
                const current = await transaction.get(sessionRef);
                if (!current.exists() || current.data().clearingOperation !== operationId || messageEpoch(current.data()) !== epoch) {
                    throw new SessionPersistenceConflict('Conversation clear was superseded. No further messages were deleted.');
                }
                if (snapshot.empty) {
                    transaction.update(sessionRef, { clearingOperation: null, lastClearedOperation: operationId, updatedAt: serverTimestamp() });
                } else {
                    snapshot.docs.forEach(message => transaction.delete(message.ref));
                }
            });
            if (snapshot.empty) return;
        }
    }

    subscribeToMessages(
        sessionId: string,
        onUpdate: (messages: AgentMessage[]) => void,
        onError: (error: Error) => void,
    ): Unsubscribe {
        const q = query(collection(db, 'sessions', sessionId, 'messages'), orderBy('timestamp', 'asc'));
        let revision = 0;
        let active = true;
        const attachmentCache = new Map<string, Promise<{ mimeType: string; base64: string; filename?: string }>>();
        const unsubscribe = onSnapshot(q, snapshot => {
            const current = ++revision;
            const userId = auth.currentUser?.uid;
            const usedAttachments = new Set<string>();
            void Promise.all(snapshot.docs.map(async message => {
                const { userId: _userId, orgId: _orgId, createdAt: _createdAt, ...data } = message.data();
                const attachments = data.attachments;
                if (Array.isArray(attachments)) {
                    if (!userId) throw new Error('Sign in to restore message attachments.');
                    const restored = await Promise.all(attachments.map(async (attachment: unknown, index: number) => {
                        if (!attachment || typeof attachment !== 'object') {
                            return { mimeType: 'application/octet-stream', base64: '', loadFailed: true };
                        }
                        const value = attachment as Partial<StoredSessionAttachment & { base64: string }>;
                        const mimeType = typeof value.mimeType === 'string' ? value.mimeType : 'application/octet-stream';
                        const filename = typeof value.filename === 'string' ? value.filename : undefined;
                        if (typeof value.storagePath !== 'string') {
                            return typeof value.base64 === 'string' && value.base64
                                ? { mimeType, base64: value.base64, ...(filename ? { filename } : {}) }
                                : { mimeType, base64: '', loadFailed: true };
                        }
                        try {
                            const key = JSON.stringify([userId, message.id, index, mimeType, value.storagePath, filename]);
                            usedAttachments.add(key);
                            let pending = attachmentCache.get(key);
                            if (!pending) {
                                pending = loadSessionAttachment(userId, sessionId, message.id, index, { mimeType, storagePath: value.storagePath, ...(filename ? { filename } : {}) });
                                attachmentCache.set(key, pending);
                            }
                            try {
                                return await pending;
                            } catch (error) {
                                if (attachmentCache.get(key) === pending) attachmentCache.delete(key);
                                throw error;
                            }
                        } catch {
                            return { mimeType, base64: '', loadFailed: true };
                        }
                    }));
                    return { ...data, id: message.id, attachments: restored } as AgentMessage;
                }
                if (attachments != null) {
                    return { ...data, id: message.id, attachments: [{
                        mimeType: 'application/octet-stream', base64: '', loadFailed: true,
                    }] } as AgentMessage;
                }
                return { ...data, id: message.id } as AgentMessage;
            })).then(messages => {
                if (active && current === revision && auth.currentUser?.uid === userId) {
                    for (const key of attachmentCache.keys()) if (!usedAttachments.has(key)) attachmentCache.delete(key);
                    onUpdate(messages);
                }
            }).catch(error => {
                if (active && current === revision && auth.currentUser?.uid === userId) onError(error instanceof Error ? error : new Error('Could not restore message attachments.'));
            });
        }, onError);
        return () => { active = false; revision++; attachmentCache.clear(); unsubscribe(); };
    }

    async deleteSession(id: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated to delete an agent session.');
        const sessionRef = doc(db, 'sessions', id);
        const messagesRef = collection(db, 'sessions', id, 'messages');

        // Prevent late saves and scheduled retries from recreating the cache.
        // Wait for writes already in flight before removing it.
        this.localDeletionFences.add(id);
        await Promise.all(Array.from(this.localWrites.get(id) ?? []));

        // Remove the local cache first so a local failure leaves the cloud copy
        // available for retry. Cloud deletion cannot be retried after its parent
        // is gone because ownership rules require that parent to exist.
        try {
            await platformBridge.deleteHistory(id);
        } catch (error) {
            // The cloud conversation is still active; allow future local saves.
            this.localDeletionFences.delete(id);
            throw error;
        }

        // Preserve an existing fence on retry: the security rules intentionally
        // reject changing or clearing it once deletion has started.
        await runTransaction(db, async transaction => {
            const current = await transaction.get(sessionRef);
            if (!current.exists()) throw new Error(`Session '${id}' no longer exists.`);
            if (current.data().deletingAt == null) {
                transaction.update(sessionRef, { deletingAt: serverTimestamp() });
            }
        });
        while (true) {
            const snapshot = await getDocs(query(messagesRef, limit(400)));
            if (snapshot.empty) break;
            const batch = writeBatch(db);
            snapshot.docs.forEach(message => batch.delete(message.ref));
            await batch.commit();
        }
        await this.delete(id);

    }

    private saveToLocal(id: string, data: any, attempt = 1) {
        if (this.localDeletionFences.has(id)) return;
        // Fire and forget with retry logic for cross-device durability via platformBridge
        const writes = this.localWrites.get(id) ?? new Set<Promise<void>>();
        this.localWrites.set(id, writes);
        const write = platformBridge.saveHistory(id, data).catch((err: any) => {
            if (this.localDeletionFences.has(id)) return;
            if (attempt < 3) {
                logger.warn(`[SessionService] Retrying local save for ${id} (attempt ${attempt + 1})...`);
                setTimeout(() => this.saveToLocal(id, data, attempt + 1), 1000 * attempt);
            } else {
                logger.error('[SessionService] Failed to save to local history after 3 attempts:', err);
            }
        }).finally(() => {
            writes.delete(write);
            if (writes.size === 0) this.localWrites.delete(id);
        });
        writes.add(write);
    }

    async getSessionsForUser(): Promise<ConversationSession[]> {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid;

        if (!userId) return [];

        const constraints = [
            where('orgId', '==', orgId),
            where('userId', '==', userId), // Strict ownership for now? Or participants?
            orderBy('updatedAt', 'desc'),
            limit(50)
        ];

        const docs = await this.list(constraints);
        return docs.map(d => ({
            ...d,
            createdAt: toMillisSafe(d.createdAt),
            updatedAt: toMillisSafe(d.updatedAt)
        }));
    }

    async getSessionsForUserPaginated(
        cursor?: SessionPageCursor,
        pageSize: number = 50
    ): Promise<{ sessions: ConversationSession[]; nextCursor?: SessionPageCursor }> {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid;

        if (!userId) return { sessions: [] };

        // Order by updatedAt with documentId() as a tiebreaker: two sessions can share the
        // exact same millisecond updatedAt (concurrent writes), and startAfter() on a single
        // non-unique field silently skips every doc that ties the cursor value, not just the
        // one already returned. The compound orderBy/startAfter makes the cursor unique.
        const constraints: QueryConstraint[] = [
            where('orgId', '==', orgId),
            where('userId', '==', userId),
            orderBy('updatedAt', 'desc'),
            orderBy(documentId(), 'desc'),
        ];

        if (cursor) {
            constraints.push(startAfter(Timestamp.fromMillis(cursor.updatedAt), cursor.id));
        }

        constraints.push(limit(pageSize + 1)); // +1 to detect if more exist

        const q = query(collection(db, 'sessions'), ...constraints);
        const snapshot = await getDocs(q);

        const docs = snapshot.docs.map(doc => {
            const d = doc.data() as SessionDocument;
            return {
                ...d,
                id: doc.id,
                createdAt: toMillisSafe(d.createdAt),
                updatedAt: toMillisSafe(d.updatedAt)
            } as ConversationSession;
        });

        // Check if there are more docs
        const hasMore = docs.length > pageSize;
        const sessions = hasMore ? docs.slice(0, pageSize) : docs;
        const lastSession = sessions[sessions.length - 1];
        const nextCursor = hasMore && lastSession ? { updatedAt: lastSession.updatedAt, id: lastSession.id } : undefined;

        return { sessions, nextCursor };
    }

    /**
     * Load all sessions on first login (paginate through entire archive).
     * Used to sync all sessions to a fresh device (phone/iPad).
     */
    async loadAllSessions(): Promise<ConversationSession[]> {
        const allSessions: ConversationSession[] = [];
        let cursor: SessionPageCursor | undefined;
        const pageSize = 50;

        try {
            while (true) {
                const { sessions, nextCursor } = await this.getSessionsForUserPaginated(cursor, pageSize);
                if (sessions.length === 0) break;

                allSessions.push(...sessions);
                if (!nextCursor) break; // No more pages

                cursor = nextCursor;
            }
            logger.info(`[SessionService] Loaded ${allSessions.length} total sessions on first login`);
            return allSessions;
        } catch (error) {
            logger.error('[SessionService] Failed to load all sessions:', error);
            return [];
        }
    }

    subscribeToSessions(
        onUpdate: (sessions: ConversationSession[]) => void,
        onError: (error: Error) => void
    ): Unsubscribe {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid;

        if (!userId) {
            onUpdate([]);
            return () => { };
        }

        const constraints = [
            where('orgId', '==', orgId),
            where('userId', '==', userId),
            orderBy('updatedAt', 'desc'),
            limit(50)
        ];

        const q = query(collection(db, 'sessions'), ...constraints);

        return onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => {
                const d = doc.data() as SessionDocument;
                return {
                    ...d,
                    id: doc.id,
                    createdAt: toMillisSafe(d.createdAt),
                    updatedAt: toMillisSafe(d.updatedAt)
                } as ConversationSession;
            });
            onUpdate(sessions);
        }, onError);
    }
}

export const sessionService = new SessionServiceImpl();
