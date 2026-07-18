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
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    deleteDoc,
    getDocs,
    runTransaction,
    Timestamp,
    type Unsubscribe,
    type WithFieldValue,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { getRealAuthenticatedUserId } from '@/utils/authGuards';
import type { RemoteMobilePayload } from '@/types/electron';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemoteCommand {
    id?: string;
    text: string;
    targetAgentId?: string;
    metadata?: Record<string, unknown>;
    /**
     * The sole executor allowed to claim this command. Keeping this on the
     * durable command record prevents the Studio listener and Cloud Function
     * from racing to claim the same pending request.
     */
    executionTarget?: RemoteExecutionTarget;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    // 'cancelled' (ISSUE-989): the phone gave up (timeout/unmount) before the
    // desktop claimed the command — the atomic claim precondition in
    // processSingleCommand() only matches 'pending', so a cancelled command
    // can never be picked up by a later backlog scan/recovery.
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
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

/** One transport-neutral response contract. Optional keys are omitted, never undefined. */
export function serializeRemoteResponse(input: {
    commandId: string;
    text: string;
    agentId?: string;
    isStreaming?: boolean;
    imageUrls?: string[];
    boardroomMessageId?: string;
}): Omit<RemoteResponse, 'timestamp'> {
    const isStreaming = input.isStreaming === true;
    return {
        commandId: input.commandId,
        text: input.text,
        isStreaming,
        isFinal: !isStreaming,
        ...(input.agentId ? { agentId: input.agentId } : {}),
        ...(input.imageUrls?.length ? { imageUrls: input.imageUrls } : {}),
        ...(input.boardroomMessageId ? { boardroomMessageId: input.boardroomMessageId } : {}),
    };
}

export interface DesktopState {
    currentModule: string;
    isAgentProcessing: boolean;
    activeSessionId: string;
    timestamp: Timestamp | ReturnType<typeof serverTimestamp>;
    online: boolean;
    /** Presence must come from a Studio executor, never the Controller. */
    role?: 'studio';
    /** Per-running-Studio identity, used to distinguish a live executor lease. */
    studioInstanceId?: string;
    /** The Studio has mounted its queue consumer and may safely accept work. */
    listenerReady?: boolean;
    executorDeviceId?: string;
    /**
     * True when the desktop is in sleep mode (window hidden to tray, still
     * listening to the relay queue). Lets the phone show Sleeping vs Active vs
     * Offline. Absent/false in the web/PWA build (no Electron tray).
     */
    sleepMode?: boolean;
    /** Populated locally by onSnapshot to decouple freshness from server clock skew. */
    _localReceivedAtMs?: number;
}

export type RemoteExecutionTarget = 'cloud' | 'studio';

const LEGACY_STUDIO_COMMAND_PREFIXES = [
    '[GENERATE_IMAGE]',
    '[SHOW]',
    '[WAKE]',
    '[NAVIGATE]',
    '[AGENT_ACTION]',
    '[DAW_CONTROL]',
    '[MEDIA_PLAYBACK]',
    '[RAW]',
] as const;

/**
 * Legacy commands did not record their executor. Preserve those established
 * Studio controls while making all unmarked text cloud-owned. New callers
 * always persist the target, so this fallback is only for already-queued docs.
 */
export function resolveRemoteCommandExecutionTarget(
    command: Pick<RemoteCommand, 'text' | 'executionTarget'>
): RemoteExecutionTarget {
    if (command.executionTarget === 'studio' || command.executionTarget === 'cloud') {
        return command.executionTarget;
    }

    const text = command.text.trim();
    return LEGACY_STUDIO_COMMAND_PREFIXES.some(prefix => text.startsWith(prefix))
        ? 'studio'
        : 'cloud';
}

export interface AgentDispatchTask {
    id?: string;
    type: 'voice_memo' | 'quick_contact' | 'receipt_log' | 'agent_command' | 'live_moment' | 'media_capture' | 'document_scan' | 'venue_log';
    payload: {
        audioUrl?: string;
        videoUrl?: string;
        transcription?: string;
        imageUrl?: string;
        amount?: number;
        commandText?: string;
        noteText?: string;
        lat?: number;
        lng?: number;
        accuracyMeters?: number;
        capturedAt?: string;
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
    /**
     * ISSUE-983: the durable receipt proving a note/attachment was actually
     * created — populated only when the desktop executor calls the Notes
     * tool directly and gets a real ID back, never inferred from an agent
     * chat reply.
     */
    result?: {
        noteId?: string;
        assetUrl?: string;
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRemoteMobileMessage(payload: unknown): payload is RemoteMobilePayload {
    if (!payload || typeof payload !== 'object') return false;
    const message = payload as Record<string, unknown>;
    if (typeof message.type !== 'string') return false;
    if (message.command === undefined) return true;
    if (!message.command || typeof message.command !== 'object') return false;
    return typeof (message.command as Record<string, unknown>).text === 'string';
}

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
const LOCAL_P2P_PASSCODE_KEY = 'indii_p2p_passcode';
// Background browser tabs throttle setTimeout/setInterval to ~once per minute, so the
// desktop's 5s heartbeat loop collapses to ~60s whenever the studio tab is not focused
// (the common case while driving from a phone). A 15s window made the phone flap between
// connected/reconnecting and eventually unpair. Tolerate throttled beats so the
// pairing holds while the desktop is backgrounded; a genuinely closed desktop is
// still detected within 120s.
export const DESKTOP_HEARTBEAT_STALE_MS = 120_000;
export const DESKTOP_HEARTBEAT_CLOCK_SKEW_TOLERANCE_MS = 30_000;

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

export function isPrivateIP(hostname: string): boolean {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

    // Class A: 10.X.X.X
    if (hostname.startsWith('10.')) return true;

    // Class C: 192.168.X.X
    if (hostname.startsWith('192.168.')) return true;

    // Class B: 172.16.X.X to 172.31.X.X
    const parts = hostname.split('.');
    if (parts.length === 4 && parts[0] === '172') {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
    }

    return false;
}

export function isFreshDesktopState(
    state: DesktopState | null | undefined,
    now = Date.now(),
    staleMs = DESKTOP_HEARTBEAT_STALE_MS
): boolean {
    if (!state?.online) return false;
    
    // If we have a local receipt timestamp, use it directly to avoid clock skew entirely
    if (state._localReceivedAtMs) {
        return now - state._localReceivedAtMs <= staleMs;
    }

    const timestamp = relayTimestampToMillis(state.timestamp);
    if (timestamp === 0) return false;
    
    // Fallback: Account for local clock skew between phone and server.
    return Math.abs(now - timestamp) <= staleMs + DESKTOP_HEARTBEAT_CLOCK_SKEW_TOLERANCE_MS;
}

/**
 * A generic fresh state document is not enough to call a Controller connected:
 * older Controller builds could write the same document themselves. Only a
 * current Studio executor lease proves that Studio work can be dispatched.
 */
export function isFreshStudioState(
    state: DesktopState | null | undefined,
    now = Date.now(),
    staleMs = DESKTOP_HEARTBEAT_STALE_MS
): boolean {
    return isFreshDesktopState(state, now, staleMs)
        && state?.role === 'studio'
        && typeof state.studioInstanceId === 'string'
        && state.studioInstanceId.length > 0
        && state.listenerReady === true;
}

/**
 * How long the current Studio lease can still be treated as fresh on this
 * device. MobileRemote uses the same boundary as isFreshStudioState so its
 * timeout cannot fire early, briefly recover inside the skew allowance, and
 * then forget to schedule the real stale transition.
 */
export function studioStateFreshnessRemainingMs(
    state: DesktopState | null | undefined,
    now = Date.now(),
    staleMs = DESKTOP_HEARTBEAT_STALE_MS
): number {
    if (!isFreshStudioState(state, now, staleMs)) return 0;
    
    if (state?._localReceivedAtMs) {
        return Math.max(0, state._localReceivedAtMs + staleMs - now);
    }
    
    const timestamp = relayTimestampToMillis(state?.timestamp);
    return Math.max(
        0,
        timestamp + staleMs + DESKTOP_HEARTBEAT_CLOCK_SKEW_TOLERANCE_MS - now
    );
}

export function cacheRemotePairingToken(token: string | null | undefined): string | null {
    const normalized = token?.trim();
    if (!normalized) return null;

    try {
        localStorage.setItem(LOCAL_P2P_PASSCODE_KEY, normalized);
    } catch (error) {
        logger.debug('[RemoteRelay] Unable to cache local P2P passcode:', error);
    }

    return normalized;
}

export function getCachedRemotePairingToken(search = typeof window !== 'undefined' ? window.location.search : ''): string | null {
    const urlToken = cacheRemotePairingToken(new URLSearchParams(search).get('passcode'));
    if (urlToken) return urlToken;

    try {
        return localStorage.getItem(LOCAL_P2P_PASSCODE_KEY);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class RemoteRelayService {
    private localWs: WebSocket | null = null;
    private localMessageCallbacks: Map<string, (data: RemoteResponse) => void> = new Map();
    private localStateCallbacks = new Set<(state: DesktopState | null) => void>();
    private wsRetryCount = 0;

    constructor() {
        if (typeof process !== 'undefined' && process.env.VITEST) {
            return;
        }
        if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
            const isLocalServer = window.location.port === '3333' || isPrivateIP(window.location.hostname);
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
                this.wsRetryCount = 0; // reset on success
                const passcode = getCachedRemotePairingToken();
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
                        for (const callback of this.localStateCallbacks) {
                            callback({
                                ...parsed.payload,
                                timestamp: Timestamp.now()
                            });
                        }
                    }
                } catch (err) {
                    logger.error('[RemoteRelay] P2P message parse error', err);
                }
            };
            ws.onclose = (event) => {
                this.localWs = null;
                if (event.code === 4001) {
                    logger.warn('[RemoteRelay] Local P2P WebSocket authentication failed (code 4001). Will not retry.');
                    return;
                }
                const delay = Math.min(1000 * Math.pow(2, this.wsRetryCount), 30000);
                this.wsRetryCount++;
                logger.info(`[RemoteRelay] Local P2P WebSocket closed. Code: ${event.code}. Retrying in ${delay}ms...`);
                setTimeout(() => this.initLocalWebSocket(), delay);
            };
        } catch (err) {
            logger.error('[RemoteRelay] Local P2P WebSocket creation failed', err);
            const delay = Math.min(1000 * Math.pow(2, this.wsRetryCount), 30000);
            this.wsRetryCount++;
            logger.info(`[RemoteRelay] Scheduling retry in ${delay}ms after constructor error.`);
            setTimeout(() => this.initLocalWebSocket(), delay);
        }
    }

    // -----------------------------------------------------------------------
    // PHONE SIDE
    // -----------------------------------------------------------------------

    /**
     * Send a command from the phone. Returns the command document ID.
     */
    async sendCommand(
        text: string,
        targetAgentId?: string,
        metadata?: Record<string, unknown>,
        executionTarget?: RemoteExecutionTarget
    ): Promise<string | null> {
        const resolvedExecutionTarget = executionTarget ?? resolveRemoteCommandExecutionTarget({ text });
        // P2P WebSocket send path
        if (this.localWs && this.localWs.readyState === 1 /* OPEN */) {
            const commandId = `p2p-${Math.random().toString(36).substring(2)}`;
            const payload = {
                type: 'command',
                command: {
                    id: commandId,
                    text,
                    targetAgentId,
                    metadata,
                    executionTarget: resolvedExecutionTarget,
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
            executionTarget: resolvedExecutionTarget,
        };

        const docRef = await addDoc(ref, command);
        logger.info(`[RemoteRelay] 📱 Command sent: ${docRef.id} → agent: ${targetAgentId || 'auto'}`);
        return docRef.id;
    }

    /**
     * Dispatch a generic task to the desktop executor (Mobile side).
     *
     * ISSUE-982: callers (QuickCaptureView) treat a resolved promise as success
     * and clear the user's only local copy of the note/media. Silently
     * returning null on missing auth let that happen invisibly. Auth failure
     * must throw so it lands in the caller's existing try/catch instead.
     */
    async dispatchTask(task: Omit<AgentDispatchTask, 'id' | 'status' | 'createdAt'>): Promise<string> {
        if (isFirebaseE2EMockEnabled()) {
            return `e2e-dispatch-${Date.now()}`;
        }

        const ref = getDispatchQueueRef();
        if (!ref) {
            throw new Error('Not authenticated — cannot dispatch task');
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
                    const data = snapshot.data({ serverTimestamps: 'estimate' }) as DesktopState;
                    data._localReceivedAtMs = Date.now();
                    callback(data);
                } else {
                    callback(null);
                }
            });
        }

        this.localStateCallbacks.add(callback);

        return () => {
            unsubFirestore();
            this.localStateCallbacks.delete(callback);
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
        const api = window.electronAPI;
        if (api?.remote?.onMessageFromMobile) {
            logger.info('[RemoteRelay] 🖥️ Starting P2P Local WebSocket IPC listener...');
            localUnsub = api.remote.onMessageFromMobile((payload: RemoteMobilePayload) => {
                if (!isRemoteMobileMessage(payload)) return;
                if (payload && payload.type === 'command' && payload.command) {
                    logger.info(`[RemoteRelay] 📥 P2P Local command received over WebSocket: ${payload.command.text}`);
                    callback({
                        id: payload.command.id || `p2p-${Date.now()}`,
                        text: payload.command.text,
                        targetAgentId: payload.command.targetAgentId,
                        metadata: payload.command.metadata,
                        executionTarget: payload.command.executionTarget,
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
        if (commandId.startsWith('p2p-')) return;
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
        if (commandId.startsWith('p2p-')) return;
        const { studioExecutorLeaseService } = await import('./StudioExecutorLeaseService');
        await studioExecutorLeaseService.completeCommand(commandId);
    }

    /**
     * Atomically cancel a command if the desktop hasn't claimed it yet
     * (phone side — timeout or giving up on a request).
     *
     * ISSUE-989: a client-side generation timeout previously only detached
     * the phone's listener; the Firestore command stayed 'pending' forever,
     * so a desktop that came back online later (mount/recovery backlog scan)
     * would still execute it — potentially alongside a brand-new retry
     * command, paying for the same generation twice. Returns `true` when the
     * command was genuinely cancelled before being claimed (no cost was
     * incurred); `false` when the desktop already claimed it (work may still
     * be in progress — cannot be cancelled for free) or it doesn't exist.
     */
    async cancelCommand(commandId: string): Promise<boolean> {
        const uid = getUserId();
        if (!uid) return false;

        const ref = doc(db, 'users', uid, 'remote-relay-commands', commandId);
        try {
            return await runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (snap.exists() && snap.data()?.status === 'pending') {
                    tx.update(ref, { status: 'cancelled' });
                    return true;
                }
                return false;
            });
        } catch (error) {
            logger.error('[RemoteRelay] Command cancel failed:', error);
            return false;
        }
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
     * Atomically claim a dispatch task by flipping pending → processing
     * inside a Firestore transaction. First caller to commit wins.
     *
     * ISSUE-984: `onDispatchTask` can fire for the same pending task on
     * multiple open desktop listeners (two tabs/windows, or a re-subscribe)
     * before any of them has written back a status change. Without an
     * atomic precondition, every one of them would independently pass and
     * process the same capture — duplicate notes, duplicate AI calls,
     * duplicate spend. The transaction re-reads status inside the commit
     * attempt, so only one caller observes 'pending' and wins the claim.
     */
    async claimDispatchTask(taskId: string): Promise<boolean> {
        const uid = getUserId();
        if (!uid) return false;

        const ref = doc(db, 'users', uid, 'agent_dispatch_queue', taskId);
        try {
            return await runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (snap.exists() && snap.data()?.status === 'pending') {
                    tx.update(ref, { status: 'processing', pickedUpAt: serverTimestamp() });
                    return true;
                }
                return false;
            });
        } catch (error) {
            logger.error('[RemoteRelay] Dispatch task atomic claim failed:', error);
            return false;
        }
    }

    /**
     * Update the status of a dispatch task (desktop side).
     */
    async updateDispatchTaskStatus(
        taskId: string,
        status: AgentDispatchTask['status'],
        error?: AgentDispatchTask['error'],
        result?: AgentDispatchTask['result']
    ): Promise<void> {
        const uid = getUserId();
        if (!uid) return;

        const updateData: WithFieldValue<Partial<AgentDispatchTask>> = { status };

        if (status === 'processing') {
            updateData.pickedUpAt = serverTimestamp();
        } else if (status === 'completed' || status === 'failed') {
            updateData.completedAt = serverTimestamp();
        }

        if (error) {
            updateData.error = error;
        }

        if (result) {
            updateData.result = result;
        }

        await updateDoc(doc(db, 'users', uid, 'agent_dispatch_queue', taskId), updateData);
        logger.info(`[RemoteRelay] 🖥️ Dispatch task ${taskId} marked as ${status}`);
    }

    /**
     * Listen for status/result changes on a single dispatch task (phone side).
     * ISSUE-983: lets the capture UI wait for a real terminal receipt
     * ('completed' with a noteId, or 'failed') instead of treating queue
     * acceptance itself as success.
     */
    onDispatchTaskUpdate(
        taskId: string,
        callback: (task: AgentDispatchTask & { id: string }) => void
    ): Unsubscribe {
        if (isFirebaseE2EMockEnabled()) return () => {};
        const uid = getUserId();
        if (!uid) return () => {};

        return onSnapshot(
            doc(db, 'users', uid, 'agent_dispatch_queue', taskId),
            (snap) => {
                if (!snap.exists()) return;
                callback({ ...(snap.data() as AgentDispatchTask), id: snap.id });
            },
            (error) => {
                logger.error('[RemoteRelay] Dispatch task update listener error:', error);
            }
        );
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
        const response = serializeRemoteResponse({ commandId, text, agentId, isStreaming, imageUrls, boardroomMessageId });

        // P2P Local WebSocket broadcast fallback
        const api = window.electronAPI;
        if (api?.remote?.broadcast) {
            api.remote.broadcast({
                type: 'response',
                response: {
                    ...response,
                    timestamp: Date.now()
                }
            });
        }

        if (commandId.startsWith('p2p-')) return;

        // Firestore rejects undefined values (no ignoreUndefinedProperties) —
        // every optional field must be added conditionally, never spread in
        // unconditionally like boardroomMessageId previously was.
        const { studioExecutorLeaseService } = await import('./StudioExecutorLeaseService');
        await studioExecutorLeaseService.publishResponse(response);
        logger.info(`[RemoteRelay] 🖥️ Response sent for command ${commandId} (${text.length} chars, ${imageUrls?.length || 0} images)`);
    }

    /**
     * Push desktop state (desktop side).
     */
    async pushDesktopState(state: Omit<DesktopState, 'timestamp'>): Promise<void> {
        // P2P Local WebSocket broadcast fallback
        const api = window.electronAPI;
        if (api?.remote?.broadcast) {
            api.remote.broadcast({
                type: 'sync',
                payload: state,
                ts: Date.now()
            });
        }

        if (isFirebaseE2EMockEnabled()) return;
        const { studioExecutorLeaseService } = await import('./StudioExecutorLeaseService');
        await studioExecutorLeaseService.publishPresence(state);
    }

    /**
     * A closing Studio may mark only its own lease offline. Without this guard,
     * a Controller route transition or a second Studio window can overwrite a
     * healthy executor's presence document.
     */
    async releaseStudioPresence(studioInstanceId: string): Promise<void> {
        if (isFirebaseE2EMockEnabled()) return;
        const { studioExecutorLeaseService } = await import('./StudioExecutorLeaseService');
        await studioExecutorLeaseService.releasePresence(studioInstanceId);
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

const DISPATCH_CONFIRMATION_TIMEOUT_MS = 90000;

/**
 * ISSUE-983: wait for a dispatch task's real terminal status instead of
 * treating queue acceptance as success — so "Save to Notes" only clears the
 * capture once a note actually exists (or surfaces a genuine failure/timeout).
 */
export function waitForDispatchConfirmation(
    taskId: string
): Promise<{ status: 'completed' | 'failed'; error?: AgentDispatchTask['error'] }> {
    return new Promise((resolve) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            unsubscribe();
            resolve({ status: 'failed', error: { code: 'TIMEOUT', message: 'Saving timed out. Check desktop studio.' } });
        }, DISPATCH_CONFIRMATION_TIMEOUT_MS);

        const unsubscribe = remoteRelayService.onDispatchTaskUpdate(taskId, (task) => {
            if (task.status !== 'completed' && task.status !== 'failed') return;
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            unsubscribe();
            resolve({ status: task.status, error: task.error });
        });
    });
}
