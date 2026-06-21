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
    limit,
    serverTimestamp,
    deleteDoc,
    getDocs,
    Timestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemoteCommand {
    id?: string;
    text: string;
    targetAgentId?: string;
    metadata?: Record<string, unknown>;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    status: 'pending' | 'processing' | 'completed';
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
}

export interface RemoteResponse {
    id?: string;
    commandId: string;
    text: string;
    agentId?: string;
    imageUrls?: string[];
    isFinal?: boolean;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    isStreaming: boolean;
    boardroomMessageId?: string;
    rating?: number;
}

export interface DesktopState {
    currentModule: string;
    isAgentProcessing: boolean;
    activeSessionId: string;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    online: boolean;
    /**
     * True when the desktop is in sleep mode (window hidden to tray, still
     * listening to the relay queue). Lets the phone show Sleeping vs Active vs
     * Offline. Absent/false in the web/PWA build (no Electron tray).
     */
    sleepMode?: boolean;
}

export interface AgentDispatchTask {
    id?: string;
    type: 'voice_memo' | 'quick_contact' | 'receipt_log' | 'agent_command' | 'media_capture' | 'document_scan' | 'venue_log';
    payload: {
        audioUrl?: string;
        videoUrl?: string;
        transcription?: string;
        imageUrl?: string;
        amount?: number;
        commandText?: string;
        lat?: number;
        lng?: number;
    };
    status: 'pending' | 'processing' | 'completed' | 'failed';
    executorId?: string;
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
    pickedUpAt?: Timestamp | ReturnType<typeof serverTimestamp>;
    completedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
    error?: {
        code: string;
        message: string;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserId(): string | null {
    return getRealAuthenticatedUserId(auth.currentUser);
}

function getRelayRef() {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return doc(db, 'users', uid, 'remote-relay', 'state');
}

function getCommandsRef() {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return collection(db, 'users', uid, 'remote-relay-commands');
}

function getResponsesRef() {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return collection(db, 'users', uid, 'remote-relay-responses');
}

function getDispatchQueueRef() {
    if (isFirebaseE2EMockEnabled()) return null;
    const uid = getUserId();
    if (!uid) return null;
    return collection(db, 'users', uid, 'agent_dispatch_queue');
}

// ---------------------------------------------------------------------------
// Feed scoping
// ---------------------------------------------------------------------------

/**
 * How many of the most-recent docs the conversation feed loads, and how far
 * back in time it looks. This prevents OLD responses (including stale
 * rate-limit / error messages) from resurfacing as if they were current every
 * time the app opens. We query DESC + limit, then re-sort ascending in memory
 * so the UI still renders oldest → newest.
 *
 * NOTE: `where('timestamp', '>=', ...)` combined with `orderBy('timestamp')`
 * acts on the SAME field, so no new composite index is required.
 */
const FEED_PAGE_SIZE = 50;
const FEED_RECENCY_HOURS = 24;
// Background browser tabs throttle setTimeout/setInterval to ~once per minute, so the
// desktop's 5s heartbeat loop collapses to ~60s whenever the studio tab is not focused
// (the common case while driving from a phone). A 15s window made the phone flap between
// connected/reconnecting and eventually unpair. Tolerate one throttled beat (65s) so the
// pairing holds while the desktop is merely backgrounded; a genuinely closed desktop is
// still detected within ~65s.
export const DESKTOP_HEARTBEAT_STALE_MS = 65_000;

function getFeedRecencyCutoff(): Timestamp {
    return Timestamp.fromMillis(Date.now() - FEED_RECENCY_HOURS * 60 * 60 * 1000);
}

/**
 * Safely convert a relay doc timestamp to epoch millis for in-memory sorting.
 * Stored docs always carry a resolved Firestore `Timestamp`, but the field type
 * also permits a `serverTimestamp()` sentinel (pre-write); guard for both.
 */
export function relayTimestampToMillis(ts: Timestamp | ReturnType<typeof serverTimestamp> | number | undefined): number {
    if (typeof ts === 'number') return ts;
    if (!ts) return 0;
    // Defensive: handle a plain { toMillis } shape or unresolved sentinel, bypassing instanceof Timestamp issues in tests.
    const maybe = ts as { toMillis?: () => number };
    return typeof maybe?.toMillis === 'function' ? maybe.toMillis() : 0;
}

export function isFreshDesktopState(
    state: DesktopState | null | undefined,
    now = Date.now(),
    staleMs = DESKTOP_HEARTBEAT_STALE_MS
): boolean {
    if (!state?.online) return false;
    const timestamp = relayTimestampToMillis(state.timestamp);
    if (timestamp === 0) return false;
    
    // Account for local clock skew between phone and server.
    // Use Math.abs() to handle clocks that are either ahead or behind.
    // Allow up to 10 minutes of skew. The local setTimeout in MobileRemote
    // will catch an actually dead desktop after 15 seconds anyway.
    const CLOCK_SKEW_TOLERANCE_MS = 10 * 60 * 1000;
    return Math.abs(now - timestamp) <= staleMs + CLOCK_SKEW_TOLERANCE_MS;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class RemoteRelayService {
    private localWs: any = null;
    private localMessageCallbacks: Map<string, (data: any) => void> = new Map();
    private localStateCallback: ((state: DesktopState | null) => void) | null = null;

    constructor() {
        if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
            const isLocalServer = window.location.port === '3333' || window.location.hostname.startsWith('192.168.') || window.location.hostname === 'localhost';
            if (isLocalServer) {
                this.initLocalWebSocket();
            }
        }
    }

    private initLocalWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        logger.info(`[RemoteRelay] Connecting local P2P WebSocket to ${wsUrl}`);
        
        try {
            const ws = new WebSocket(wsUrl);
            ws.onopen = () => {
                logger.info('[RemoteRelay] Local P2P WebSocket connected');
                this.localWs = ws;
                const passcode = new URLSearchParams(window.location.search).get('passcode') || localStorage.getItem('indii_p2p_passcode');
                if (passcode) {
                    ws.send(JSON.stringify({ type: 'auth', token: passcode }));
                }
            };
            ws.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.type === 'response' && parsed.response) {
                        const callback = this.localMessageCallbacks.get(parsed.response.commandId);
                        if (callback) {
                            callback({
                                ...parsed.response,
                                timestamp: Timestamp.fromMillis(parsed.response.timestamp)
                            });
                        }
                    } else if (parsed.type === 'sync' && parsed.payload) {
                        if (this.localStateCallback) {
                            this.localStateCallback({
                                ...parsed.payload,
                                timestamp: Timestamp.now()
                            });
                        }
                    }
                } catch (err) {
                    logger.error('[RemoteRelay] P2P message parse error', err);
                }
            };
            ws.onclose = () => {
                logger.info('[RemoteRelay] Local P2P WebSocket closed. Retrying in 5s...');
                this.localWs = null;
                setTimeout(() => this.initLocalWebSocket(), 5000);
            };
        } catch (err) {
            logger.error('[RemoteRelay] Local P2P WebSocket creation failed', err);
        }
    }

    // -----------------------------------------------------------------------
    // PHONE SIDE
    // -----------------------------------------------------------------------

    /**
     * Send a command from the phone. Returns the command document ID.
     */
    async sendCommand(text: string, targetAgentId?: string, metadata?: Record<string, unknown>): Promise<string | null> {
        // P2P WebSocket send path
        if (this.localWs && this.localWs.readyState === 1 /* OPEN */) {
            const commandId = `p2p-${Math.random().toString(36).substring(2)}`;
            const payload = {
                type: 'command',
                command: {
                    id: commandId,
                    text,
                    targetAgentId,
                    metadata
                },
                ts: Date.now()
            };
            this.localWs.send(JSON.stringify(payload));
            logger.info(`[RemoteRelay] 📱 Local P2P Command sent via WebSocket: ${commandId}`);
            return commandId;
        }

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
            ...(metadata ? { metadata } : {}),
        };

        const docRef = await addDoc(ref, command);
        logger.info(`[RemoteRelay] 📱 Command sent: ${docRef.id} → agent: ${targetAgentId || 'auto'}`);
        return docRef.id;
    }

    /**
     * Dispatch a generic task to the desktop executor (Mobile side).
     */
    async dispatchTask(task: Omit<AgentDispatchTask, 'id' | 'status' | 'createdAt'>): Promise<string | null> {
        const ref = getDispatchQueueRef();
        if (!ref) {
            logger.warn('[RemoteRelay] No auth — cannot dispatch task');
            return null;
        }

        const dispatchDoc: AgentDispatchTask = {
            ...task,
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(ref, dispatchDoc);
        logger.info(`[RemoteRelay] 📱 Dispatch task sent: ${docRef.id} [${task.type}]`);
        return docRef.id;
    }

    /**
     * Listen for all dispatch tasks for this user (Mobile side - to see status of tasks).
     */
    onAllDispatchTasks(callback: (tasks: (AgentDispatchTask & { id: string })[]) => void): Unsubscribe {
        const ref = getDispatchQueueRef();
        if (!ref) return () => { };

        // Order by createdAt descending
        const q = query(
            ref,
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        return onSnapshot(q, (snapshot) => {
            const tasks: (AgentDispatchTask & { id: string })[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as AgentDispatchTask;
                tasks.push({ ...data, id: doc.id });
            });
            callback(tasks);
        }, (error) => {
            logger.error('[RemoteRelay] onAllDispatchTasks listener error:', error);
        });
    }

    /**
     * Listen for responses to a specific command (phone side).
     * Calls back with each response as it arrives in real-time.
     */
    onResponse(
        commandId: string,
        callback: (response: RemoteResponse) => void
    ): Unsubscribe {
        let unsubFirestore: Unsubscribe = () => {};
        const ref = getResponsesRef();
        if (ref) {
            const q = query(
                ref,
                where('commandId', '==', commandId)
            );

            unsubFirestore = onSnapshot(q, (snapshot) => {
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

        this.localMessageCallbacks.set(commandId, callback);

        return () => {
            unsubFirestore();
            this.localMessageCallbacks.delete(commandId);
        };
    }

    /**
     * Listen for ALL responses (phone side — for the full conversation feed).
     */
    onAllResponses(callback: (responses: RemoteResponse[]) => void): Unsubscribe {
        const ref = getResponsesRef();
        if (!ref) return () => { };

        // Scope the feed: only the most-recent FEED_PAGE_SIZE docs from the last
        // FEED_RECENCY_HOURS. Order DESC for the limit to grab the newest, then
        // re-sort ascending below so the chat still renders oldest → newest.
        const q = query(
            ref,
            where('timestamp', '>=', getFeedRecencyCutoff()),
            orderBy('timestamp', 'desc'),
            limit(FEED_PAGE_SIZE)
        );

        return onSnapshot(q, (snapshot) => {
            const responses: RemoteResponse[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as RemoteResponse;
                data.id = doc.id;
                responses.push(data);
            });
            // Re-sort ascending (oldest → newest) for the UI.
            responses.sort((a, b) => relayTimestampToMillis(a.timestamp) - relayTimestampToMillis(b.timestamp));
            callback(responses);
        }, (error) => {
            logger.error('[RemoteRelay] onAllResponses listener error:', error);
        });
    }

    /**
     * Listen for ALL commands (phone side — for the full conversation feed).
     */
    onAllCommands(callback: (commands: RemoteCommand[]) => void): Unsubscribe {
        const ref = getCommandsRef();
        if (!ref) return () => { };

        // Scope the feed: only the most-recent FEED_PAGE_SIZE docs from the last
        // FEED_RECENCY_HOURS. Order DESC for the limit to grab the newest, then
        // re-sort ascending below so the chat still renders oldest → newest.
        const q = query(
            ref,
            where('timestamp', '>=', getFeedRecencyCutoff()),
            orderBy('timestamp', 'desc'),
            limit(FEED_PAGE_SIZE)
        );

        return onSnapshot(q, (snapshot) => {
            const commands: RemoteCommand[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as RemoteCommand;
                data.id = doc.id;
                commands.push(data);
            });
            // Re-sort ascending (oldest → newest) for the UI.
            commands.sort((a, b) => relayTimestampToMillis(a.timestamp) - relayTimestampToMillis(b.timestamp));
            callback(commands);
        }, (error) => {
            logger.error('[RemoteRelay] onAllCommands listener error:', error);
        });
    }

    /**
     * Listen for desktop state changes (phone side).
     */
    onDesktopState(callback: (state: DesktopState | null) => void): Unsubscribe {
        let unsubFirestore: Unsubscribe = () => {};
        const ref = getRelayRef();
        if (ref) {
            unsubFirestore = onSnapshot(ref, (snapshot) => {
                if (snapshot.exists()) {
                    callback(snapshot.data() as DesktopState);
                } else {
                    callback(null);
                }
            });
        }

        this.localStateCallback = callback;

        return () => {
            unsubFirestore();
            this.localStateCallback = null;
        };
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
        let unsubFirestore: Unsubscribe = () => {};
        const ref = getCommandsRef();
        if (!ref) {
            logger.warn('[RemoteRelay] No Firestore auth — fallback to local WebSocket listener only');
        } else {
            logger.info('[RemoteRelay] 🖥️ Starting Firestore command listener...');
            unsubFirestore = onSnapshot(ref, (snapshot) => {
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

        // Local P2P WebSocket fallback listener
        let localUnsub: (() => void) | null = null;
        const api = (window as any).electronAPI;
        if (api?.remote?.onMessageFromMobile) {
            logger.info('[RemoteRelay] 🖥️ Starting P2P Local WebSocket IPC listener...');
            localUnsub = api.remote.onMessageFromMobile((payload: any) => {
                if (payload && payload.type === 'command' && payload.command) {
                    logger.info(`[RemoteRelay] 📥 P2P Local command received over WebSocket: ${payload.command.text}`);
                    callback({
                        id: payload.command.id || `p2p-${Date.now()}`,
                        text: payload.command.text,
                        targetAgentId: payload.command.targetAgentId,
                        metadata: payload.command.metadata,
                        timestamp: Timestamp.fromMillis(payload.ts || Date.now()),
                        status: 'pending',
                        createdAt: Timestamp.fromMillis(payload.ts || Date.now()),
                    });
                }
            });
        }

        return () => {
            unsubFirestore();
            if (localUnsub) localUnsub();
        };
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
     * Listen for pending dispatch tasks (desktop side).
     */
    onDispatchTask(
        callback: (task: AgentDispatchTask & { id: string }) => void
    ): Unsubscribe {
        let unsubFirestore: Unsubscribe = () => {};
        const ref = getDispatchQueueRef();
        if (!ref) {
            logger.warn('[RemoteRelay] No Firestore auth — cannot listen for dispatch tasks');
        } else {
            logger.info('[RemoteRelay] 🖥️ Starting Firestore dispatch task listener...');
            unsubFirestore = onSnapshot(ref, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        const data = change.doc.data() as AgentDispatchTask;
                        if (data.status === 'pending') {
                            logger.info(`[RemoteRelay] 📥 Pending dispatch task received: ${change.doc.id} [${data.type}]`);
                            callback({ ...data, id: change.doc.id });
                        }
                    }
                });
            }, (error) => {
                logger.error('[RemoteRelay] Dispatch task listener error:', error);
            });
        }
        return unsubFirestore;
    }

    /**
     * Update the status of a dispatch task (desktop side).
     */
    async updateDispatchTaskStatus(
        taskId: string, 
        status: AgentDispatchTask['status'], 
        error?: AgentDispatchTask['error']
    ): Promise<void> {
        const uid = getUserId();
        if (!uid) return;
        
        const updateData: Partial<AgentDispatchTask> = { status };
        
        if (status === 'processing') {
            updateData.pickedUpAt = serverTimestamp();
        } else if (status === 'completed' || status === 'failed') {
            updateData.completedAt = serverTimestamp();
        }
        
        if (error) {
            updateData.error = error;
        }

        await updateDoc(doc(db, 'users', uid, 'agent_dispatch_queue', taskId), updateData as any);
        logger.info(`[RemoteRelay] 🖥️ Dispatch task ${taskId} marked as ${status}`);
    }

    /**
     * Send a response from the desktop (desktop side).
     */
    async sendResponse(
        commandId: string,
        text: string,
        agentId?: string,
        isStreaming = false,
        imageUrls?: string[],
        boardroomMessageId?: string
    ): Promise<void> {
        // P2P Local WebSocket broadcast fallback
        const api = (window as any).electronAPI;
        if (api?.remote?.broadcast) {
            api.remote.broadcast({
                type: 'response',
                response: {
                    commandId,
                    text,
                    agentId,
                    isStreaming,
                    imageUrls,
                    boardroomMessageId,
                    timestamp: Date.now()
                }
            });
        }

        const ref = getResponsesRef();
        if (!ref) return;

        // Firestore rejects undefined values — only include optional fields if defined
        const response: Record<string, unknown> = {
            commandId,
            text,
            timestamp: serverTimestamp(),
            isStreaming,
            isFinal: !isStreaming,
            boardroomMessageId,
        };
        if (agentId !== undefined) {
            response.agentId = agentId;
        }
        if (imageUrls && imageUrls.length > 0) {
            response.imageUrls = imageUrls;
        }

        await addDoc(ref, response);
        logger.info(`[RemoteRelay] 🖥️ Response sent for command ${commandId} (${text.length} chars, ${imageUrls?.length || 0} images)`);
    }

    /**
     * Push desktop state (desktop side).
     */
    async pushDesktopState(state: Omit<DesktopState, 'timestamp'>): Promise<void> {
        // P2P Local WebSocket broadcast fallback
        const api = (window as any).electronAPI;
        if (api?.remote?.broadcast) {
            api.remote.broadcast({
                type: 'sync',
                payload: state,
                ts: Date.now()
            });
        }

        if (isFirebaseE2EMockEnabled()) return;
        
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
