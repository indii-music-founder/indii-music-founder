/**
 * ISSUE-034 Fix: Dynamic Module Import Cache
 *
 * Deduplicates concurrent module import requests to prevent Vite chunk loading
 * race conditions during multi-delegation. Multiple agents trying to load the
 * same module simultaneously now share a single in-flight import promise.
 *
 * Without this: Promise.all([import(A), import(A), import(A)]) → 3 parallel fetches
 * With this: All three requests await the same cached promise → 1 fetch
 *
 * CodeRabbit fixes (PR #1707):
 * - refCount on cache-hit path now properly decremented via finally block
 * - Removed global sequential queue: it serialises UNRELATED modules behind
 *   each other (5× latency for 5-module delegation). Promise deduplication
 *   already solves the same-module race condition.
 */

interface ModuleImportRequest {
    promise: Promise<any>;
    refCount: number;
}

class ModuleImportCache {
    private cache = new Map<string, ModuleImportRequest>();
    private readonly maxRetries = 3;
    private readonly retryDelayMs = 100;

    /**
     * Import a module with automatic deduplication and retry logic.
     * Multiple simultaneous requests for the same module share the same promise.
     * Unrelated modules are fetched concurrently (no global queue).
     */
    async import<T = any>(moduleId: string, importFn: () => Promise<T>): Promise<T> {
        // Cache-hit: attach to the in-flight promise
        if (this.cache.has(moduleId)) {
            const request = this.cache.get(moduleId)!;
    async import<T = any>(modulePath: string): Promise<T> {
        // Cache-hit: attach to the in-flight promise
        if (this.cache.has(modulePath)) {
            const request = this.cache.get(modulePath)!;
            request.refCount++;
            try {
                return await request.promise as T;
            } finally {
                // Decrement refCount for cache-hit callers too
                request.refCount--;
                if (request.refCount === 0) {
                    this.cache.delete(moduleId);
                    this.cache.delete(modulePath);
                }
            }
        }

        // Cache-miss: create a deferred promise for this import
        let resolveRequest: (val: T) => void;
        let rejectRequest: (err: unknown) => void;
        const requestPromise = new Promise<T>((res, rej) => {
            resolveRequest = res;
            rejectRequest = rej;
        });

        const request: ModuleImportRequest = {
            promise: requestPromise,
            refCount: 1,
        };
        this.cache.set(moduleId, request);

        // Fire the import immediately (parallel is correct — no global queue)
        this.importWithRetry<T>(importFn)
        this.cache.set(modulePath, request);

        // Fire the import immediately (parallel is correct — no global queue)
        this.importWithRetry<T>(modulePath)
            .then(result => resolveRequest!(result))
            .catch(err => rejectRequest!(err));

        try {
            return await requestPromise;
        } finally {
            // Decrement ref count; remove from cache when all requests complete
            request.refCount--;
            if (request.refCount === 0) {
                this.cache.delete(moduleId);
                this.cache.delete(modulePath);
            }
        }
    }

    /**
     * Import with exponential backoff retry on transient failures.
     * Retries up to 3 times with 100ms, 200ms, 400ms delays.
     */
    private async importWithRetry<T = any>(importFn: () => Promise<T>, attempt = 1): Promise<T> {
        try {
            return await importFn();
        } catch (error) {
            if (attempt < this.maxRetries) {
                const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.importWithRetry<T>(importFn, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Clear the cache (useful for testing or module updates).
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics (for debugging).
     */
    stats(): { pendingImports: number; cachedModules: string[] } {
        return {
            pendingImports: this.cache.size,
            cachedModules: Array.from(this.cache.keys()),
        };
    }
}

export const moduleImportCache = new ModuleImportCache();
