/**
 * PromptAdditiveTracker
 * Tracks prompt additives and descriptors used by the user, persisted in localStorage.
 * Enables quick access to frequently used additives (environments, materials, lighting, cameras, styles).
 */

const STORAGE_KEY = 'indii_prompt_additives_frequency';

export interface PromptAdditiveUsage {
    tag: string;
    category?: string;
    count: number;
    lastUsed: number;
}

export class PromptAdditiveTracker {
    private static memoryCache: Record<string, PromptAdditiveUsage> | null = null;

    private static load(): Record<string, PromptAdditiveUsage> {
        if (this.memoryCache) {
            return this.memoryCache;
        }

        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = window.localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    this.memoryCache = JSON.parse(stored);
                    return this.memoryCache || {};
                }
            }
        } catch {
            // Ignore JSON or storage access errors
        }

        this.memoryCache = {};
        return this.memoryCache;
    }

    private static persist(data: Record<string, PromptAdditiveUsage>): void {
        this.memoryCache = data;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            }
        } catch {
            // Ignore quota or private storage errors
        }
    }

    /**
     * Record that a tag or descriptor was used.
     */
    public static recordUsage(tag: string, category?: string): void {
        const trimmed = tag.trim();
        if (!trimmed) return;

        const data = { ...this.load() };
        const existing = data[trimmed];

        data[trimmed] = {
            tag: trimmed,
            category: category || existing?.category,
            count: (existing?.count || 0) + 1,
            lastUsed: Date.now()
        };

        this.persist(data);
    }

    /**
     * Get the most frequently used additives, optionally filtered by category or top N.
     */
    public static getFrequentAdditives(limit: number = 8, category?: string): PromptAdditiveUsage[] {
        const data = this.load();
        const items = Object.values(data);

        return items
            .filter(item => (!category || item.category === category) && item.count > 0)
            .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
            .slice(0, limit);
    }

    /**
     * Reset tracker memory (useful for tests).
     */
    public static resetForTesting(): void {
        this.memoryCache = null;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // ignore
        }
    }
}
