import { StateCreator } from 'zustand';
import { z } from 'zod';
import { SpecializedAgent } from '@/services/agent/types';
import { BatchedTask } from '@/services/agent/MaestroBatchingService';
import { logger } from '@/utils/logger';
import type { CanvasItem } from '@/modules/dashboard/components/WorkspaceCanvas';
// import { agentRegistry } from '@/services/agent/registry'; // Removed to break circular dependency

const AgentSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    color: z.string(),
    category: z.string(),
});

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
}

export interface AgentThought {
    id: string;
    text: string;
    timestamp: number;
    type?: 'tool' | 'logic' | 'error' | 'tool_result';
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
    /** Background job namespace, e.g. "cron:album-rollout". Namespaced sessions
     *  are isolated from the main UI thread and managed by the WCP lock system. */
    namespace?: string;
}

export interface AgentSlice {
    // Legacy mapping (computed/synced from activeSession)
    agentHistory: AgentMessage[];

    // Right Panel View State
    rightPanelView: 'messages' | 'archives';
    setRightPanelView: (view: 'messages' | 'archives') => void;

    // Maestro Batching State
    batchingTasks: BatchedTask[];
    addBatchTask: (task: BatchedTask) => void;
    updateBatchTask: (id: string, updates: Partial<BatchedTask>) => void;
    clearCompletedBatchTasks: () => void;

    // Session State
    sessions: Record<string, ConversationSession>;
    activeSessionId: string | null;

    // Dual-Chat Channel: 'indii' for orchestrator, 'agent' for specialists
    chatChannel: 'indii' | 'agent';

    // Provider switching: 'direct' (simple LLM chat) or 'native' (specialist agents)
    activeAgentProvider: 'direct' | 'native';

    // Knowledge Base RAG toggle: when true, inject memory + knowledge into system prompt
    isKnowledgeBaseEnabled: boolean;

    isAgentOpen: boolean;
    isCommandBarDetached: boolean;
    isCommandBarCollapsed: boolean;
    commandBarPosition: 'left' | 'center' | 'right';
    commandBarInput: string;
    commandBarAttachments: File[];
    agentMode: AgentMode;
    isAgentProcessing: boolean;
    pendingApproval: ApprovalRequest | null;

    // Window Management
    agentWindowSize: { width: number; height: number };

    // Available Agents
    availableAgents: SpecializedAgent[];
    isLoadingAgents: boolean;
    agentsError: string | null;

    // Actions
    createSession: (title?: string, initialAgents?: string[], namespace?: string) => string;
    setActiveSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    updateSessionTitle: (sessionId: string, title: string) => void;

    addAgentMessage: (msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: () => void; // Clears ACTIVE session history

    toggleAgentWindow: () => void;
    setCommandBarDetached: (detached: boolean) => void;
    setCommandBarCollapsed: (collapsed: boolean) => void;
    setCommandBarPosition: (position: 'left' | 'center' | 'right') => void;
    setCommandBarInput: (input: string) => void;
    setCommandBarAttachments: (attachments: File[]) => void;
    setAgentMode: (mode: AgentMode) => void;
    setChatChannel: (channel: 'indii' | 'agent') => void;
    setActiveAgentProvider: (provider: 'direct' | 'native') => void;
    setKnowledgeBaseEnabled: (enabled: boolean) => void;
    requestApproval: (content: string, type: string) => Promise<boolean>;
    resolveApproval: (approved: boolean) => void;
    resetCommandBar: () => void;

    addParticipant: (sessionId: string, agentId: string) => void;
    setAgentProcessing: (isProcessing: boolean) => void;
    setAgentWindowSize: (size: { width: number; height: number }) => void;
    loadSessions: () => Promise<void>;
    loadAgents: () => Promise<void>;
    // Item 407: Task queue persistence across app restarts
    persistQueueToFirestore: () => Promise<void>;
    resumeQueueFromFirestore: () => Promise<void>;

    // Canvas Items — rich media output from agent tasks
    canvasItems: CanvasItem[];
    addCanvasItem: (item: CanvasItem) => void;
    removeCanvasItem: (id: string) => void;
    clearCanvasItems: () => void;
}

export const createAgentSlice: StateCreator<AgentSlice> = (set, get) => ({
    // Initial State
    agentHistory: [],
    sessions: {},
    activeSessionId: null,
    availableAgents: [],
    isLoadingAgents: false,
    agentsError: null,
    chatChannel: 'indii', // Default to indii (main orchestrator)
    activeAgentProvider: 'direct',
    isKnowledgeBaseEnabled: true,

    canvasItems: [],

    isAgentOpen: false,
    isCommandBarDetached: false,
    isCommandBarCollapsed: false,
    commandBarPosition: (typeof window !== 'undefined' && (['left', 'center', 'right'].includes(localStorage.getItem('indiiOS_commandBarPosition') || '') ? localStorage.getItem('indiiOS_commandBarPosition') as 'left' | 'center' | 'right' : 'center')) || 'center',
    commandBarInput: '',
    commandBarAttachments: [],
    agentMode: 'assistant',
    isAgentProcessing: false,
    pendingApproval: null,
    rightPanelView: 'messages',
    setRightPanelView: (view) => set({ rightPanelView: view }),

    // Maestro Batching Initial State
    batchingTasks: [],
    addBatchTask: (task) => {
        set(state => ({ batchingTasks: [...state.batchingTasks, task] }));
        // Item 407: Persist queue so in-flight tasks survive app restart
        get().persistQueueToFirestore();
    },
    updateBatchTask: (id, updates) => set(state => ({
        batchingTasks: state.batchingTasks.map(t => t.id === id ? { ...t, ...updates } : t)
    })),
    clearCompletedBatchTasks: () => set(state => ({
        batchingTasks: state.batchingTasks.filter(t => t.status !== 'completed' && t.status !== 'error')
    })),

    agentWindowSize: { width: 500, height: 800 },

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
            const update: Partial<AgentSlice> = {
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
                rightPanelView: 'messages' // Automatically switch back to chat when selecting a session
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

    toggleAgentWindow: () => set((state) => ({
        isAgentOpen: !state.isAgentOpen,
    })),
    setCommandBarDetached: (detached) => set({ isCommandBarDetached: detached }),
    setCommandBarCollapsed: (collapsed) => set({ isCommandBarCollapsed: collapsed }),
    setCommandBarPosition: (position) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('indiiOS_commandBarPosition', position);
        }
        set({ commandBarPosition: position });
    },
    resetCommandBar: () => set({ isCommandBarDetached: false, isCommandBarCollapsed: false, commandBarPosition: 'center' }),
    setCommandBarInput: (input) => set({ commandBarInput: input }),
    setCommandBarAttachments: (attachments) => set({ commandBarAttachments: attachments }),
    setAgentMode: (mode) => set({ agentMode: mode }),

    setChatChannel: (channel) => set({ chatChannel: channel }),
    setActiveAgentProvider: (provider) => set({ activeAgentProvider: provider }),
    setKnowledgeBaseEnabled: (enabled) => set({ isKnowledgeBaseEnabled: enabled }),

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

    setAgentProcessing: (isProcessing) => set({ isAgentProcessing: isProcessing }),
    setAgentWindowSize: (size) => set({ agentWindowSize: size }),

    addCanvasItem: (item) => set((state) => ({ canvasItems: [...state.canvasItems, item] })),
    removeCanvasItem: (id) => set((state) => ({ canvasItems: state.canvasItems.filter((c) => c.id !== id) })),
    clearCanvasItems: () => set({ canvasItems: [] }),

    loadSessions: async () => {
        // Item 407: Resume any in-flight tasks that survived an app restart
        get().resumeQueueFromFirestore();

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
        } catch (error) {
            logger.error('[AgentSlice] Failed to initialize sessions subscription:', error);
        }
    },

