import { StateCreator } from 'zustand';
import { z } from 'zod';
import { SpecializedAgent } from '@/services/agent/types';
import { BatchedTask } from '@/services/agent/MaestroBatchingService';
import { logger } from '@/utils/logger';
import type { CanvasItem } from '@/modules/dashboard/components/WorkspaceCanvas';

const AgentSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    color: z.string(),
    category: z.string(),
});

export interface AgentTaskSlice {
    // Maestro Batching
    batchingTasks: BatchedTask[];
    addBatchTask: (task: BatchedTask) => void;
    updateBatchTask: (id: string, updates: Partial<BatchedTask>) => void;
    clearCompletedBatchTasks: () => void;

    // Available Agents
    availableAgents: SpecializedAgent[];
    isLoadingAgents: boolean;
    agentsError: string | null;
    loadAgents: () => Promise<void>;

    // Canvas Items — rich media output from agent tasks
    canvasItems: CanvasItem[];
    addCanvasItem: (item: CanvasItem) => void;
    removeCanvasItem: (id: string) => void;
    clearCanvasItems: () => void;

    // Task queue persistence across app restarts (Item 407)
    persistQueueToFirestore: () => Promise<void>;
    resumeQueueFromFirestore: () => Promise<void>;
}

/**
 * Factory that returns the task/batching portion of the agent slice.
 */
export function buildAgentTaskState(
    set: Parameters<StateCreator<AgentTaskSlice>>[0],
    get: Parameters<StateCreator<AgentTaskSlice>>[1]
): AgentTaskSlice {
    return {
        // Initial State
        batchingTasks: [],
        availableAgents: [],
        isLoadingAgents: false,
        agentsError: null,
        canvasItems: [],

        // Batching Actions
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

        // Canvas Actions
        addCanvasItem: (item) => set((state) => ({ canvasItems: [...state.canvasItems, item] })),
        removeCanvasItem: (id) => set((state) => ({ canvasItems: state.canvasItems.filter((c) => c.id !== id) })),
        clearCanvasItems: () => set({ canvasItems: [] }),

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
            } catch (err: unknown) {
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
            } catch (err: unknown) {
                logger.warn('[AgentSlice] Queue resume failed:', err);
            }
        },

        loadAgents: async () => {
            set({ isLoadingAgents: true, agentsError: null });
            try {
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
            } catch (error: unknown) {
                logger.error('[AgentSlice] Failed to load agents:', error);
                set({ agentsError: (error as Error).message || 'Failed to load agents' });
            } finally {
                set({ isLoadingAgents: false });
            }
        }
    };
}
