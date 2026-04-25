import { StateCreator } from 'zustand';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import type { GraphExecutionState, AgentGraph } from '@/services/agent/types';

// Re-using the types defined in the shared firebase package
export enum AgentTaskStateEnum {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export interface AgentTaskNode {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
    state: AgentTaskStateEnum;
    result?: unknown;
    error?: string;
    dependencies: string[];
}

export interface AgentTaskGraph {
    taskId: string;
    status: AgentTaskStateEnum;
    nodes: Record<string, AgentTaskNode>;
    createdAt: number;
    updatedAt: number;
}

export interface AgentOrchestrationSlice {
    // Legacy/Other
    activeGraphs: Record<string, AgentTaskGraph>;
    
    // Phase 4: Dynamic Graph Orchestration
    activeGraphExecution: GraphExecutionState | null;
    activeGraphDefinition: AgentGraph | null;
    
    startListeningToGraph: (taskId: string) => Promise<void>;
    stopListeningToGraph: (taskId: string) => void;

    // Phase 4 Listeners
    startListeningToGraphExecution: (executionId: string) => Promise<void>;
    stopListeningToGraphExecution: () => void;
    setActiveGraphDefinition: (graph: AgentGraph | null) => void;
    setActiveGraphExecution: (execution: GraphExecutionState | null) => void;
}

const graphListeners: Record<string, Unsubscribe> = {};
let activeExecutionListener: Unsubscribe | null = null;

export const buildAgentOrchestrationState: (
    set: Parameters<StateCreator<AgentOrchestrationSlice>>[0],
    get: Parameters<StateCreator<AgentOrchestrationSlice>>[1]
) => AgentOrchestrationSlice = (set, get) => ({
    activeGraphs: {},
    activeGraphExecution: null,
    activeGraphDefinition: null,

    startListeningToGraph: async (taskId: string) => {
        if (graphListeners[taskId]) {
            console.warn(`[AgentOrchestrationSlice] Already listening to graph: ${taskId}`);
            return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) {
            console.warn('[AgentOrchestrationSlice] Cannot listen to graph without authenticated user.');
            return;
        }

        console.info(`[AgentOrchestrationSlice] Starting listener for legacy graph: ${taskId}`);
        const graphRef = doc(db, 'agent_tasks', taskId);

        const unsubscribe = onSnapshot(
            graphRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as AgentTaskGraph;
                    set((state) => ({
                        activeGraphs: {
                            ...state.activeGraphs,
                            [taskId]: data
                        }
                    }));
                } else {
                    console.warn(`[AgentOrchestrationSlice] Graph document missing or deleted: ${taskId}`);
                    set((state) => {
                        const nextGraphs = { ...state.activeGraphs };
                        delete nextGraphs[taskId];
                        return { activeGraphs: nextGraphs };
                    });
                }
            },
            (error) => {
                console.error(`[AgentOrchestrationSlice] Firestore listener error for ${taskId}:`, error);
            }
        );

        graphListeners[taskId] = unsubscribe;
    },

    stopListeningToGraph: (taskId: string) => {
        if (graphListeners[taskId]) {
            console.info(`[AgentOrchestrationSlice] Stopping listener for graph: ${taskId}`);
            graphListeners[taskId]();
            delete graphListeners[taskId];

            set((state) => {
                const nextGraphs = { ...state.activeGraphs };
                delete nextGraphs[taskId];
                return { activeGraphs: nextGraphs };
            });
        }
    },

    // Phase 4: Graph-Based Orchestration Methods
    
    setActiveGraphDefinition: (graph) => set({ activeGraphDefinition: graph }),
    
    setActiveGraphExecution: (execution) => set({ activeGraphExecution: execution }),

    startListeningToGraphExecution: async (executionId: string) => {
        if (activeExecutionListener) {
            console.info('[AgentOrchestrationSlice] Stopping existing active graph execution listener.');
            activeExecutionListener();
            activeExecutionListener = null;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) {
            console.warn('[AgentOrchestrationSlice] Cannot listen to graph execution without authenticated user.');
            return;
        }

        console.info(`[AgentOrchestrationSlice] Starting listener for graph execution: ${executionId}`);
        // Path: users/{userId}/graphExecutions/{id}
        const executionRef = doc(db, 'users', uid, 'graphExecutions', executionId);

        activeExecutionListener = onSnapshot(
            executionRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as GraphExecutionState;
                    set({ activeGraphExecution: data });
                } else {
                    console.warn(`[AgentOrchestrationSlice] Graph execution missing or deleted: ${executionId}`);
                    set({ activeGraphExecution: null });
                }
            },
            (error) => {
                console.error(`[AgentOrchestrationSlice] Firestore listener error for execution ${executionId}:`, error);
            }
        );
    },

    stopListeningToGraphExecution: () => {
        if (activeExecutionListener) {
            console.info('[AgentOrchestrationSlice] Stopping active graph execution listener.');
            activeExecutionListener();
            activeExecutionListener = null;
            set({ activeGraphExecution: null });
        }
    }
});
