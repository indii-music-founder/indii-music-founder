import { ModuleId } from '@/core/constants';
import { HistoryItem } from '@/core/store/slices/creativeSlice';
import { Project } from '@/core/store/slices/appSlice';
import { SalesAnalyticsSchema, SalesAnalyticsData } from './schema';
import { MOCK_SALES_ANALYTICS } from './mockData';

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
    projectsRef: ProjectMetadata[];
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
                    lastModified: p.date,
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
                // Return cached data, but we might want to update browser usage if possible?
                // Browser usage is async and external, so strictly speaking it makes the cache imperfect.
                // However, for performance, we assume it doesn't change drastically within the same app state session
                // unless we explicitly invalidate.
                // If we want to be safe, we could just re-fetch browser usage, but that requires await.
                return DashboardService.storageCache.data;
            }

            const quotaBytes = STORAGE_QUOTAS[tier as keyof typeof STORAGE_QUOTAS] || STORAGE_QUOTAS.free;

            // Calculate usage from generated history
            let imagesBytes = 0;
            let videosBytes = 0;

            if (state.generatedHistory) {
                state.generatedHistory.forEach((item) => {
                    // Estimate size from base64 URL or content length
                    const urlLength = item.url?.length || 0;
                    // content might not exist on all HistoryItems but exists on text types
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
                    knowledgeBase: kbBytes + browserUsage
                }
            };

            // Update Cache
            DashboardService.storageCache = {
                historyRef: history,
                kbRef: kb,
                tier: tier,
                data: result
            };

            return result;
        } catch (error) {
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
            console.error("Error creating project:", error);
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
                const { id, ...data } = item;
                await StorageService.saveItem({
                    ...data,
                    id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID is usually ignored by saveItem but required by type
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
            console.error("Error duplicating project:", error);
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
                console.warn("Cleanup warning:", cleanupError);
            }

        } catch (error) {
            console.error("Error deleting project:", error);
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
            if (
                DashboardService.analyticsCache &&
                DashboardService.analyticsCache.historyRef === history &&
                DashboardService.analyticsCache.agentMessagesRef === agentMessages &&
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

            for (const item of history) {
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
                const daysAgo = Math.floor((now - (item.timestamp || now)) / dayMs);
                if (daysAgo >= 0 && daysAgo < 7) {
                    weeklyActivity[6 - daysAgo]++;
                }

                // 3. Word Cloud
                if (item.prompt) {
                    // Bolt: Use matchAll to avoid creating large intermediate strings and arrays
                    for (const match of item.prompt.matchAll(/\S+/g)) {
                        const word = match[0].toLowerCase();
                        if (word.length > 3 && !STOP_WORDS.has(word)) {
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
                projectsRef: projects,
                day: currentDay,
                data: result
            };

            return result;
        } catch (error) {
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
                    console.warn("API fetch failed, falling back to Firestore/Mock:", apiError);
                    // Fallthrough to Firestore/Mock
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
                        }
                    }
                } catch (e) {
                    console.warn("Firestore fetch failed:", e);
                }
            }

            // 4. Final Fallback: Mock Data (Dev/Offline Mode)
            // Ensure consistency by updating the period
            return { ...MOCK_SALES_ANALYTICS, period };

        } catch (error) {
            console.error("Critical failure in getSalesAnalytics:", error);
            // Return safe default to prevent UI crash
            return {
                conversionRate: { value: 0, trend: 'neutral', formatted: '0%' },
                totalVisitors: { value: 0, trend: 'neutral', formatted: '0' },
                clickRate: { value: 0, trend: 'neutral', formatted: '0%' },
                avgOrderValue: { value: 0, trend: 'neutral', formatted: '$0.00' },
                revenueChart: [],
                period: period
            };
        }
    }
}
