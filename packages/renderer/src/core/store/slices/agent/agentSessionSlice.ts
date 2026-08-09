import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import type { SessionPageCursor } from '@/services/agent/SessionService';

let agentSessionsUnsubscribe: (() => void) | null = null;
let agentMessagesUnsubscribe: (() => void) | null = null;
const agentSessionRuntimeStartedAt = Date.now();
const pendingMessageIds = new Map<string, Set<string>>();
const messageWriteChains = new Map<string, Promise<void>>();
const recoveredInterruptedMessageIds = new Set<string>();
const INTERRUPTED_GENERATION_MARKER = '*(Generation interrupted by page reload)*';

function messageWriteKey(sessionId: string, messageId: string): string {
    return `${sessionId}:${messageId}`;
}

async function persistMessageWrite(
    operation: () => Promise<void>,
    label: string,
): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await operation();
            return;
        } catch (error) {
            if (attempt === 3) {
                logger.error(`[AgentSlice] ${label} failed after 3 attempts:`, error);
                return;
            }

            logger.warn(`[AgentSlice] ${label} attempt ${attempt} failed, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

/**
 * Firestore creates and updates for one response must commit in UI order.
 * Otherwise a fast final/telemetry update can beat the initial blank append
 * and either fail or be overwritten by the stale initial document.
 */
function enqueueMessageWrite(
    sessionId: string,
    messageId: string,
    operation: () => Promise<void>,
    label: string,
): void {
    const key = messageWriteKey(sessionId, messageId);
    const previous = messageWriteChains.get(key) ?? Promise.resolve();
    const next = previous
        .catch(() => undefined)
        .then(() => persistMessageWrite(operation, label))
        .finally(() => {
            if (messageWriteChains.get(key) === next) {
                messageWriteChains.delete(key);
            }
        });
    messageWriteChains.set(key, next);
}

function markMessagePending(sessionId: string, messageId: string): void {
    const pending = pendingMessageIds.get(sessionId) ?? new Set<string>();
    pending.add(messageId);
    pendingMessageIds.set(sessionId, pending);
}

function mergePendingMessages(
    sessionId: string,
    localMessages: AgentMessage[],
    synchronizedMessages: AgentMessage[]
): AgentMessage[] {
    const pending = pendingMessageIds.get(sessionId);
    if (!pending?.size) return synchronizedMessages;

    const synchronizedIds = new Set(synchronizedMessages.map(message => message.id));
    for (const messageId of synchronizedIds) {
        pending.delete(messageId);
    }

    const optimisticMessages = localMessages.filter(
        message => pending.has(message.id) && !synchronizedIds.has(message.id)
    );

    if (pending.size === 0) {
        pendingMessageIds.delete(sessionId);
    }

    return [...synchronizedMessages, ...optimisticMessages]
        .sort((a, b) => a.timestamp - b.timestamp);
}

function recoverInterruptedMessages(
    sessionId: string,
    messages: AgentMessage[]
): AgentMessage[] {
    return messages.map(message => {
        const recoveryKey = messageWriteKey(sessionId, message.id);
        if (!message.isStreaming) {
            recoveredInterruptedMessageIds.delete(recoveryKey);
            return message;
        }
        if (message.timestamp >= agentSessionRuntimeStartedAt) {
            return message;
        }

        const text = message.text.includes(INTERRUPTED_GENERATION_MARKER)
            ? message.text
            : `${message.text}${message.text ? '\n\n' : ''}${INTERRUPTED_GENERATION_MARKER}`;
        const recoveredMessage = { ...message, text, isStreaming: false };

        if (!recoveredInterruptedMessageIds.has(recoveryKey)) {
            recoveredInterruptedMessageIds.add(recoveryKey);
            enqueueMessageWrite(
                sessionId,
                message.id,
                () => import('@/services/agent/SessionService').then(({ sessionService }) =>
                    sessionService.updateMessage(sessionId, message.id, { text, isStreaming: false })
                ),
                `recover interrupted message ${message.id}`
            );
        }

        return recoveredMessage;
    });
}

export type MessageSource = 'desktop' | 'mobile-remote' | 'background' | 'api' | 'boardroom';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
    isStreaming?: boolean;
    thoughts?: AgentThought[];
    agentId?: string;
    thoughtSignature?: string;
    /** Where this message originated from */
    source?: MessageSource;
    /** Optional device/context metadata (device name, IP, etc.) */
    metadata?: Record<string, unknown>;
    /** Optional Living Plan ID for Talk-to-Execute bridge */
    planId?: string;
    /** User rating for the agent's response (1-5) */
    rating?: number;
}

export interface AgentThought {
    id: string;
    text: string;
    timestamp: number;
    type?: 'tool' | 'logic' | 'error' | 'tool_result';
    toolName?: string;
}

export interface ConversationSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: AgentMessage[];
    participants: string[]; // Agent IDs
    isArchived?: boolean;
    /** Background job namespace, e.g. "cron:album-rollout". Namespaced sessions
     *  are isolated from the main UI thread and managed by the WCP lock system. */
    namespace?: string;
    /** Where this session originated from (desktop, mobile-remote, etc.) */
    source?: MessageSource;
    /** The ID of the project this session is associated with */
    projectId?: string;
    /** New sessions store messages in append-only child documents. */
    messageStorage?: 'array' | 'subcollection';
}

export interface AgentSessionSlice {
    // Legacy mapping (computed/synced from activeSession)
    agentHistory: AgentMessage[];

    // Session State
    sessions: Record<string, ConversationSession>;
    activeSessionId: string | null;
    lastDirectSessionId: string | null;
    sessionsPaginationLoading: boolean;
    hasMoreSessions: boolean;
    sessionsPaginationCursor?: SessionPageCursor;

    // Session Actions
    createSession: (title?: string, initialAgents?: string[], namespace?: string, projectId?: string) => string;
    setActiveSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    updateSessionTitle: (sessionId: string, title: string) => void;
    updateSessionProject: (sessionId: string, projectId: string | null) => void;
    archiveSession: (sessionId: string) => void;
    unarchiveSession: (sessionId: string) => void;

    // Message Actions
    addAgentMessage: (msg: AgentMessage) => void;
    addMessageToSession: (sessionId: string, msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: (sessionId?: string) => void;

    // Participant Actions
    addParticipant: (sessionId: string, agentId: string) => void;

    // Persistence
    loadSessions: () => Promise<void>;
    loadMoreSessions: () => Promise<void>;
}

/**
 * Factory that returns the session/message portion of the agent slice.
 */
export function buildAgentSessionState(
    set: Parameters<StateCreator<AgentSessionSlice>>[0],
    get: Parameters<StateCreator<AgentSessionSlice>>[1]
): AgentSessionSlice {
    const subscribeToActiveMessages = (sessionId: string) => {
        if (agentMessagesUnsubscribe) agentMessagesUnsubscribe();
        agentMessagesUnsubscribe = null;
        import('@/services/agent/SessionService').then(({ sessionService }) => {
            agentMessagesUnsubscribe = sessionService.subscribeToMessages(sessionId, (messages) => {
                set(state => {
                    const session = state.sessions[sessionId];
                    if (!session) return {};
                    // Keep legacy documents readable until their messages have
                    // been migrated, but child documents are authoritative once
                    // one exists.
                    const synchronizedMessages = session.messageStorage === 'subcollection'
                        ? messages
                        : (messages.length > 0 ? messages : session.messages);
                    const recoveredMessages = recoverInterruptedMessages(sessionId, synchronizedMessages);
                    const nextMessages = mergePendingMessages(
                        sessionId,
                        session.messages,
                        recoveredMessages
                    );
                    return {
                        sessions: { ...state.sessions, [sessionId]: { ...session, messages: nextMessages } },
                        ...(state.activeSessionId === sessionId ? { agentHistory: nextMessages } : {}),
                    };
                });
            }, error => logger.error('[AgentSlice] Message subscription failed:', error));
        }).catch(error => logger.error('[AgentSlice] Failed to start message subscription:', error));
    };

    return {
        agentHistory: [],
        sessions: {},
        activeSessionId: null,
        lastDirectSessionId: null,
        sessionsPaginationLoading: false,
        hasMoreSessions: true,
        sessionsPaginationCursor: undefined,

        createSession: (title = 'New Conversation', initialAgents?: string[], namespace?: string, projectId?: string) => {
            const state = get() as any;
            const resolvedProjectId = projectId || state.currentProjectId;

            let resolvedAgents = initialAgents;
            if (!resolvedAgents) {
                const project = state.projects?.find((p: any) => p.id === resolvedProjectId);
                resolvedAgents = project?.defaultParticipants || ['indii'];
            }

            const id = crypto.randomUUID();
            const newSession: ConversationSession = {
                id,
                title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: [],
                participants: resolvedAgents,
                ...(namespace ? { namespace } : {}),
                ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
            };

            set(state => {
                const update: Partial<AgentSessionSlice> = {
                    sessions: { ...state.sessions, [id]: newSession },
                };
                // Background (namespaced) sessions must NOT hijack the foreground UI
                if (!namespace) {
                    update.activeSessionId = id;
                    update.agentHistory = [];
                }
                return update;
            });

            // Persist the new session immediately
            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.createSession(newSession)
                    .then(() => { if (!namespace) subscribeToActiveMessages(id); })
                    .catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
            });

            return id;
        },

        setActiveSession: (sessionId) => {
            const { sessions } = get();
            if (sessions[sessionId]) {
                set({
                    activeSessionId: sessionId,
                    agentHistory: sessions[sessionId].messages,
                });
                subscribeToActiveMessages(sessionId);
            }
        },

        deleteSession: (sessionId) => set(state => {
            const newSessions = { ...state.sessions };
            delete newSessions[sessionId];
            pendingMessageIds.delete(sessionId);

            // Persist the deletion
            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.deleteSession(sessionId).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
            });

            // If deleting active session, fallback to another or null
            let newActiveId = state.activeSessionId;
            let newHistory = state.agentHistory;

            if (state.activeSessionId === sessionId) {
                const remainingIds = Object.keys(newSessions);
                if (remainingIds.length > 0) {
                    newActiveId = remainingIds[0]!;
                    newHistory = newSessions[newActiveId]!.messages;
                } else {
                    newActiveId = null;
                    newHistory = [];
                }
            }

            return {
                sessions: newSessions,
                activeSessionId: newActiveId,
                agentHistory: newHistory
            };
        }),

        updateSessionTitle: (sessionId, title) => {
            set(state => {
                const session = state.sessions[sessionId];
                if (!session) return state;

                const updated = { ...session, title, updatedAt: Date.now() };
                return { sessions: { ...state.sessions, [sessionId]: updated } };
            });

            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(sessionId, { title, updatedAt: Date.now() })
                    .catch(e => logger.error('[AgentSlice] Session title update failed:', e));
            });
        },

        updateSessionProject: (sessionId, projectId) => {
            set(state => {
                const session = state.sessions[sessionId];
                if (!session) return state;

                const updated = { ...session, projectId: projectId || undefined, updatedAt: Date.now() };
                return { sessions: { ...state.sessions, [sessionId]: updated } };
            });

            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(sessionId, { projectId: projectId || undefined, updatedAt: Date.now() })
                    .catch(e => logger.error('[AgentSlice] Session project update failed:', e));
            });
        },

        archiveSession: (sessionId) => {
            set(state => {
                const session = state.sessions[sessionId];
                if (!session) return state;

                const updated = { ...session, isArchived: true, updatedAt: Date.now() };
                return { sessions: { ...state.sessions, [sessionId]: updated } };
            });

            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(sessionId, { isArchived: true, updatedAt: Date.now() })
                    .catch(e => logger.error('[AgentSlice] Session archive update failed:', e));
            });
        },

        unarchiveSession: (sessionId) => {
            set(state => {
                const session = state.sessions[sessionId];
                if (!session) return state;

                const updated = { ...session, isArchived: false, updatedAt: Date.now() };
                return { sessions: { ...state.sessions, [sessionId]: updated } };
            });

            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(sessionId, { isArchived: false, updatedAt: Date.now() })
                    .catch(e => logger.error('[AgentSlice] Session unarchive update failed:', e));
            });
        },

        addAgentMessage: (msg) => set((state) => {
            // If no session exists, create one implicitly (safety net)
            let currentSessionId = state.activeSessionId;
            const sessions = { ...state.sessions };
            let isNewSession = false;

            if (!currentSessionId) {
                currentSessionId = crypto.randomUUID();
                isNewSession = true;
                sessions[currentSessionId] = {
                    id: currentSessionId,
                    title: 'New Conversation',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    messages: [],
                    messageStorage: 'subcollection',
                    participants: ['indii']
                };
            }

            const currentSession = sessions[currentSessionId]!;
            const updatedSession = {
                ...currentSession,
                messages: [...currentSession.messages, msg],
                updatedAt: Date.now()
            };
            markMessagePending(currentSessionId, msg.id);

            // Serialize the append ahead of every later update for this response.
            enqueueMessageWrite(currentSessionId, msg.id, async () => {
                const { sessionService } = await import('@/services/agent/SessionService');
                if (isNewSession) {
                    await sessionService.createSession(currentSession);
                    subscribeToActiveMessages(currentSessionId);
                }
                await sessionService.appendMessage(currentSessionId, msg);
            }, 'Session persistence');

            return {
                sessions: { ...sessions, [currentSessionId]: updatedSession },
                activeSessionId: currentSessionId,
                agentHistory: updatedSession.messages
            };
        }),

        updateAgentMessage: (id, updates) => set((state) => {
            if (!state.activeSessionId) return {};

            const session = state.sessions[state.activeSessionId]!;
            const updatedMessages = session!.messages.map(msg =>
                msg.id === id ? { ...msg, ...updates } : msg
            );

            const sessionId = state.activeSessionId;
            const persistUpdate = async () => {
                const { sessionService } = await import('@/services/agent/SessionService');
                await sessionService.updateMessage(sessionId, id, updates);
            };

            // Metadata carries response/assignment correlation and must follow
            // the initial append and earlier metadata transitions exactly.
            // Streaming text-only updates stay concurrent to avoid building a
            // token-by-token persistence backlog.
            if ('metadata' in updates) {
                enqueueMessageWrite(sessionId, id, persistUpdate, 'Message metadata update');
            } else {
                void persistMessageWrite(persistUpdate, 'Message update');
            }

            return {
                sessions: {
                    ...state.sessions,
                    [state.activeSessionId]: {
                        ...session,
                        messages: updatedMessages
                    }
                },
                agentHistory: updatedMessages
            };
        }),

        addMessageToSession: (sessionId, msg) => set((state) => {
            const sessions = { ...state.sessions };
            const session = sessions[sessionId];
            if (!session) return {};

            const updatedSession = {
                ...session,
                messages: [...session.messages, msg],
                updatedAt: Date.now()
            };
            markMessagePending(sessionId, msg.id);

            enqueueMessageWrite(sessionId, msg.id, async () => {
                const { sessionService } = await import('@/services/agent/SessionService');
                await sessionService.appendMessage(sessionId, msg);
            }, 'Add message');

            const update: Partial<AgentSessionSlice> = {
                sessions: { ...state.sessions, [sessionId]: updatedSession }
            };

            if (sessionId === state.activeSessionId) {
                update.agentHistory = updatedSession.messages;
            }

            return update;
        }),

        clearAgentHistory: (sessionId) => set(state => {
            const targetSessionId = sessionId || state.activeSessionId;
            if (!targetSessionId || !state.sessions[targetSessionId]) return {};
            pendingMessageIds.delete(targetSessionId);

            // Persist the cleared history with retry logic
            const persistClear = async (attempt = 1) => {
                try {
                    const { sessionService } = await import('@/services/agent/SessionService');
                    await sessionService.clearMessages(targetSessionId);
                } catch (e) {
                    if (attempt < 3) {
                        logger.warn(`[AgentSlice] Clear history attempt ${attempt} failed, retrying...`, e);
                        setTimeout(() => persistClear(attempt + 1), 1000 * attempt);
                    } else {
                        logger.error('[AgentSlice] Clear history failed after 3 attempts:', e);
                    }
                }
            };
            persistClear();

            const update: Partial<AgentSessionSlice> = {
                sessions: {
                    ...state.sessions,
                    [targetSessionId]: {
                        ...state.sessions[targetSessionId]!,
                        messages: []
                    }
                }
            };

            if (targetSessionId === state.activeSessionId) {
                update.agentHistory = [];
            }

            return update;
        }),

        addParticipant: (sessionId, agentId) => set(state => {
            const session = state.sessions[sessionId];
            if (!session || session.participants.includes(agentId)) return {};

            const newParticipants = [...session.participants, agentId];

            // Persist with retry logic
            const persistParticipant = async (attempt = 1) => {
                try {
                    const { sessionService } = await import('@/services/agent/SessionService');
                    await sessionService.updateSession(sessionId, { participants: newParticipants });
                } catch (e) {
                    if (attempt < 3) {
                        logger.warn(`[AgentSlice] Add participant attempt ${attempt} failed, retrying...`, e);
                        setTimeout(() => persistParticipant(attempt + 1), 1000 * attempt);
                    } else {
                        logger.error('[AgentSlice] Add participant failed after 3 attempts:', e);
                    }
                }
            };
            persistParticipant();

            return {
                sessions: {
                    ...state.sessions,
                    [sessionId]: {
                        ...session,
                        participants: newParticipants
                    }
                }
            };
        }),

        loadSessions: async () => {
            const { sessionService } = await import('@/services/agent/SessionService');

            let hasDoneInitialCleanup = false;

            try {
                if (agentSessionsUnsubscribe) {
                    agentSessionsUnsubscribe();
                    agentSessionsUnsubscribe = null;
                }
                const unsubscribe = sessionService.subscribeToSessions((sessions) => {
                    const sessionMap: Record<string, ConversationSession> = {};

                    sessions.forEach(s => {
                        // Ensure messages is always an array
                        if (!s.messages) s.messages = [];
                        
                        if (!hasDoneInitialCleanup) {
                            let mutated = false;
                            s.messages.forEach(msg => {
                                if (msg.isStreaming) {
                                    msg.isStreaming = false;
                                    msg.text = (msg.text || '') + '\n\n*(Generation interrupted by page reload)*';
                                    mutated = true;
                                }
                            });
                            
                            // If we fixed broken streams, silently persist the fix back to Firestore
                            if (mutated) {
                                sessionService.updateSession(s.id, { messages: s.messages }).catch(e => 
                                    logger.error('[AgentSlice] Failed to persist stream cleanup:', e)
                                );
                            }
                        }

                        sessionMap[s.id] = s;
                    });
                    
                    hasDoneInitialCleanup = true;

                    set(state => {
                        // Session-list documents do not carry the authoritative message
                        // stream once a session has migrated to child documents. Preserve
                        // the active local view until subscribeToMessages supplies its next
                        // snapshot; replacing it with the parent document's stale/empty
                        // `messages` array makes in-flight responses and their correlation
                        // metadata disappear from the UI.
                        const mergedSessions = { ...state.sessions };
                        Object.entries(sessionMap).forEach(([sessionId, remoteSession]) => {
                            const localSession = state.sessions[sessionId];
                            const usesMessageSubcollection =
                                remoteSession.messageStorage === 'subcollection' ||
                                localSession?.messageStorage === 'subcollection';

                            mergedSessions[sessionId] = {
                                ...localSession,
                                ...remoteSession,
                                ...(usesMessageSubcollection && localSession
                                    ? { messages: localSession.messages }
                                    : {}),
                            };
                        });

                        // If we already have an active session, keep it, otherwise set latest
                        let activeId = state.activeSessionId;

                        // If the active session was deleted remotely, fallback to the most recent one
                        if (activeId && !mergedSessions[activeId] && sessions.length > 0) {
                            activeId = sessions[0]!.id;
                        } else if (!activeId && sessions.length > 0) {
                            activeId = sessions[0]!.id; // Most recent due to sort
                        }

                        return {
                            sessions: mergedSessions,
                            activeSessionId: activeId,
                            agentHistory: activeId && mergedSessions[activeId] ? mergedSessions[activeId]!.messages : []
                        };
                    });
                    const activeId = get().activeSessionId;
                    if (activeId) subscribeToActiveMessages(activeId);
                }, (error) => {
                    logger.error('[AgentSlice] Sessions subscription error:', error);
                });

                agentSessionsUnsubscribe = unsubscribe;
            } catch (error: unknown) {
                logger.error('[AgentSlice] Failed to initialize sessions subscription:', error);
            }
        },
        loadMoreSessions: async () => {
            const state = get() as any;
            if (state.sessionsPaginationLoading || !state.hasMoreSessions) return;

            set({ sessionsPaginationLoading: true });
            try {
                const { sessionService } = await import('@/services/agent/SessionService');
                const { sessions: moreSessions, nextCursor } = await sessionService.getSessionsForUserPaginated(
                    state.sessionsPaginationCursor,
                    50
                );

                // Determine if there are more sessions to load
                const hasMore = !!nextCursor;

                set(st => ({
                    sessions: { ...st.sessions, ...Object.fromEntries(moreSessions.map(s => [s.id, s])) },
                    sessionsPaginationCursor: nextCursor,
                    hasMoreSessions: hasMore,
                    sessionsPaginationLoading: false
                }));
            } catch (err: unknown) {
                logger.error('[AgentSlice] Load more sessions failed:', err);
                set({ sessionsPaginationLoading: false });
            }
        },
    };
}

export function resetAgentSessionsListener() {
    if (agentSessionsUnsubscribe) {
        agentSessionsUnsubscribe();
        agentSessionsUnsubscribe = null;
    }
}
