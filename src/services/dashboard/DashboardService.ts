
import { HistoryItem } from '@/core/store/slices/creativeSlice';

export interface ProjectMetadata {
    id: string;
    name: string;
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
    projects: ProjectMetadata[];
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
}

// Tier-based storage quotas in bytes
const STORAGE_QUOTAS = {
    free: 1_073_741_824,        // 1 GB
    pro: 10_737_418_240,        // 10 GB
    enterprise: 107_374_182_400  // 100 GB
};

export class DashboardService {

    static async getProjects(): Promise<ProjectMetadata[]> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState() as unknown as DashboardStoreState;

            // Get projects from store
            if (state.projects && state.projects.length > 0) {
                return state.projects.map((p) => ({
                    id: p.id,
                    name: p.name,
                    lastModified: p.lastModified || Date.now(),
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

            return {
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
        } catch (error) {
            // Silently fail in beta production build, just return empty stats
            return { usedBytes: 0, quotaBytes: STORAGE_QUOTAS.free, percentUsed: 0 };
        }
    }

    static async createProject(name: string): Promise<ProjectMetadata> {
        const newProject = {
            id: `proj_${Date.now()}`,
            name,
            lastModified: Date.now(),
            assetCount: 0
        };

        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState() as unknown as DashboardStoreState;

            // Add to store if addProject exists
            if (typeof state.addProject === 'function') {
                state.addProject(newProject);
            }
        } catch (error) {
            // Failed to add to store, but we return the object anyway
        }

        return newProject;
    }

    static async duplicateProject(projectId: string): Promise<ProjectMetadata> {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState() as unknown as DashboardStoreState;

        // Find original project
        const projects = await this.getProjects();
        const original = projects.find(p => p.id === projectId);

        if (!original) {
            throw new Error(`Project ${projectId} not found`);
        }

        // Create duplicate
        const duplicate: ProjectMetadata = {
            id: `proj_${Date.now()}`,
            name: `${original.name} (Copy)`,
            lastModified: Date.now(),
            assetCount: original.assetCount,
            thumbnail: original.thumbnail
        };

        // Copy history items if they exist
        if (state.generatedHistory) {
            const projectHistory = state.generatedHistory.filter(
                (item) => item.projectId === projectId
            );

            // Add duplicated items with new project ID
            projectHistory.forEach((item) => {
                if (typeof state.addToHistory === 'function') {
                    state.addToHistory({
                        ...item,
                        id: `${item.id}_copy_${Date.now()}`,
                        projectId: duplicate.id,
                        timestamp: Date.now()
                    });
                }
            });
        }

        // Add to store
        if (typeof state.addProject === 'function') {
            state.addProject(duplicate);
        }

        return duplicate;
    }

    static async deleteProject(projectId: string): Promise<void> {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState() as unknown as DashboardStoreState;

        if (typeof state.removeProject === 'function') {
            state.removeProject(projectId);
        }

        // Remove associated history
        if (state.generatedHistory && typeof state.removeFromHistory === 'function') {
            const toRemove = state.generatedHistory.filter(
                (item) => item.projectId === projectId
            );
            toRemove.forEach((item) => state.removeFromHistory && state.removeFromHistory(item.id));
        }
    }

    static async getAnalytics(): Promise<AnalyticsData> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState() as unknown as DashboardStoreState;

            const history = state.generatedHistory || [];
            const agentMessages = state.agentMessages || [];

            // Count generations
            const imageCount = history.filter((h) => h.type === 'image').length;
            const videoItems = history.filter((h) => h.type === 'video');
            const totalVideoSeconds = videoItems.reduce((sum: number, v) => {
                // Check if the history item effectively has a duration property
                // Currently HistoryItem type doesn't support duration, so we default to 5
                // In a real implementation, we should update HistoryItem interface
                const duration = (v as unknown as { duration?: number }).duration || 5;
                return sum + duration;
            }, 0);

            // Weekly activity (last 7 days)
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            const weeklyActivity = Array(7).fill(0);

            history.forEach((item) => {
                const daysAgo = Math.floor((now - (item.timestamp || now)) / dayMs);
                if (daysAgo >= 0 && daysAgo < 7) {
                    weeklyActivity[6 - daysAgo]++;
                }
            });

            // Calculate streak (consecutive days with activity)
            let streak = 0;
            for (let i = 6; i >= 0; i--) {
                if (weeklyActivity[i] > 0) {
                    streak++;
                } else if (i < 6) {
                    break; // Only break if not today
                }
            }

            // Word cloud from prompts
            const allPrompts = history
                .map((h) => h.prompt || '')
                .join(' ')
                .toLowerCase();

            const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'as', 'be', 'this', 'that', 'from']);
            const words = allPrompts
                .split(/\s+/)
                .filter(w => w.length > 3 && !stopWords.has(w));

            const wordCounts: Record<string, number> = {};
            words.forEach(word => {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });

            const topPromptWords = Object.entries(wordCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([word, count]) => ({ word, count }));

            return {
                totalGenerations: imageCount,
                totalMessages: agentMessages.length,
                totalVideoSeconds,
                totalProjects: (state.projects || []).length,
                weeklyActivity,
                topPromptWords,
                streak
            };
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
}
