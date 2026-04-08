import { StateCreator } from 'zustand';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

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
    activeGraphs: Record<string, AgentTaskGraph>;
    startListeningToGraph: (taskId: string) => Promise<void>;
    stopListeningToGraph: (taskId: string) => void;
}

const listeners: Record<string, Unsubscribe> = {};

export const buildAgentOrchestrationState: (
    set: Parameters<StateCreator<AgentOrchestrationSlice>>[0],
    get: Parameters<StateCreator<AgentOrchestrationSlice>>[1]
) => AgentOrchestrationSlice = (set) => ({
    activeGraphs: {},

    startListeningToGraph: async (taskId: string) => {
        if (listeners[taskId]) {
            console.warn(`[AgentOrchestrationSlice] Already listening to graph: ${taskId}`);
            return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) {
            console.warn('[AgentOrchestrationSlice] Cannot listen to graph without authenticated user.');
            return;
        }

        console.info(`[AgentOrchestrationSlice] Starting listener for graph: ${taskId}`);
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

        listeners[taskId] = unsubscribe;
    },

    stopListeningToGraph: (taskId: string) => {
        if (listeners[taskId]) {
            console.info(`[AgentOrchestrationSlice] Stopping listener for graph: ${taskId}`);
            listeners[taskId]();
            delete listeners[taskId];

            set((state) => {
                const nextGraphs = { ...state.activeGraphs };
                delete nextGraphs[taskId];
                return { activeGraphs: nextGraphs };
            });
        }
    }
});