    // Item 407: Persist task queue to Firestore so in-progress work survives app restarts
    persistQueueToFirestore: async () => {
        try {
            const { auth, db } = await import('@/services/firebase');
            const { collection, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            const { batchingTasks } = get();
            const pendingTasks = batchingTasks.filter(t => t.status === 'pending' || t.status === 'processing');

            const queueRef = doc(collection(db, 'users', uid, 'agent_queue'), 'queue');
            await setDoc(queueRef, {
                tasks: pendingTasks,
                savedAt: serverTimestamp(),
            });
            logger.info(`[AgentSlice] Persisted ${pendingTasks.length} queue tasks to Firestore`);
        } catch (err) {
            logger.warn('[AgentSlice] Queue persistence failed:', err);
        }
    },

    resumeQueueFromFirestore: async () => {
        try {
            const { auth, db } = await import('@/services/firebase');
            const { collection, doc, getDoc, deleteDoc } = await import('firebase/firestore');
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            const queueRef = doc(collection(db, 'users', uid, 'agent_queue'), 'queue');
            const snap = await getDoc(queueRef);
            if (!snap.exists()) return;

            const data = snap.data() as { tasks?: BatchedTask[] };
            const pendingTasks = (data.tasks ?? []).filter(t => t.status === 'pending');

            if (pendingTasks.length > 0) {
                set(state => ({
                    batchingTasks: [
                        ...state.batchingTasks,
                        // Avoid duplicates by filtering out tasks already in queue
                        ...pendingTasks.filter(t => !state.batchingTasks.find(existing => existing.id === t.id))
                    ]
                }));
                logger.info(`[AgentSlice] Resumed ${pendingTasks.length} pending tasks from Firestore queue`);
            }

            // Clean up the persisted queue after loading
            await deleteDoc(queueRef);
        } catch (err) {
            logger.warn('[AgentSlice] Queue resume failed:', err);
        }
    },

    loadAgents: async () => {
        set({ isLoadingAgents: true, agentsError: null });
        try {
            // Simulate async if needed, or just handle sync failure
            const { agentRegistry } = await import('@/services/agent/registry');
            const agents = agentRegistry.getAll();

            // Validate data integrity
            const validatedAgents = agents.filter(agent => {
                const result = AgentSchema.safeParse(agent);
                if (!result.success) {
                    logger.warn(`[AgentSlice] Invalid agent data for ${agent.id}:`, result.error);
                    return false;
                }
                return true;
            });

            set({ availableAgents: validatedAgents });
        } catch (error) {
            logger.error('[AgentSlice] Failed to load agents:', error);
            set({ agentsError: (error as Error).message || 'Failed to load agents' });
        } finally {
            set({ isLoadingAgents: false });
        }
    }
});
