import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { toast } from '@/core/context/ToastContext';
import type { SessionPageCursor } from '@/services/agent/SessionService';

let agentSessionsUnsubscribe: (() => void) | null = null;
let agentMessagesUnsubscribe: (() => void) | null = null;
let agentMessagesSubscriptionRevision = 0;
const agentSessionRuntimeStartedAt = Date.now();
const pendingMessageIds = new Map<string, Set<string>>();
const deletingSessionIds = new Set<string>();
const sessionCreationChains = new Map<string, Promise<void>>();
const messageWriteChains = new Map<string, Promise<void>>();
const sessionClearChains = new Map<string, Promise<void>>();
const pendingTextWrites = new Map<string, { latest: string }>();
const recoveredInterruptedMessageIds = new Set<string>();
/**
 * Pins every locally-appended message to the session it was appended to.
 * Streaming agent runs can outlive a session switch; without this registry,
 * `updateAgentMessage` resolves the session from the LIVE `activeSessionId`
 * at write time, so every token/thought/completion update — and its Firestore
 * persistence — lands in whichever conversation is active when the write
 * happens. The registry makes updates follow the message, not the UI.
 */
const messageSessionRegistry = new Map<string, string>();
const INTERRUPTED_GENERATION_MARKER = '*(Generation interrupted by page reload)*';

function messageWriteKey(sessionId: string, messageId: string): string {
    return `${sessionId}:${messageId}`;
}

