import { ModuleId } from '@/core/constants';
import { HistoryItem } from '@/core/store/slices/creative';
import { Project } from '@/core/store/slices/appSlice';
import { SalesAnalyticsSchema, SalesAnalyticsData } from './schema';
import { logger } from '@/utils/logger';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';

export interface ProjectMetadata {
    id: string;
    name: string;
    type: ModuleId;
    lastModified: number;
    assetCount: number;
    thumbnail?: string;
}

export interface StorageStats {
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
    tier?: 'free' | 'pro' | 'enterprise';
    breakdown?: {
        images: number;
        videos: number;
        knowledgeBase: number;
    };
}

export interface AnalyticsData {
    totalGenerations: number;
    totalMessages: number;
    totalVideoSeconds: number;
    totalProjects: number;
    weeklyActivity: number[];
    topPromptWords: { word: string; count: number }[];
    streak: number;
}

// Local interface for the parts of the store we access
interface DashboardStoreState {
    projects: Project[];
    generatedHistory: HistoryItem[];
    agentMessages?: unknown[]; // Optional as it might be missing
    userProfile?: {
        membership?: { tier: string };
        knowledgeBase?: Array<{ content?: string; metadata?: { size?: number } }>;
    };
    addProject?: (p: ProjectMetadata) => void;
    removeProject?: (id: string) => void;
    addToHistory?: (item: HistoryItem) => void;
    removeFromHistory?: (id: string) => void;
    loadProjects: () => Promise<void>;
}

// Tier-based storage quotas in bytes
const STORAGE_QUOTAS = {
    free: 1_073_741_824,        // 1 GB
    pro: 10_737_418_240,        // 10 GB
    enterprise: 107_374_182_400  // 100 GB
};

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'as', 'be', 'this', 'that', 'from']);

interface CachedAnalytics {
    historyRef: HistoryItem[];
    agentMessagesRef: unknown[];
    projectsCount: number;
    projectsRef: Project[];
    day: number;
    data: AnalyticsData;
}

interface CachedStorageStats {
    historyRef: HistoryItem[];
    kbRef: unknown;
    tier: string;
    data: StorageStats;
}

export class DashboardService {
    private static cache = new Map<string, { data: SalesAnalyticsData; timestamp: number }>();
    private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private static analyticsCache: CachedAnalytics | null = null;
    private static storageCache: CachedStorageStats | null = null;

    static async getProjects(): Promise<ProjectMetadata[]> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState() as unknown as DashboardStoreState;

            // Bolt Binding: Load if empty
            if (!state.projects || state.projects.length === 0) {
                if (typeof state.loadProjects === 'function') {
                    await state.loadProjects();
                }
            }

            // Re-read state after async load
            const updatedState = useStore.getState() as unknown as DashboardStoreState;

            // Get projects from store
            if (updatedState.projects && updatedState.projects.length > 0) {
                return updatedState.projects.map((p) => ({
                    id: p.id,
                    name: p.name,
                    type: p.type || 'creative', // Default to creative if missing in old projects
                    lastModified: p.lastModified || p.date || 0,
                    assetCount: p.assetCount || 0,
                    thumbnail: p.thumbnail
                }));
            }

