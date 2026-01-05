import { GenerateContentResponse, GenerateContentOptions } from '@/shared/types/ai.dto';
// import { GenerateContentOptions } from '../AIService';

interface CachedResponse {
    response: GenerateContentResponse;
    timestamp: number;
    expiresAt: number;
}

export class AIResponseCache {
    private cache: Map<string, CachedResponse> = new Map();
    private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Generates a cache key based on the request options.
     * We hash the essential parts: model, content, and critical config.
     */
    generateKey(options: GenerateContentOptions): string {
        const parts = [
            options.model,
            JSON.stringify(options.contents),
            JSON.stringify(options.config || {})
        ];
        // simple string concatenation is enough for now, 
        // strictly speaking we should hash this if it gets huge, 
        // but for typical prompts it's fine.
        return parts.join('||');
    }

    get(key: string): GenerateContentResponse | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return cached.response;
    }

    set(key: string, response: GenerateContentResponse, ttlMs?: number): void {
        const now = Date.now();
        this.cache.set(key, {
            response,
            timestamp: now,
            expiresAt: now + (ttlMs || this.defaultTTL)
        });

        // Periodic cleanup check? 
        // For now, lazy cleanup on 'get' is sufficient, 
        // plus maybe a strict limit on cache size to prevent memory leaks.
        this.prune();
    }

    private prune() {
        if (this.cache.size > 1000) {
            // Simple LRU-ish: Delete oldest 20%
            const sorted = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toDelete = sorted.slice(0, 200);
            toDelete.forEach(([k]) => this.cache.delete(k));
        }
    }

    clear(): void {
        this.cache.clear();
    }
}
