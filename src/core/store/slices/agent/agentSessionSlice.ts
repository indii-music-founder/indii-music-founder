import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';

export type MessageSource = 'desktop' | 'mobile-remote' | 'background' | 'api';

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
}

export interface AgentSessionSlice {
    // Legacy mapping (computed/synced from activeSession)
    agentHistory: AgentMessage[];

    // Session State
    sessions: Record<string, ConversationSession>;
    activeSessionId: string | null;

    // Session Actions
    createSession: (title?: string, initialAgents?: string[], namespace?: string) => string;
    setActiveSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    updateSessionTitle: (sessionId: string, title: string) => void;

    // Message Actions
    addAgentMessage: (msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: () => void;

    // Participant Actions
    addParticipant: (sessionId: string, agentId: string) => void;

    // Persistence
    loadSessions: () => Promise<void>;
}

/**
 * Factory that returns the session/message portion of the agent slice.
 */
export function buildAgentSessionState(
    set: Parameters<StateCreator<AgentSessionSlice>>[0],
    get: Parameters<StateCreator<AgentSessionSlice>>[1]
): AgentSessionSlice {
    return {
        agentHistory: [],
        sessions: {},
        activeSessionId: null,

        createSession: (title = 'New Conversation', initialAgents = ['indii'], namespace?: string) => {
            const id = crypto.randomUUID();
            const newSession: ConversationSession = {
                id,
                title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: [],
                participants: initialAgents,
                ...(namespace ? { namespace } : {}),
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
                sessionService.createSession(newSession).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
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
            }
        },

        deleteSession: (sessionId) => set(state => {
            const newSessions = { ...state.sessions };
            delete newSessions[sessionId];

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
            set(state => ({
                sessions: {
                    ...state.sessions,
                    [sessionId]: { ...state.sessions[sessionId]!, title }
                }
            }));

            // Persist the title change
            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(sessionId, { title }).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
            });
        },

        addAgentMessage: (msg) => set((state) => {
            // If no session exists, create one implicitly (safety net)
            let currentSessionId = state.activeSessionId;
            const sessions = { ...state.sessions };

            if (!currentSessionId) {
                currentSessionId = crypto.randomUUID();
                sessions[currentSessionId] = {
                    id: currentSessionId,
                    title: 'New Conversation',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    messages: [],
                    participants: ['indii']
                };
            }

            const currentSession = sessions[currentSessionId]!;
            const updatedSession = {
                ...currentSession,
                messages: [...currentSession.messages, msg],
                updatedAt: Date.now()
            };

            // Persist the updated session messages
            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(currentSessionId, { messages: updatedSession.messages }).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
            });

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

            // Persist the updated messages
            import('@/services/agent/SessionService').then(({ sessionService }) => {
                if (state.activeSessionId) {
                    sessionService.updateSession(state.activeSessionId, { messages: updatedMessages }).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
                }
            });

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

        clearAgentHistory: () => set(state => {
            if (!state.activeSessionId) return {};

            // Persist the cleared history
            import('@/services/agent/SessionService').then(({ sessionService }) => {
                if (state.activeSessionId) {
                    sessionService.updateSession(state.activeSessionId, { messages: [] }).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
                }
            });

            return {
                sessions: {
                    ...state.sessions,
                    [state.activeSessionId]: {
                        ...state.sessions[state.activeSessionId]!,
                        messages: []
                    }
                },
                agentHistory: []
            };
        }),

        addParticipant: (sessionId, agentId) => set(state => {
            const session = state.sessions[sessionId];
            if (!session || session.participants.includes(agentId)) return {};

            const newParticipants = [...session.participants, agentId];

            import('@/services/agent/SessionService').then(({ sessionService }) => {
                sessionService.updateSession(sessionId, { participants: newParticipants }).catch((e) => logger.error('[AgentSlice] Session sync failed:', e));
            });

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

            try {
                const unsubscribe = sessionService.subscribeToSessions((sessions) => {
                    const sessionMap: Record<string, ConversationSession> = {};

                    sessions.forEach(s => {
                        // Ensure messages is always an array
                        if (!s.messages) s.messages = [];
                        sessionMap[s.id] = s;
                    });

                    set(state => {
                        // If we already have an active session, keep it, otherwise set latest
                        let activeId = state.activeSessionId;

                        // If the active session was deleted remotely, fallback to the most recent one
                        if (activeId && !sessionMap[activeId] && sessions.length > 0) {
                            activeId = sessions[0]!.id;
                        } else if (!activeId && sessions.length > 0) {
                            activeId = sessions[0]!.id; // Most recent due to sort
                        }

                        return {
                            sessions: sessionMap,
                            activeSessionId: activeId,
                            agentHistory: activeId && sessionMap[activeId] ? sessionMap[activeId]!.messages : []
                        };
                    });
                }, (error) => {
                    logger.error('[AgentSlice] Sessions subscription error:', error);
                });

                import('@/core/store').then(({ useStore }) => {
                    useStore.getState().registerSubscription('agent_sessions', unsubscribe);
                });
            } catch (error: unknown) {
                logger.error('[AgentSlice] Failed to initialize sessions subscription:', error);
            }
        },
    };
}