            return [];
        } catch {
            return [];
        }
    }

    static async getStorageStats(): Promise<StorageStats> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState() as unknown as DashboardStoreState;

            // Get membership tier
            const tier = state.userProfile?.membership?.tier || 'free';
            const history = state.generatedHistory || [];
            const kb = state.userProfile?.knowledgeBase || [];

            // Bolt Optimization: Check Cache
            if (
                DashboardService.storageCache &&
                DashboardService.storageCache.historyRef === history &&
                DashboardService.storageCache.kbRef === kb &&
                DashboardService.storageCache.tier === tier
            ) {
                return DashboardService.storageCache.data;
            }

            const quotaBytes = STORAGE_QUOTAS[tier as keyof typeof STORAGE_QUOTAS] || STORAGE_QUOTAS.free;

            // ─────────────────────────────────────────────────────────
            // PRIMARY: Read server-scanned usage from Firestore
            // (populated daily by trackStorageQuotas Cloud Function)
            // ─────────────────────────────────────────────────────────
            try {
                const { StorageQuotaService } = await import('@/services/StorageQuotaService');
                const serverQuota = await StorageQuotaService.getQuota();

                if (serverQuota && serverQuota.totalBytes > 0) {
                    const result: StorageStats = {
                        usedBytes: serverQuota.totalBytes,
                        quotaBytes,
                        percentUsed: Math.min((serverQuota.totalBytes / quotaBytes) * 100, 100),
                        tier: tier as 'free' | 'pro' | 'enterprise',
                        breakdown: {
                            images: 0, // Server scan doesn't separate KB from images yet
                            videos: 0,
                            knowledgeBase: 0,
                        },
                    };

                    // Use server data for video/image counts and estimate bytes proportionally
                    if (serverQuota.fileCount > 0) {
                        const videoRatio = serverQuota.videoCount / serverQuota.fileCount;
                        const imageRatio = serverQuota.imageCount / serverQuota.fileCount;
                        result.breakdown = {
                            images: Math.round(serverQuota.totalBytes * imageRatio),
                            videos: Math.round(serverQuota.totalBytes * videoRatio),
                            knowledgeBase: Math.round(serverQuota.totalBytes * (1 - videoRatio - imageRatio)),
                        };
                    }

                    // Update Cache
                    DashboardService.storageCache = {
                        historyRef: history,
                        kbRef: kb,
                        tier: tier,
                        data: result,
                    };

                    return result;
                }
            } catch {
                // Server quota not available yet — fall through to local estimation
            }

            // ─────────────────────────────────────────────────────────
            // FALLBACK: Estimate from local state (pre-first-scan or new users)
            // ─────────────────────────────────────────────────────────
            let imagesBytes = 0;
            let videosBytes = 0;

            if (state.generatedHistory) {
                state.generatedHistory.forEach((item) => {
                    // Estimate size from base64 URL or content length
                    const urlLength = item.url?.length || 0;
                    const contentPadding = (item as HistoryItem & { content?: string }).content?.length || 0;
                    const estimatedBytes = Math.floor((urlLength + contentPadding) * 0.75);

                    if (item.type === 'video') {
                        videosBytes += estimatedBytes;
                    } else {
                        imagesBytes += estimatedBytes;
                    }
                });
            }

            // Estimate Knowledge Base (stored documents)
            let kbBytes = 0;
            if (state.userProfile?.knowledgeBase) {
                state.userProfile.knowledgeBase.forEach((doc) => {
                    kbBytes += (doc.content?.length || 0) + (doc.metadata?.size || 0);
                });
            }

            // Add browser storage estimate
            let browserUsage = 0;
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                browserUsage = estimate.usage || 0;
            }

            const usedBytes = imagesBytes + videosBytes + kbBytes + browserUsage;

            const result: StorageStats = {
                usedBytes,
                quotaBytes,
                percentUsed: Math.min((usedBytes / quotaBytes) * 100, 100),
                tier: tier as 'free' | 'pro' | 'enterprise',
                breakdown: {
                    images: imagesBytes,
                    videos: videosBytes,
                    knowledgeBase: kbBytes + browserUsage,
                },
            };

            // Update Cache
            DashboardService.storageCache = {
                historyRef: history,
                kbRef: kb,
                tier: tier,
                data: result,
            };

            return result;
        } catch (_error) {
            // Silently fail in beta production build, just return empty stats
            return { usedBytes: 0, quotaBytes: STORAGE_QUOTAS.free, percentUsed: 0 };
        }
    }

    static async createProject(name: string): Promise<ProjectMetadata> {
        try {
            const { useStore } = await import('@/core/store');
            const { ProjectService } = await import('@/services/ProjectService');
            const { OrganizationService } = await import('@/services/OrganizationService');
            const { projectToMetadata } = await import('./projectTypeUtils');

            const state = useStore.getState() as unknown as DashboardStoreState;
            const orgId = OrganizationService.getCurrentOrgId() || 'personal';

            // Create in Firestore
            const newProject = await ProjectService.createProject(name, 'creative', orgId);

            // Convert Project to ProjectMetadata at the service boundary
            const metadata = projectToMetadata(newProject, 0);

            // Update local store
            if (typeof state.addProject === 'function') {
                state.addProject(metadata);
            }

            return metadata;

        } catch (error) {
            logger.error('[Dashboard] Error creating project:', error);
            throw error;
        }
    }

    static async duplicateProject(projectId: string): Promise<ProjectMetadata> {
        try {
            const { useStore } = await import('@/core/store');
            const { ProjectService } = await import('@/services/ProjectService');
            const { StorageService } = await import('@/services/StorageService');
            const { OrganizationService } = await import('@/services/OrganizationService');
            const { projectToMetadata } = await import('./projectTypeUtils');

            const state = useStore.getState() as unknown as DashboardStoreState;
            const orgId = OrganizationService.getCurrentOrgId() || 'personal';

            // 1. Get original project
            const originalProject = await ProjectService.get(projectId);
            if (!originalProject) throw new Error(`Project ${projectId} not found`);

            // 2. Create new project container
            const newProject = await ProjectService.createProject(
                `${originalProject.name} (Copy)`,
                originalProject.type,
                orgId
            );

            // 3. Duplicate History Items
            // We need to fetch history for this project. 
            // StorageService.loadHistory gets everything for the org, we might need a specific query
            // But for now, let's use the store's history if available as a cache, or query DB

            // Query DB for reliability
            // We need to access the base query method of StorageService or add a new method
            // Since StorageService extends FirestoreService, we can use 'list'
            const { where } = await import('firebase/firestore');
            const historyItems = await StorageService.list([
                where('projectId', '==', projectId)
            ]);

            // Duplicate items
            await Promise.all(historyItems.map(async (item) => {
                const { id: _, ...data } = item;
                await StorageService.saveItem({
                    ...data,
                    id: `copy_${Date.now()}_${secureRandomAlphanumeric(9)}`, // ID is usually ignored by saveItem but required by type
                    projectId: newProject.id,
                    timestamp: Date.now()
                });
            }));

            // 4. Update local store
            // Convert Project to ProjectMetadata at the service boundary
            const metadata = projectToMetadata(newProject, historyItems.length);

            if (typeof state.addProject === 'function') {
                state.addProject(metadata);
            }

            // Also need to refresh history in store if we want to see the new items immediately
            // But typically we only load history when entering the project

            return metadata;

        } catch (error) {
            logger.error('[Dashboard] Error duplicating project:', error);
            throw error;
        }
    }

    static async deleteProject(projectId: string): Promise<void> {
        try {
            const { useStore } = await import('@/core/store');
            const { ProjectService } = await import('@/services/ProjectService');

            // 1. Delete from Service/DB
            await ProjectService.delete(projectId);

            // 2. Local State Cleanup
            const state = useStore.getState() as unknown as DashboardStoreState;

            // Remove from history locally
            if (state.generatedHistory && typeof state.removeFromHistory === 'function') {
                const toRemove = state.generatedHistory.filter(item => item.projectId === projectId);
                toRemove.forEach(item => state.removeFromHistory!(item.id));
            }

            // Remove project locally
            if (typeof state.removeProject === 'function') {
                state.removeProject(projectId);
            }

            // 3. Firestore Cleanup (Delete orphaned history items)
            try {
                const { getDocs, query, collection, where, deleteDoc } = await import('firebase/firestore');
                const { db } = await import('@/services/firebase');

                const historyRef = collection(db, 'history');
                const q = query(historyRef, where('projectId', '==', projectId));
                const snapshot = await getDocs(q);
                await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
            } catch (cleanupError) {
                logger.warn('[Dashboard] Cleanup warning:', cleanupError);
            }

        } catch (error) {
            logger.error('[Dashboard] Error deleting project:', error);
            throw error;
        }
    }

    static async getAnalytics(): Promise<AnalyticsData> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState() as unknown as DashboardStoreState;

            const history = state.generatedHistory || [];
            const agentMessages = state.agentMessages || [];
            const projects = state.projects || [];

            // Check current day for cache invalidation (since weekly activity depends on "now")
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            const currentDay = Math.floor(now / dayMs);

            // Bolt Optimization: Check Cache
            // ⚡ OPTIMIZATION: Use O(1) length check for projects instead of O(N) iteration
            // The analytics data only uses the count of projects, not their content.
            if (
                DashboardService.analyticsCache &&
                DashboardService.analyticsCache.historyRef === history &&
                DashboardService.analyticsCache.agentMessagesRef === agentMessages &&
                DashboardService.analyticsCache.projectsCount === projects.length &&
                DashboardService.analyticsCache.projectsRef === projects &&
                DashboardService.analyticsCache.day === currentDay
            ) {
                return DashboardService.analyticsCache.data;
            }

            // Bolt Optimization: Calculate all analytics in a single pass to reduce iteration overhead
            let imageCount = 0;
            let totalVideoSeconds = 0;
            const weeklyActivity = Array(7).fill(0);
            const wordCounts: Record<string, number> = {};

            for (let i = 0; i < history.length; i++) {
                const item = history[i]!
                // 1. Counts and Duration
                if (item.type === 'image') {
                    imageCount++;
                } else if (item.type === 'video') {
                    // Check if the history item effectively has a duration property
                    // Currently HistoryItem type doesn't support duration, so we default to 5
                    const duration = (item as unknown as { duration?: number }).duration || 5;
                    totalVideoSeconds += duration;
                }

                // 2. Weekly Activity
                // Using (item.timestamp || now) to handle missing timestamp safely
                // eslint-disable-next-line prefer-const
                let daysAgo = Math.floor((now - (item.timestamp || now)) / dayMs);
                if (daysAgo >= 0 && daysAgo < 7) {
                    weeklyActivity[6 - daysAgo]++;
                }

                // 3. Word Cloud
                if (item.prompt) {
                    // Bolt: Use matchAll to avoid creating large intermediate strings and arrays
                    // ⚡ OPTIMIZATION: Filter length at regex level (/\S{4,}/g) to avoid string allocation for short words
                    for (const match of item.prompt.matchAll(/\S{4,}/g)) {
                        const word = match[0].toLowerCase();
                        if (!STOP_WORDS.has(word)) {
                            wordCounts[word] = (wordCounts[word] || 0) + 1;
                        }
                    }
                }
            }

            // Calculate streak (consecutive days with activity)
            let streak = 0;
            for (let i = 6; i >= 0; i--) {
                if (weeklyActivity[i] > 0) {
                    streak++;
                } else if (i < 6) {
                    break; // Only break if not today
                }
            }

            const topPromptWords = Object.entries(wordCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([word, count]) => ({ word, count }));

            const result: AnalyticsData = {
                totalGenerations: imageCount,
                totalMessages: agentMessages.length,
                totalVideoSeconds,
                totalProjects: projects.length,
                weeklyActivity,
                topPromptWords,
                streak
            };

            // Update Cache
            DashboardService.analyticsCache = {
                historyRef: history,
                agentMessagesRef: agentMessages,
                projectsCount: projects.length,
                projectsRef: projects,
                day: currentDay,
                data: result
            };

            return result;
        } catch (_error) {
            return {
                totalGenerations: 0,
                totalMessages: 0,
                totalVideoSeconds: 0,
                totalProjects: 0,
                weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
                topPromptWords: [],
                streak: 0
            };
        }
    }


    static async exportBackup(): Promise<void> {

        const { useStore } = await import('@/core/store');
        const state = useStore.getState();

        const backupData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            projects: state.projects || [],
            generatedHistory: state.generatedHistory || [],
            userProfile: state.userProfile || null,
        };

        const blob = new Blob(
            [JSON.stringify(backupData, null, 2)],
            { type: 'application/json' }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `indiios-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    static async getSalesAnalytics(period: string = '30d'): Promise<SalesAnalyticsData> {
        // Zero-state fallback for safe "empty" loading or error cases
        const zeroState: SalesAnalyticsData = {
            conversionRate: { value: 0, trend: 'neutral', formatted: '0%' },
            totalVisitors: { value: 0, trend: 'neutral', formatted: '0' },
            clickRate: { value: 0, trend: 'neutral', formatted: '0%' },
            avgOrderValue: { value: 0, trend: 'neutral', formatted: '$0.00' },
            revenueChart: [],
            period: period,
            lastUpdated: Date.now()
        };

        try {
            // 1. Check Cache
            const cached = this.cache.get(period);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
                return cached.data;
            }

            const { useStore } = await import('@/core/store');
            const { db } = await import('@/services/firebase');
            const { doc, getDoc } = await import('firebase/firestore');

            const userProfile = useStore.getState().userProfile;

            // 2. Attempt Fetch from API
            // Bolt: "Production Bridge" - prefer API over Firestore/Mock if available
            const apiUrl = import.meta.env.VITE_API_URL;

            if (apiUrl) {
                try {
                    const response = await fetch(`${apiUrl}/api/analytics/sales?period=${period}`);

                    if (!response.ok) {
                        throw new Error(`API Error: ${response.statusText}`);
                    }

                    const rawData = await response.json();
                    const data = SalesAnalyticsSchema.parse(rawData);

                    // Update Cache
                    this.cache.set(period, { data, timestamp: Date.now() });

                    return data;
                } catch (apiError) {
                    logger.warn('[Dashboard] API fetch failed, falling back to Firestore:', apiError);
                    // Fallthrough to Firestore
                }
            }

            // 3. Fallback to Firestore (Legacy/Hybrid Support)
            if (userProfile?.id) {
                const statsRef = doc(db, 'users', userProfile.id, 'stats', 'sales_analytics');
                try {
                    const snapshot = await getDoc(statsRef);
                    if (snapshot.exists()) {
                        const data = snapshot.data();
                        const parseResult = SalesAnalyticsSchema.safeParse(data);
                        if (parseResult.success) {
                            // Update Cache
                            this.cache.set(period, { data: parseResult.data, timestamp: Date.now() });
                            return parseResult.data;
                        } else {
                            logger.warn('[Dashboard] Firestore data failed schema validation:', parseResult.error);
                        }
                    }
                } catch (e) {
                    logger.warn('[Dashboard] Firestore fetch failed:', e);
                }
            }

            // 4. Return zero state if all else fails
            // We removed the mock data fallback here to ensure production correctness.
            return zeroState;

        } catch (error) {
            logger.error('[Dashboard] Critical failure in getSalesAnalytics:', error);
            // Return safe default to prevent UI crash
            return zeroState;
        }
    }

    /**
     * Resets the internal cache. Useful for testing.
     */
    static resetCache() {
        this.cache.clear();
        this.analyticsCache = null;
        this.storageCache = null;
    }
}
