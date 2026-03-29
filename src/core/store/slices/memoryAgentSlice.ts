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
    MemorySource,
} from '@/types/AlwaysOnMemory';
import type { Directive } from '@/services/directive/DirectiveTypes';
import { DirectiveService } from '@/services/directive/DirectiveService';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { HandshakeRequest } from '@/services/agent/governance/DigitalHandshake';

export interface MemoryInboxItem extends HandshakeRequest {
    id: string;
    type: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: Timestamp;
}

// ============================================================================
// STATE
// ============================================================================

export interface MemoryAgentSlice {
    // Data
    alwaysOnMemories: AlwaysOnMemory[];
    alwaysOnInsights: ConsolidationInsight[];
    alwaysOnIngestionEvents: IngestionEvent[];
    alwaysOnEngineStatus: AlwaysOnEngineStatus;
    activeDirectives: Directive[];
    memoryInboxItems: MemoryInboxItem[];

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
    loadDirectives: (userId: string) => Promise<void>;
    loadMemoryInbox: (userId: string) => Promise<void>;
    updateMemoryInboxItemStatus: (userId: string, itemId: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
    refreshAlwaysOnEngineStatus: (userId: string) => Promise<void>;
    startMemoryEngine: (userId: string) => void;
    stopMemoryEngine: () => void;
    ingestMemoryText: (userId: string, text: string, source?: MemorySource) => Promise<string>;
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
    activeDirectives: [],
    memoryInboxItems: [],

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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load memories:', error);
        }
    },

    loadAlwaysOnInsights: async (userId: string) => {
        try {
            const insights = await alwaysOnMemoryEngine.getInsights(userId);
            set({ alwaysOnInsights: insights });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load insights:', error);
        }
    },

    loadDirectives: async (userId: string) => {
        try {
            const directives = await DirectiveService.getAllDirectives(userId);
            set({ activeDirectives: directives });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load directives:', error);
        }
    },

    loadMemoryInbox: async (userId: string) => {
        try {
            const inboxRef = collection(db, `users/${userId}/memoryInbox`);
            const snapshot = await getDocs(inboxRef);
            const items = snapshot.docs
                .map(docSnap => {
                    const data = docSnap.data();
                    if (!data['directiveId'] || !data['actionDescription'] || !data['status']) {
                        logger.warn('[MemoryAgentSlice] Malformed inbox item, skipping:', docSnap.id);
                        return null;
                    }
                    return { id: docSnap.id, ...data } as MemoryInboxItem;
                })
                .filter((item): item is MemoryInboxItem => item !== null);
            // Sort by pending first, then by date descending
            items.sort((a, b) => {
                if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
                if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
                return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
            });
            set({ memoryInboxItems: items });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load memory inbox:', error);
        }
    },

    updateMemoryInboxItemStatus: async (userId: string, itemId: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            const itemRef = doc(db, `users/${userId}/memoryInbox`, itemId);
            await updateDoc(itemRef, { status });

            // Reload the inbox
            await get().loadMemoryInbox(userId);
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to update memory inbox item:', error);
        }
    },

    refreshAlwaysOnEngineStatus: async (userId: string) => {
        try {
            const status = await alwaysOnMemoryEngine.getStatus(userId);
            set({ alwaysOnEngineStatus: status });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to refresh status:', error);
        }
    },

    // Operations
    ingestMemoryText: async (userId: string, text: string, source?: MemorySource) => {
        try {
            const memoryId = await alwaysOnMemoryEngine.ingestText(userId, text, source || 'user_input');
            // Refresh memories list + status
            const [memories, status] = await Promise.all([
                alwaysOnMemoryEngine.getMemories(userId, { limit: 100 }),
                alwaysOnMemoryEngine.getStatus(userId),
            ]);
            set({ alwaysOnMemories: memories, alwaysOnEngineStatus: status });
            return memoryId;
        } catch (error: unknown) {
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
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Consolidation failed:', error);
            // Refresh status to clear isConsolidating flag
            try {
                const status = await alwaysOnMemoryEngine.getStatus(userId);
                set({ alwaysOnEngineStatus: status });
            } catch (_e: unknown) { /* non-blocking */ }
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
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Delete failed:', error);
        }
    },

    queryAlwaysOnMemory: async (userId: string, question: string) => {
        try {
            return await alwaysOnMemoryEngine.queryMemory(userId, question);
        } catch (error: unknown) {
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
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Clear all failed:', error);
        }
    },
});
