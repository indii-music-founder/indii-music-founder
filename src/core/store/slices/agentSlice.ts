import { StateCreator } from 'zustand';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
    isStreaming?: boolean;
    thoughts?: AgentThought[];
    agentId?: string;
}

export interface AgentThought {
    id: string;
    text: string;
    timestamp: number;
    type?: 'tool' | 'logic' | 'error';
    toolName?: string;
}

export interface ApprovalRequest {
    id: string;
    content: string;
    type: string;
    timestamp: number;
    resolve: (approved: boolean) => void;
}

export type AgentMode = 'assistant' | 'autonomous' | 'creative' | 'research';

export interface ConversationSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: AgentMessage[];
    participants: string[]; // Agent IDs
    isArchived?: boolean;
}

export interface AgentSlice {
    // Legacy mapping (computed/synced from activeSession)
    agentHistory: AgentMessage[];

    // Session State
    sessions: Record<string, ConversationSession>;
    activeSessionId: string | null;

    // Dual-Chat Channel: 'indii' for orchestrator, 'agent' for specialists
    chatChannel: 'indii' | 'agent';

    isAgentOpen: boolean;
    agentMode: AgentMode;
    isAgentProcessing: boolean;
    pendingApproval: ApprovalRequest | null;

    // Actions
    createSession: (title?: string, initialAgents?: string[]) => string;
    setActiveSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    updateSessionTitle: (sessionId: string, title: string) => void;

    addAgentMessage: (msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: () => void; // Clears ACTIVE session history

    toggleAgentWindow: () => void;
    setAgentMode: (mode: AgentMode) => void;
    setChatChannel: (channel: 'indii' | 'agent') => void;
    requestApproval: (content: string, type: string) => Promise<boolean>;
    resolveApproval: (approved: boolean) => void;

    addParticipant: (sessionId: string, agentId: string) => void;
    setAgentProcessing: (isProcessing: boolean) => void;
    loadSessions: () => Promise<void>;
}

export const createAgentSlice: StateCreator<AgentSlice> = (set, get) => ({
    // Initial State
    agentHistory: [],
    sessions: {},
    activeSessionId: null,
    chatChannel: 'indii', // Default to indii (main orchestrator)

    isAgentOpen: false,
    agentMode: 'assistant',
    isAgentProcessing: false,
    pendingApproval: null,

    createSession: (title = 'New Conversation', initialAgents = ['indii']) => {
        const id = crypto.randomUUID();
        const newSession: ConversationSession = {
            id,
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            participants: initialAgents
        };

        set(state => ({
            sessions: { ...state.sessions, [id]: newSession },
            activeSessionId: id,
            agentHistory: []
        }));

        return id;
    },

    setActiveSession: (sessionId) => {
        const { sessions } = get();
        if (sessions[sessionId]) {
            set({
                activeSessionId: sessionId,
                agentHistory: sessions[sessionId].messages
            });
        }
    },

    deleteSession: (sessionId) => set(state => {
        const newSessions = { ...state.sessions };
        delete newSessions[sessionId];

        // If deleting active session, fallback to another or null
        let newActiveId = state.activeSessionId;
        let newHistory = state.agentHistory;

        if (state.activeSessionId === sessionId) {
            const remainingIds = Object.keys(newSessions);
            if (remainingIds.length > 0) {
                newActiveId = remainingIds[0];
                newHistory = newSessions[newActiveId].messages;
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

    updateSessionTitle: (sessionId, title) => set(state => ({
        sessions: {
            ...state.sessions,
            [sessionId]: { ...state.sessions[sessionId], title }
        }
    })),

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

        const updatedSession = {
            ...sessions[currentSessionId],
            messages: [...sessions[currentSessionId].messages, msg],
            updatedAt: Date.now()
        };

        // Persist the updated session messages
        import('@/services/agent/SessionService').then(({ sessionService }) => {
            sessionService.updateSession(currentSessionId, { messages: updatedSession.messages }).catch(console.error);
        });

        return {
            sessions: { ...sessions, [currentSessionId]: updatedSession },
            activeSessionId: currentSessionId,
            agentHistory: updatedSession.messages
        };
    }),

    updateAgentMessage: (id, updates) => set((state) => {
        if (!state.activeSessionId) return {};

        const session = state.sessions[state.activeSessionId];
        const updatedMessages = session.messages.map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
        );

        // Persist the updated messages
        import('@/services/agent/SessionService').then(({ sessionService }) => {
            if (state.activeSessionId) {
                sessionService.updateSession(state.activeSessionId, { messages: updatedMessages }).catch(console.error);
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
                sessionService.updateSession(state.activeSessionId, { messages: [] }).catch(console.error);
            }
        });

        return {
            sessions: {
                ...state.sessions,
                [state.activeSessionId]: {
                    ...state.sessions[state.activeSessionId],
                    messages: []
                }
            },
            agentHistory: []
        };
    }),

    toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),

    setAgentMode: (mode) => set({ agentMode: mode }),

    setChatChannel: (channel) => set({ chatChannel: channel }),

    requestApproval: (content: string, type: string): Promise<boolean> => {
        return new Promise((resolve) => {
            const request: ApprovalRequest = {
                id: `approval-${Date.now()}`,
                content,
                type,
                timestamp: Date.now(),
                resolve,
            };
            set({ pendingApproval: request });
        });
    },

    resolveApproval: (approved: boolean) => {
        const { pendingApproval } = get();
        if (pendingApproval) {
            pendingApproval.resolve(approved);
            set({ pendingApproval: null });
        }
    },

    addParticipant: (sessionId, agentId) => set(state => {
        const session = state.sessions[sessionId];
        if (!session || session.participants.includes(agentId)) return {};

        const newParticipants = [...session.participants, agentId];

        import('@/services/agent/SessionService').then(({ sessionService }) => {
            sessionService.updateSession(sessionId, { participants: newParticipants }).catch(console.error);
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

    setAgentProcessing: (isProcessing) => set({ isAgentProcessing: isProcessing }),

    loadSessions: async () => {
        const { sessionService } = await import('@/services/agent/SessionService');
        const sessions = await sessionService.getSessionsForUser();
        const sessionMap: Record<string, ConversationSession> = {};

        sessions.forEach(s => {
            // Ensure messages is always an array
            if (!s.messages) s.messages = [];
            sessionMap[s.id] = s;
        });

        set(state => {
            // If we already have an active session, keep it, otherwise set latest
            let activeId = state.activeSessionId;
            if (!activeId && sessions.length > 0) {
                activeId = sessions[0].id; // Most recent due to sort
            }

            return {
                sessions: sessionMap,
                activeSessionId: activeId,
                agentHistory: activeId ? sessionMap[activeId].messages : []
            };
        });
    }
});
