/**
 * RemoteRelayService — Firestore Cloud Relay
 *
 * Replaces the Vite dev-server middleware with Firestore as the message broker.
 * Both phone and desktop use this service:
 *
 *   Phone  → sendCommand()     → writes to  commands/{id}
 *   Desktop → onCommand()      → listens to commands/ where status == 'pending'
 *   Desktop → sendResponse()   → writes to  responses/{id}
 *   Phone  → onResponse()      → listens to responses/ for a given commandId
 *   Desktop → pushDesktopState() → writes to state doc
 *   Phone  → onDesktopState()   → listens to state doc
 *
 * Collection structure:
 *   users/{userId}/remote-relay/state                     ← desktop state doc
 *   users/{userId}/remote-relay-commands/{commandId}      ← phone writes, desktop reads
 *   users/{userId}/remote-relay-responses/{responseId}    ← desktop writes, phone reads
 *
 * Security: isOwner(userId) — only the authenticated user touches their data.
 * Works cross-network: cellular, different WiFi, anywhere with internet.
 */

import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp,
    deleteDoc,
    getDocs,
    Timestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemoteCommand {
    id?: string;
    text: string;
    targetAgentId?: string;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    status: 'pending' | 'processing' | 'completed';
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
}

export interface RemoteResponse {
    id?: string;
    commandId: string;
    text: string;
    agentId?: string;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    isStreaming: boolean;
}

