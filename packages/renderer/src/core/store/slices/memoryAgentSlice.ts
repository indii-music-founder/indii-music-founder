/**
 * Memory Agent Zustand Slice
 *
 * Bridges the AlwaysOnMemoryEngine service to the Zustand store for UI reactivity.
 * Implements the MemoryAgentSlice interface with methods that delegate
 * to the singleton engine instance.
 */

import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import type {
    AlwaysOnMemory,
    AlwaysOnMemoryCategory,
    AlwaysOnEngineStatus,
    ConsolidationInsight,
    IngestionEvent,
    MemoryTier,
    MemorySource,
} from '@/types/AlwaysOnMemory';
import type { Directive, DirectiveStatus } from '@/services/directive/DirectiveTypes';
import { DirectiveService } from '@/services/directive/DirectiveService';
import { collection, getDocs, getDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
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
    loadAlwaysOnMemories: () => Promise<void>;
    loadAlwaysOnInsights: () => Promise<void>;
    loadDirectives: (userId: string) => Promise<void>;
    loadMemoryInbox: (userId: string) => Promise<void>;
    updateMemoryInboxItemStatus: (userId: string, itemId: string, status: 'APPROVED' | 'REJECTED') => Promise<void>;
    refreshAlwaysOnEngineStatus: () => Promise<void>;
    startMemoryEngine: (userId: string) => void;
    stopMemoryEngine: () => void;
    ingestMemoryText: (text: string, source?: MemorySource) => Promise<string>;
    triggerMemoryConsolidation: () => Promise<void>;
    deleteAlwaysOnMemory: (memoryId: string) => Promise<void>;
    queryAlwaysOnMemory: (question: string) => Promise<string>;
    clearAllAlwaysOnMemories: () => Promise<void>;
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
        if (auth.currentUser?.uid !== userId) return;
        alwaysOnMemoryEngine.start(userId).then(() => {
            alwaysOnMemoryEngine.getStatus().then(status => {
                if (auth.currentUser?.uid !== userId) return;
                set({ alwaysOnEngineStatus: status });
            }).catch(e => logger.warn('[MemoryAgentSlice] Status refresh after start failed:', e));
        }).catch(e => logger.error('[MemoryAgentSlice] Failed to start memory engine:', e));
        logger.info('[MemoryAgentSlice] 🧠 Memory engine starting');
    },

    stopMemoryEngine: () => {
        alwaysOnMemoryEngine.stop();
        set({
            alwaysOnMemories: [],
            alwaysOnInsights: [],
            alwaysOnIngestionEvents: [],
            activeDirectives: [],
            memoryInboxItems: [],
            selectedMemoryId: null,
            alwaysOnEngineStatus: { ...defaultEngineStatus },
        });
        logger.info('[MemoryAgentSlice] 🧠 Memory engine stopped');
    },

    // Data Loading
    loadAlwaysOnMemories: async () => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            const { memoryFilterCategory, memoryFilterTier } = get();

            // Fetch using the singleton's getAllMemories (filters applied client-side)
            let memories = await alwaysOnMemoryEngine.getAllMemories(200);

            if (memoryFilterCategory !== 'all') {
                memories = memories.filter(m => m.category === memoryFilterCategory);
            }
            if (memoryFilterTier !== 'all') {
                memories = memories.filter(m => m.tier === memoryFilterTier);
            }

            const searchQuery = get().memorySearchQuery?.toLowerCase();
            if (searchQuery) {
                memories = memories.filter(m =>
                    m.summary?.toLowerCase().includes(searchQuery) ||
                    m.content?.toLowerCase().includes(searchQuery) ||
                    m.topics?.some(t => t.toLowerCase().includes(searchQuery)) ||
                    m.entities?.some(e => e.name.toLowerCase().includes(searchQuery))
                );
            }

            // Sort by importance + recency
            memories.sort((a, b) => {
                const scoreA = (a.importance || 0) + ((a.accessCount || 0) * 0.01);
                const scoreB = (b.importance || 0) + ((b.accessCount || 0) * 0.01);
                return scoreB - scoreA;
            });

            if (auth.currentUser?.uid === userId) {
                set({ alwaysOnMemories: memories.slice(0, 100) });
            }
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load memories:', error);
        }
    },

    loadAlwaysOnInsights: async () => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            const insights = await alwaysOnMemoryEngine.getInsights(50);
            if (auth.currentUser?.uid === userId) set({ alwaysOnInsights: insights });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load insights:', error);
        }
    },

    loadDirectives: async (userId: string) => {
        try {
            if (auth.currentUser?.uid !== userId) return;
            const directives = await DirectiveService.getAllDirectives(userId);
            if (auth.currentUser?.uid === userId) set({ activeDirectives: directives });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load directives:', error);
        }
    },

    loadMemoryInbox: async (userId: string) => {
        try {
            if (auth.currentUser?.uid !== userId) return;
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
            if (auth.currentUser?.uid === userId) set({ memoryInboxItems: items });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to load memory inbox:', error);
        }
    },

    updateMemoryInboxItemStatus: async (userId: string, itemId: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            if (auth.currentUser?.uid !== userId) return;
            const itemRef = doc(db, `users/${userId}/memoryInbox`, itemId);
            await updateDoc(itemRef, { status });

            // Transition associated directive out of WAITING_ON_HANDSHAKE
            let directiveId = get().memoryInboxItems.find(item => item.id === itemId)?.directiveId;
            if (!directiveId) {
                const snap = await getDoc(itemRef);
                directiveId = snap.data()?.['directiveId'];
            }

            if (directiveId) {
                const targetStatus: DirectiveStatus = status === 'APPROVED' ? 'IN_PROGRESS' : 'CANCELLED';
                await DirectiveService.updateStatus(userId, directiveId, targetStatus);
            }

            // Reload the inbox
            if (auth.currentUser?.uid === userId) await get().loadMemoryInbox(userId);
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to update memory inbox item:', error);
        }
    },

    refreshAlwaysOnEngineStatus: async () => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            const status = await alwaysOnMemoryEngine.getStatus();
            if (auth.currentUser?.uid === userId) set({ alwaysOnEngineStatus: status });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Failed to refresh status:', error);
        }
    },

    // Operations
    ingestMemoryText: async (text: string, source?: MemorySource) => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return '';
            // ingest() returns a human-readable result string, not an ID
            const resultMsg = await alwaysOnMemoryEngine.ingest(text, source || 'user_input');
            if (auth.currentUser?.uid !== userId) return '';
            // Refresh memories list + status
            const [memories, status] = await Promise.all([
                alwaysOnMemoryEngine.getAllMemories(100),
                alwaysOnMemoryEngine.getStatus(),
            ]);
            if (auth.currentUser?.uid !== userId) return '';
            set({ alwaysOnMemories: memories, alwaysOnEngineStatus: status });
            return resultMsg.startsWith('📥') ? 'ok' : '';
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Ingestion failed:', error);
            return '';
        }
    },

    triggerMemoryConsolidation: async () => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            set(state => ({
                alwaysOnEngineStatus: {
                    ...state.alwaysOnEngineStatus,
                    isConsolidating: true,
                },
            }));
            await alwaysOnMemoryEngine.consolidateNow();
            if (auth.currentUser?.uid !== userId) return;
            // Refresh all data
            const [memories, insights, status] = await Promise.all([
                alwaysOnMemoryEngine.getAllMemories(100),
                alwaysOnMemoryEngine.getInsights(50),
                alwaysOnMemoryEngine.getStatus(),
            ]);
            if (auth.currentUser?.uid !== userId) return;
            set({
                alwaysOnMemories: memories,
                alwaysOnInsights: insights,
                alwaysOnEngineStatus: status,
            });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Consolidation failed:', error);
            // Refresh status to clear isConsolidating flag
            try {
                const userId = auth.currentUser?.uid;
                if (!userId) return;
                const status = await alwaysOnMemoryEngine.getStatus();
                if (auth.currentUser?.uid === userId) set({ alwaysOnEngineStatus: status });
            } catch (__e: unknown) { /* non-blocking */ }
        }
    },

    deleteAlwaysOnMemory: async (memoryId: string) => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            await alwaysOnMemoryEngine.deleteMemory(memoryId);
            if (auth.currentUser?.uid !== userId) return;
            set(state => ({
                alwaysOnMemories: state.alwaysOnMemories.filter(m => m.id !== memoryId),
                selectedMemoryId: state.selectedMemoryId === memoryId ? null : state.selectedMemoryId,
            }));
            const status = await alwaysOnMemoryEngine.getStatus();
            if (auth.currentUser?.uid === userId) set({ alwaysOnEngineStatus: status });
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Delete failed:', error);
        }
    },

    queryAlwaysOnMemory: async (question: string) => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return 'Memory engine is not available for this account.';
            const answer = await alwaysOnMemoryEngine.query(question);
            return auth.currentUser?.uid === userId
                ? answer
                : 'Memory query ended after the account changed.';
        } catch (error: unknown) {
            logger.error('[MemoryAgentSlice] Query failed:', error);
            return `Failed to query memory: ${error instanceof Error ? error.message : String(error)}`;
        }
    },

    clearAllAlwaysOnMemories: async () => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) return;
            await alwaysOnMemoryEngine.clearAll();
            if (auth.currentUser?.uid !== userId) return;
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
