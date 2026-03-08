/**
 * Memory Agent Zustand Slice
 *
 * Bridges the AlwaysOnMemoryEngine service to the Zustand store for UI reactivity.
 * Implements the MemoryAgentSlice interface with methods that delegate
 * to the singleton engine instance.
 */

import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { alwaysOnMemoryEngine } from '@/services/agent/AlwaysOnMemoryEngine';
import type {
    AlwaysOnMemory,
    AlwaysOnMemoryCategory,
    AlwaysOnEngineStatus,
    ConsolidationInsight,
    IngestionEvent,
    MemoryTier,
} from '@/types/AlwaysOnMemory';

// ============================================================================
// STATE
// ============================================================================

export interface MemoryAgentSlice {
    // Data
    alwaysOnMemories: AlwaysOnMemory[];
    alwaysOnInsights: ConsolidationInsight[];
    alwaysOnIngestionEvents: IngestionEvent[];
    alwaysOnEngineStatus: AlwaysOnEngineStatus;

    // UI State
    isMemoryDashboardOpen: boolean;
    memorySearchQuery: string;
    memoryFilterCategory: AlwaysOnMemoryCategory | 'all';
    memoryFilterTier: MemoryTier | 'all';
    selectedMemoryId: string | null;

    // Actions
    setMemoryDashboardOpen: (open: boolean) => void;
    setMemorySearchQuery: (query: string) => void;
    setMemoryFilterCategory: (category: AlwaysOnMemoryCategory | 'all') => void;
    setMemoryFilterTier: (tier: MemoryTier | 'all') => void;
    setSelectedMemoryId: (id: string | null) => void;
    loadAlwaysOnMemories: (userId: string) => Promise<void>;
    loadAlwaysOnInsights: (userId: string) => Promise<void>;
    refreshAlwaysOnEngineStatus: (userId: string) => Promise<void>;
    startMemoryEngine: (userId: string) => void;
    stopMemoryEngine: () => void;
    ingestMemoryText: (userId: string, text: string, source?: string) => Promise<string>;
    triggerMemoryConsolidation: (userId: string) => Promise<void>;
    deleteAlwaysOnMemory: (userId: string, memoryId: string) => Promise<void>;
    queryAlwaysOnMemory: (userId: string, question: string) => Promise<string>;
    clearAllAlwaysOnMemories: (userId: string) => Promise<void>;
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const defaultEngineStatus: AlwaysOnEngineStatus = {
    isRunning: false,
    isConsolidating: false,
    isIngesting: false,
    totalMemories: 0,
    unconsolidatedCount: 0,
    totalInsights: 0,
    memoriesByTier: { working: 0, shortTerm: 0, longTerm: 0, archived: 0 },
    memoriesByCategory: {},
};

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createMemoryAgentSlice: StateCreator<MemoryAgentSlice> = (set, get) => ({
    // Initial state
    alwaysOnMemories: [],
    alwaysOnInsights: [],
    alwaysOnIngestionEvents: [],
    alwaysOnEngineStatus: defaultEngineStatus,

    isMemoryDashboardOpen: false,
    memorySearchQuery: '',
    memoryFilterCategory: 'all',
    memoryFilterTier: 'all',
    selectedMemoryId: null,

    // UI Actions
    setMemoryDashboardOpen: (open) => set({ isMemoryDashboardOpen: open }),
    setMemorySearchQuery: (query) => set({ memorySearchQuery: query }),
    setMemoryFilterCategory: (category) => set({ memoryFilterCategory: category }),
    setMemoryFilterTier: (tier) => set({ memoryFilterTier: tier }),
    setSelectedMemoryId: (id) => set({ selectedMemoryId: id }),

    // Engine Lifecycle
    startMemoryEngine: (userId: string) => {
        try {
            alwaysOnMemoryEngine.start(userId);
            // Refresh status async
            alwaysOnMemoryEngine.getStatus(userId).then(status => {
                set({ alwaysOnEngineStatus: status });
            }).catch(e => logger.warn('[MemoryAgentSlice] Status refresh after start failed:', e));
            logger.info('[MemoryAgentSlice] 🧠 Memory engine started');
        } catch (error) {
            logger.error('[MemoryAgentSlice] Failed to start memory engine:', error);
        }
    },

    stopMemoryEngine: () => {
        alwaysOnMemoryEngine.stop();
        set({ alwaysOnEngineStatus: { ...defaultEngineStatus } });
        logger.info('[MemoryAgentSlice] 🧠 Memory engine stopped');
    },

    // Data Loading
    loadAlwaysOnMemories: async (userId: string) => {
        try {
            const { memoryFilterCategory, memoryFilterTier, memorySearchQuery } = get();
            const memories = await alwaysOnMemoryEngine.getMemories(userId, {
                category: memoryFilterCategory === 'all' ? undefined : memoryFilterCategory,
                tier: memoryFilterTier === 'all' ? undefined : memoryFilterTier,
                search: memorySearchQuery || undefined,
                limit: 100,
            });
            set({ alwaysOnMemories: memories });
        } catch (error) {
            logger.error('[MemoryAgentSlice] Failed to load memories:', error);
        }
    },

    loadAlwaysOnInsights: async (userId: string) => {
        try {
            const insights = await alwaysOnMemoryEngine.getInsights(userId);
            set({ alwaysOnInsights: insights });
        } catch (error) {
            logger.error('[MemoryAgentSlice] Failed to load insights:', error);
        }
    },

    refreshAlwaysOnEngineStatus: async (userId: string) => {
        try {
            const status = await alwaysOnMemoryEngine.getStatus(userId);
            set({ alwaysOnEngineStatus: status });
        } catch (error) {
            logger.error('[MemoryAgentSlice] Failed to refresh status:', error);
        }
    },

    // Operations
    ingestMemoryText: async (userId: string, text: string, source?: string) => {
        try {
            const memoryId = await alwaysOnMemoryEngine.ingestText(userId, text, (source as any) || 'user_input');
            // Refresh memories list + status
            const [memories, status] = await Promise.all([
                alwaysOnMemoryEngine.getMemories(userId, { limit: 100 }),
                alwaysOnMemoryEngine.getStatus(userId),
            ]);
            set({ alwaysOnMemories: memories, alwaysOnEngineStatus: status });
            return memoryId;
        } catch (error) {
            logger.error('[MemoryAgentSlice] Ingestion failed:', error);
            return '';
        }
    },

    triggerMemoryConsolidation: async (userId: string) => {
        try {
            set(state => ({
                alwaysOnEngineStatus: {
                    ...state.alwaysOnEngineStatus,
                    isConsolidating: true,
                },
            }));
            await alwaysOnMemoryEngine.runConsolidation(userId);
            // Refresh all data
            const [memories, insights, status] = await Promise.all([
                alwaysOnMemoryEngine.getMemories(userId, { limit: 100 }),
                alwaysOnMemoryEngine.getInsights(userId),
                alwaysOnMemoryEngine.getStatus(userId),
            ]);
            set({
                alwaysOnMemories: memories,
                alwaysOnInsights: insights,
                alwaysOnEngineStatus: status,
            });
        } catch (error) {
            logger.error('[MemoryAgentSlice] Consolidation failed:', error);
            // Refresh status to clear isConsolidating flag
            try {
                const status = await alwaysOnMemoryEngine.getStatus(userId);
                set({ alwaysOnEngineStatus: status });
            } catch (_e) { /* non-blocking */ }
        }
    },

    deleteAlwaysOnMemory: async (userId: string, memoryId: string) => {
        try {
            await alwaysOnMemoryEngine.deleteMemory(userId, memoryId);
            set(state => ({
                alwaysOnMemories: state.alwaysOnMemories.filter(m => m.id !== memoryId),
                selectedMemoryId: state.selectedMemoryId === memoryId ? null : state.selectedMemoryId,
            }));
            const status = await alwaysOnMemoryEngine.getStatus(userId);
            set({ alwaysOnEngineStatus: status });
        } catch (error) {
            logger.error('[MemoryAgentSlice] Delete failed:', error);
        }
    },

    queryAlwaysOnMemory: async (userId: string, question: string) => {
        try {
            return await alwaysOnMemoryEngine.queryMemory(userId, question);
        } catch (error) {
            logger.error('[MemoryAgentSlice] Query failed:', error);
            return `Failed to query memory: ${error instanceof Error ? error.message : String(error)}`;
        }
    },

    clearAllAlwaysOnMemories: async (userId: string) => {
        try {
            await alwaysOnMemoryEngine.clearAll(userId);
            set({
                alwaysOnMemories: [],
                alwaysOnInsights: [],
                alwaysOnIngestionEvents: [],
                alwaysOnEngineStatus: { ...defaultEngineStatus },
                selectedMemoryId: null,
            });
        } catch (error) {
            logger.error('[MemoryAgentSlice] Clear all failed:', error);
        }
    },
});
