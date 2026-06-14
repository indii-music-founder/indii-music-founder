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

const graphListeners: Record<string, Unsubscribe> = {}; // Keep the unsubscribe function directly to prevent duplicate listeners
let executionUnsubscribe: Unsubscribe | null = null;

export const buildAgentOrchestrationState: (
    set: Parameters<StateCreator<AgentOrchestrationSlice>>[0],
    get: Parameters<StateCreator<AgentOrchestrationSlice>>[1]
// eslint-disable-next-line @typescript-eslint/no-unused-vars
) => AgentOrchestrationSlice = (set, get) => ({
    activeGraphs: {},
    activeGraphExecution: null,
    activeGraphDefinition: null,

    startListeningToGraph: async (taskId: string) => {
        if (graphListeners[taskId]) {
            return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) {
            return;
        }

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
                    set((state) => {
                        const nextGraphs = { ...state.activeGraphs };
                        delete nextGraphs[taskId];
                        return { activeGraphs: nextGraphs };
                    });
                }
            },
            (_error) => {
                // Ignore or handle differently
            }
        );

        graphListeners[taskId] = unsubscribe;
    },

    stopListeningToGraph: (taskId: string) => {
        if (graphListeners[taskId]) {
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
        const uid = auth.currentUser?.uid;
        if (!uid) {
            return;
        }

        // Clean up previous listeners before starting a new one
        if (executionUnsubscribe) {
            executionUnsubscribe();
            executionUnsubscribe = null;
        }

        // Path: users/{userId}/graphExecutions/{id}
        const executionRef = doc(db, 'users', uid, 'graphExecutions', executionId);

        const unsubscribe = onSnapshot(
            executionRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as GraphExecutionState;
                    set({ activeGraphExecution: data });
                } else {
                    set({ activeGraphExecution: null });
                }
            },
            (_error) => {
                // Ignore or handle differently
            }
        );
        executionUnsubscribe = unsubscribe;
    },

    stopListeningToGraphExecution: () => {
        if (executionUnsubscribe) {
            executionUnsubscribe();
            executionUnsubscribe = null;
        }
        set({ activeGraphExecution: null });
    }
});

export function resetGraphListeners() {
    Object.keys(graphListeners).forEach(key => {
        if (graphListeners[key]) {
            graphListeners[key]!();
            delete graphListeners[key];
        }
    });
    if (executionUnsubscribe) {
        executionUnsubscribe();
        executionUnsubscribe = null;
    }
}
