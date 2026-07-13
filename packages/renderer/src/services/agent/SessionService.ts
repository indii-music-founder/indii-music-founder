/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */

import { FirestoreService } from '../FirestoreService';
import type { ConversationSession, AgentMessage } from '@/core/store/slices/agent'; // Direct import to avoid circular dep risks? Or from index?
import { OrganizationService } from '../OrganizationService';
import { auth } from '../firebase';
import { where, orderBy, limit, Timestamp, onSnapshot, collection, query, Unsubscribe, startAfter, getDocs, QueryConstraint, documentId, doc, updateDoc, serverTimestamp, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '@/services/utils/firebase';
import { logger } from '@/utils/logger';

// Define the Firestore document shape (handling timestamps)
interface SessionDocument extends Omit<ConversationSession, 'createdAt' | 'updatedAt'> {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    userId: string;
    orgId: string;
}

/** Compound pagination cursor: (updatedAt, id) tiebreak avoids skipping same-millisecond docs. */
export interface SessionPageCursor {
    updatedAt: number;
    id: string;
}

class SessionServiceImpl extends FirestoreService<SessionDocument> {
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
        await runTransaction(db, async transaction => {
            const current = await transaction.get(sessionRef);
            if (!current.exists()) throw new Error(`Session '${sessionId}' no longer exists.`);
            const data = current.data() as SessionDocument;

            // One atomic, idempotent bridge for existing array-backed sessions.
            // Concurrent phone/desktop appends retry the transaction, so both
            // messages plus the legacy history survive the format transition.
            if (data.messageStorage !== 'subcollection') {
                for (const legacyMessage of data.messages || []) {
                    transaction.set(doc(db, 'sessions', sessionId, 'messages', legacyMessage.id), cleanFirestoreData({
                        ...legacyMessage,
                        userId,
                        orgId,
                        createdAt: serverTimestamp(),
                    }));
                }
            }
            transaction.set(messageRef, cleanFirestoreData({
                ...message,
                userId,
                orgId,
                createdAt: serverTimestamp(),
            }));
            transaction.update(sessionRef, { updatedAt: serverTimestamp(), messageStorage: 'subcollection' });
        });
    }

    async updateMessage(sessionId: string, messageId: string, updates: Partial<AgentMessage>): Promise<void> {
        await updateDoc(doc(db, 'sessions', sessionId, 'messages', messageId), cleanFirestoreData(updates));
        await this.update(sessionId, { updatedAt: serverTimestamp(), messageStorage: 'subcollection' } as unknown as Partial<SessionDocument>);
    }

    async clearMessages(sessionId: string): Promise<void> {
        const snapshot = await getDocs(collection(db, 'sessions', sessionId, 'messages'));
        const batch = writeBatch(db);
        snapshot.docs.forEach(message => batch.delete(message.ref));
        await batch.commit();
        await this.update(sessionId, { updatedAt: serverTimestamp(), messageStorage: 'subcollection' } as unknown as Partial<SessionDocument>);
    }

    subscribeToMessages(
        sessionId: string,
        onUpdate: (messages: AgentMessage[]) => void,
        onError: (error: Error) => void,
    ): Unsubscribe {
        const q = query(collection(db, 'sessions', sessionId, 'messages'), orderBy('timestamp', 'asc'));
        return onSnapshot(q, snapshot => {
            onUpdate(snapshot.docs.map(message => {
                const { userId: _userId, orgId: _orgId, createdAt: _createdAt, ...data } = message.data();
                return { ...data, id: message.id } as AgentMessage;
            }));
        }, onError);
    }

    async deleteSession(id: string): Promise<void> {
        await this.delete(id);

        // KEEPER: Dual Write for Electron Local Persistence (Forget)
        if (window.electronAPI?.agent?.deleteHistory) {
            window.electronAPI.agent.deleteHistory(id).catch((err: any) => {
                logger.error('[SessionService] Failed to delete local history:', err);
            });
        }
    }

    private saveToLocal(id: string, data: any, attempt = 1) {
        if (window.electronAPI?.agent?.saveHistory) {
            // Fire and forget with retry logic for cross-device durability
            window.electronAPI.agent.saveHistory(id, data).catch((err: any) => {
                if (attempt < 3) {
                    logger.warn(`[SessionService] Retrying local save for ${id} (attempt ${attempt + 1})...`);
                    setTimeout(() => this.saveToLocal(id, data, attempt + 1), 1000 * attempt);
                } else {
                    logger.error('[SessionService] Failed to save to local history after 3 attempts:', err);
                }
            });
        }
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
            createdAt: d.createdAt.toMillis(),
            updatedAt: d.updatedAt.toMillis()
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
                createdAt: d.createdAt.toMillis(),
                updatedAt: d.updatedAt.toMillis()
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
                    createdAt: d.createdAt.toMillis(),
                    updatedAt: d.updatedAt.toMillis()
                } as ConversationSession;
            });
            onUpdate(sessions);
        }, onError);
    }
}

export const sessionService = new SessionServiceImpl();