export interface DesktopState {
    currentModule: string;
    isAgentProcessing: boolean;
    activeSessionId: string;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    online: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserId(): string | null {
    return auth.currentUser?.uid ?? null;
}

function getRelayRef() {
    const uid = getUserId();
    if (!uid) return null;
    return doc(db, 'users', uid, 'remote-relay', 'state');
}

function getCommandsRef() {
    const uid = getUserId();
    if (!uid) return null;
    return collection(db, 'users', uid, 'remote-relay-commands');
}

function getResponsesRef() {
    const uid = getUserId();
    if (!uid) return null;
    return collection(db, 'users', uid, 'remote-relay-responses');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class RemoteRelayService {
    // -----------------------------------------------------------------------
    // PHONE SIDE
    // -----------------------------------------------------------------------

    /**
     * Send a command from the phone. Returns the command document ID.
     */
    async sendCommand(text: string, targetAgentId?: string): Promise<string | null> {
        const ref = getCommandsRef();
        if (!ref) {
            logger.warn('[RemoteRelay] No auth — cannot send command');
            return null;
        }

        const command: RemoteCommand = {
            text,
            timestamp: serverTimestamp(),
            status: 'pending',
            createdAt: serverTimestamp(),
            ...(targetAgentId ? { targetAgentId } : {}),
        };

        const docRef = await addDoc(ref, command);
        logger.info(`[RemoteRelay] 📱 Command sent: ${docRef.id} → agent: ${targetAgentId || 'auto'}`);
        return docRef.id;
    }

    /**
     * Listen for responses to a specific command (phone side).
     * Calls back with each response as it arrives in real-time.
     */
    onResponse(
        commandId: string,
        callback: (response: RemoteResponse) => void
    ): Unsubscribe {
        const ref = getResponsesRef();
        if (!ref) {
            logger.warn('[RemoteRelay] No auth — cannot listen for responses');
            return () => { };
        }

        const q = query(
            ref,
            where('commandId', '==', commandId)
        );

        return onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data() as RemoteResponse;
                    data.id = change.doc.id;
                    callback(data);
                }
            });
        }, (error) => {
            logger.error('[RemoteRelay] Response listener error:', error);
        });
    }

    /**
     * Listen for ALL responses (phone side — for the full conversation feed).
     */
    onAllResponses(callback: (responses: RemoteResponse[]) => void): Unsubscribe {
        const ref = getResponsesRef();
        if (!ref) return () => { };

        const q = query(ref, orderBy('timestamp', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const responses: RemoteResponse[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as RemoteResponse;
                data.id = doc.id;
                responses.push(data);
            });
            callback(responses);
        });
    }

    /**
     * Listen for desktop state changes (phone side).
     */
    onDesktopState(callback: (state: DesktopState | null) => void): Unsubscribe {
        const ref = getRelayRef();
        if (!ref) return () => { };

        return onSnapshot(ref, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data() as DesktopState);
            } else {
                callback(null);
            }
        });
    }

    // -----------------------------------------------------------------------
    // DESKTOP SIDE
    // -----------------------------------------------------------------------

    /**
     * Listen for pending commands (desktop side).
     * Fires callback whenever the phone sends a new command.
     */
    onCommand(
        callback: (command: RemoteCommand & { id: string }) => void
    ): Unsubscribe {
        const ref = getCommandsRef();
        if (!ref) {
            logger.warn('[RemoteRelay] No auth — cannot listen for commands');
            return () => { };
        }

        // Simple query — no compound index needed.
        // Filter status=='pending' client-side to avoid missing composite index.
        logger.info('[RemoteRelay] 🖥️ Starting command listener...');

        return onSnapshot(ref, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data() as RemoteCommand;
                    if (data.status === 'pending') {
                        logger.info(`[RemoteRelay] 📥 Pending command received: ${change.doc.id}`);
                        callback({ ...data, id: change.doc.id });
                    }
                }
            });
        }, (error) => {
            logger.error('[RemoteRelay] Command listener error:', error);
        });
    }

    /**
     * Mark a command as processing (desktop side).
     */
    async markCommandProcessing(commandId: string): Promise<void> {
        const uid = getUserId();
        if (!uid) return;
        await updateDoc(doc(db, 'users', uid, 'remote-relay-commands', commandId), {
            status: 'processing',
        });
    }

    /**
     * Mark a command as completed (desktop side).
     */
    async markCommandCompleted(commandId: string): Promise<void> {
        const uid = getUserId();
        if (!uid) return;
        await updateDoc(doc(db, 'users', uid, 'remote-relay-commands', commandId), {
            status: 'completed',
        });
    }

    /**
     * Send a response from the desktop (desktop side).
     */
    async sendResponse(
        commandId: string,
        text: string,
        agentId?: string,
        isStreaming = false
    ): Promise<void> {
        const ref = getResponsesRef();
        if (!ref) return;

        // Firestore rejects undefined values — only include agentId if defined
        const response: Record<string, unknown> = {
            commandId,
            text,
            timestamp: serverTimestamp(),
            isStreaming,
        };
        if (agentId !== undefined) {
            response.agentId = agentId;
        }

        await addDoc(ref, response);
        logger.info(`[RemoteRelay] 🖥️ Response sent for command ${commandId} (${text.length} chars)`);
    }

    /**
     * Push desktop state (desktop side).
     */
    async pushDesktopState(state: Omit<DesktopState, 'timestamp'>): Promise<void> {
        const ref = getRelayRef();
        if (!ref) return;

        await setDoc(ref, {
            ...state,
            timestamp: serverTimestamp(),
        }, { merge: true });
    }

    // -----------------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------------

    /**
     * Delete all commands and responses older than the given age (in hours).
     * Call periodically to prevent unbounded Firestore growth.
     */
    async cleanupOld(maxAgeHours = 24): Promise<number> {
        const uid = getUserId();
        if (!uid) return 0;

        const cutoff = Timestamp.fromMillis(Date.now() - maxAgeHours * 60 * 60 * 1000);
        let deleted = 0;

        // Clean commands
        const cmdsRef = getCommandsRef();
        if (cmdsRef) {
            const q = query(cmdsRef, where('createdAt', '<', cutoff));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
                await deleteDoc(d.ref);
                deleted++;
            }
        }

        // Clean responses
        const resRef = getResponsesRef();
        if (resRef) {
            const q = query(resRef, where('timestamp', '<', cutoff));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
                await deleteDoc(d.ref);
                deleted++;
            }
        }

        if (deleted > 0) {
            logger.info(`[RemoteRelay] Cleaned up ${deleted} old relay documents`);
        }

        return deleted;
    }

    /**
     * Check if user is authenticated (for UI to decide whether to show login).
     */
    isAuthenticated(): boolean {
        return getUserId() !== null;
    }
}

export const remoteRelayService = new RemoteRelayService();