async function persistMessageWrite(
    operation: () => Promise<void>,
    label: string,
    onFailure?: () => void,
    onSuccess?: () => void,
): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await operation();
            onSuccess?.();
            return;
        } catch (error) {
            if (attempt === 3) {
                logger.error(`[AgentSlice] ${label} failed after 3 attempts:`, error);
                onFailure?.();
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
    onFailure?: () => void,
    onSuccess?: () => void,
): Promise<void> {
    const key = messageWriteKey(sessionId, messageId);
    const previous = messageWriteChains.get(key) ?? Promise.resolve();
    const clearBarrier = sessionClearChains.get(sessionId) ?? Promise.resolve();
    const next = Promise.all([
        previous.catch(() => undefined),
        clearBarrier.catch(() => undefined),
    ])
        .then(() => persistMessageWrite(operation, label, onFailure, onSuccess))
        .finally(() => {
            if (messageWriteChains.get(key) === next) {
                messageWriteChains.delete(key);
            }
        });
    messageWriteChains.set(key, next);
    return next;
}

function enqueueStreamingText(
    sessionId: string,
    messageId: string,
    text: string,
    setSaveStatus: (text: string, failed: boolean) => void,
): void {
    const key = messageWriteKey(sessionId, messageId);
    const pending = pendingTextWrites.get(key);
    if (pending) {
        pending.latest = text;
        return;
    }

    const entry = { latest: text };
    pendingTextWrites.set(key, entry);
    void enqueueMessageWrite(sessionId, messageId, async () => {
        const { sessionService } = await import('@/services/agent/SessionService');
        let written: string;
        do {
            written = entry.latest;
            await sessionService.updateMessage(sessionId, messageId, { text: written });
        } while (entry.latest !== written);
    }, 'Streaming message update',
    () => setSaveStatus(entry.latest, true),
    () => setSaveStatus(entry.latest, false)).finally(() => {
        if (pendingTextWrites.get(key) === entry) pendingTextWrites.delete(key);
    });
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
    attachments?: { mimeType: string; base64: string; filename?: string; loadFailed?: boolean }[];
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
    /** Local-only warning when an optimistic append could not be saved. */
    saveStatus?: 'failed';
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
    get: Parameters<StateCreator<AgentSessionSlice>>[1],
    loadSessionService: () => Promise<Pick<typeof import('@/services/agent/SessionService')['sessionService'], 'createSession' | 'appendMessage' | 'deleteSession' | 'subscribeToMessages'>> =
        () => import('@/services/agent/SessionService').then(module => module.sessionService),
): AgentSessionSlice {
    const markAppendFailed = (sessionId: string, messageId: string) => set(state => {
        if (!pendingMessageIds.get(sessionId)?.has(messageId)) return {};
        const session = state.sessions[sessionId];
        if (!session?.messages.some(message => message.id === messageId)) return {};
        const messages = session.messages.map(message =>
            message.id === messageId ? { ...message, saveStatus: 'failed' as const } : message
        );
        return {
            sessions: { ...state.sessions, [sessionId]: { ...session, messages } },
            ...(state.activeSessionId === sessionId ? { agentHistory: messages } : {}),
        };
    });

    const setUpdateSaveStatus = (sessionId: string, messageId: string, updates: Partial<AgentMessage>, failed: boolean) => set(state => {
        const session = state.sessions[sessionId];
        const message = session?.messages.find(item => item.id === messageId);
        if (!session || !message || !Object.entries(updates).every(([key, value]) =>
            Object.is(message[key as keyof AgentMessage], value))) return {};
        const messages = session.messages.map(item => item.id === messageId
            ? { ...item, saveStatus: failed ? 'failed' as const : undefined } : item);
        return {
            sessions: { ...state.sessions, [sessionId]: { ...session, messages } },
            ...(state.activeSessionId === sessionId ? { agentHistory: messages } : {}),
        };
    });

    const subscribeToActiveMessages = (sessionId: string) => {
        const revision = ++agentMessagesSubscriptionRevision;
        if (agentMessagesUnsubscribe) agentMessagesUnsubscribe();
        agentMessagesUnsubscribe = null;
        loadSessionService().then(sessionService => {
            if (revision !== agentMessagesSubscriptionRevision || get().activeSessionId !== sessionId) return;
            agentMessagesUnsubscribe = sessionService.subscribeToMessages(sessionId, (messages) => {
                if (revision !== agentMessagesSubscriptionRevision || get().activeSessionId !== sessionId) return;
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
            }, error => {
                if (revision !== agentMessagesSubscriptionRevision || get().activeSessionId !== sessionId) return;
                logger.error('[AgentSlice] Message subscription failed:', error);
                toast.error('Chat history or an attachment could not be loaded. Try reopening this conversation.');
            });
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
            const creation = loadSessionService().then(async sessionService => {
                await sessionService.createSession(newSession);
                if (!namespace && get().activeSessionId === id) subscribeToActiveMessages(id);
            });
            sessionCreationChains.set(id, creation);
            void creation.then(() => {
                if (sessionCreationChains.get(id) === creation) sessionCreationChains.delete(id);
            }, e => logger.error('[AgentSlice] Session sync failed:', e));

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

        deleteSession: (sessionId) => {
            if (deletingSessionIds.has(sessionId)) return;
            deletingSessionIds.add(sessionId);
            void loadSessionService().then(async sessionService => {
                // A pending create (including implicit creation inside a message
                // write) must settle before deletion or it can recreate the session.
                await sessionCreationChains.get(sessionId);
                const outstandingWrites = [...messageWriteChains]
                    .filter(([key]) => key.startsWith(`${sessionId}:`))
                    .map(([, write]) => write);
                await Promise.all(outstandingWrites);
                await sessionService.deleteSession(sessionId);
                pendingMessageIds.delete(sessionId);
                sessionCreationChains.delete(sessionId);
                const wasActive = get().activeSessionId === sessionId;
                set(state => {
                    const newSessions = { ...state.sessions };
                    delete newSessions[sessionId];
                    const activeSessionId = state.activeSessionId === sessionId
                        ? Object.keys(newSessions)[0] ?? null : state.activeSessionId;
                    return {
                        sessions: newSessions,
                        activeSessionId,
                        agentHistory: state.activeSessionId === sessionId
                            ? (activeSessionId ? newSessions[activeSessionId]!.messages : []) : state.agentHistory,
                    };
                });
                if (wasActive) {
                    const nextSessionId = get().activeSessionId;
                    if (nextSessionId) {
                        subscribeToActiveMessages(nextSessionId);
                    } else {
                        ++agentMessagesSubscriptionRevision;
                        agentMessagesUnsubscribe?.();
                        agentMessagesUnsubscribe = null;
                    }
                }
            }).catch(error => {
                logger.error('[AgentSlice] Session deletion failed:', error);
                toast.error('Conversation deletion could not be completed. Try again.');
            }).finally(() => deletingSessionIds.delete(sessionId));
        },

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

            messageSessionRegistry.set(msg.id, currentSessionId);

            const currentSession = sessions[currentSessionId]!;
            const updatedSession = {
                ...currentSession,
                messages: [...currentSession.messages, msg],
                updatedAt: Date.now()
            };
            markMessagePending(currentSessionId, msg.id);

            // Serialize the append ahead of every later update for this response.
            let sessionCreated = !isNewSession;
            enqueueMessageWrite(currentSessionId, msg.id, async () => {
                const sessionService = await loadSessionService();
                await sessionCreationChains.get(currentSessionId);
                if (!sessionCreated) {
                    await sessionService.createSession(currentSession);
                    sessionCreated = true;
                    if (get().activeSessionId === currentSessionId) subscribeToActiveMessages(currentSessionId);
                }
                await sessionService.appendMessage(currentSessionId, msg);
            }, 'Session persistence', () => markAppendFailed(currentSessionId, msg.id));

            return {
                sessions: { ...sessions, [currentSessionId]: updatedSession },
                activeSessionId: currentSessionId,
                agentHistory: updatedSession.messages
            };
        }),

        updateAgentMessage: (id, updates) => set((state) => {
            // A message belongs to the session it was APPENDED to, not to
            // whichever session is active when the update lands. Fall back to
            // the active session only for legacy/unregistered messages.
            const sessionId = messageSessionRegistry.get(id) ?? state.activeSessionId;
            if (!sessionId) return {};

            const session = state.sessions[sessionId];
            if (!session) return {};
            if (!session.messages.some(msg => msg.id === id)) return {};
            const updatedMessages = session.messages.map(msg =>
                msg.id === id ? { ...msg, ...updates } : msg
            );

            const persistUpdate = async () => {
                const { sessionService } = await import('@/services/agent/SessionService');
                await sessionService.updateMessage(sessionId, id, updates);
            };

            // Coalesce rapid text tokens into one ordered write lane. Other
            // fields form an ordering boundary so a final response cannot be
            // overwritten by a slower earlier token write.
            if (Object.keys(updates).length === 1 && typeof updates.text === 'string') {
                enqueueStreamingText(sessionId, id, updates.text,
                    (text, failed) => setUpdateSaveStatus(sessionId, id, { text }, failed));
            } else {
                pendingTextWrites.delete(messageWriteKey(sessionId, id));
                void enqueueMessageWrite(sessionId, id, persistUpdate, 'Message update',
                    () => setUpdateSaveStatus(sessionId, id, updates, true),
                    () => setUpdateSaveStatus(sessionId, id, updates, false));
            }

            return {
                sessions: {
                    ...state.sessions,
                    [sessionId]: {
                        ...session,
                        messages: updatedMessages
                    }
                },
                // The rendered conversation is the ACTIVE session's list; a
                // pinned update to a background session must not replace it.
                agentHistory: sessionId === state.activeSessionId
                    ? updatedMessages
                    : state.agentHistory
            };
        }),

        addMessageToSession: (sessionId, msg) => set((state) => {
            const sessions = { ...state.sessions };
            const session = sessions[sessionId];
            if (!session) return {};

            messageSessionRegistry.set(msg.id, sessionId);

            const updatedSession = {
                ...session,
                messages: [...session.messages, msg],
                updatedAt: Date.now()
            };
            markMessagePending(sessionId, msg.id);

            enqueueMessageWrite(sessionId, msg.id, async () => {
                const { sessionService } = await import('@/services/agent/SessionService');
                await sessionService.appendMessage(sessionId, msg);
            }, 'Add message', () => markAppendFailed(sessionId, msg.id));

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

            // Purge the pinning registry for the cleared session so its
            // message ids cannot be redirected after history reset.
            for (const [messageId, ownerSessionId] of messageSessionRegistry) {
                if (ownerSessionId === targetSessionId) {
                    messageSessionRegistry.delete(messageId);
                }
            }

            // Finish writes already queued for this session, then clear. New
            // appends wait for this barrier so they cannot enter the delete snapshot.
            const previousClear = sessionClearChains.get(targetSessionId) ?? Promise.resolve();
            const outstandingWrites = [...messageWriteChains]
                .filter(([key]) => key.startsWith(`${targetSessionId}:`))
                .map(([, write]) => write.catch(() => undefined));
            const clear = Promise.all([previousClear.catch(() => undefined), ...outstandingWrites])
                .then(() => persistMessageWrite(async () => {
                    const { sessionService } = await import('@/services/agent/SessionService');
                    await sessionService.clearMessages(targetSessionId);
                }, 'Clear history', () => {
                    toast.error('Chat history could not be cleared. Try Clear chat again.');
                }))
                .finally(() => {
                    if (sessionClearChains.get(targetSessionId) === clear) {
                        sessionClearChains.delete(targetSessionId);
                    }
                });
            sessionClearChains.set(targetSessionId, clear);

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
                        
                        if (!hasDoneInitialCleanup && s.messageStorage !== 'subcollection') {
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
