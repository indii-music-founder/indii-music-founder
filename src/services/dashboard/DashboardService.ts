
export interface ProjectMetadata {
    id: string;
    name: string;
    lastModified: number;
    assetCount: number;
    thumbnail?: string; // Base64 of hero image
}

export interface StorageStats {
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
}

export class DashboardService {

    // Mock Projects for now
    static async getProjects(): Promise<ProjectMetadata[]> {
        // In a real app, this would query IndexedDB
        return [
            {
                id: 'proj_1',
                name: 'Neon City Campaign',
                lastModified: Date.now() - 10000000,
                assetCount: 12,
                thumbnail: undefined
            },
            {
                id: 'proj_2',
                name: 'Summer Lookbook',
                lastModified: Date.now() - 50000000,
                assetCount: 45,
                thumbnail: undefined
            }
        ];
    }

    static async getStorageStats(): Promise<StorageStats> {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usedBytes: estimate.usage || 0,
                quotaBytes: estimate.quota || 0,
                percentUsed: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
            };
        }
        return { usedBytes: 0, quotaBytes: 0, percentUsed: 0 };
    }

    static async createProject(name: string): Promise<ProjectMetadata> {
        console.log("Creating project:", name);
        return {
            id: `proj_${Date.now()}`,
            name,
            lastModified: Date.now(),
            assetCount: 0
        };
    }

    static async exportBackup(): Promise<void> {
        console.log("Generating backup...");
        // TODO: Implement zip generation of IndexedDB
    }
}
