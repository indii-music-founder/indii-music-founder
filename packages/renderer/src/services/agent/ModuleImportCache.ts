/**
 * ISSUE-034 Fix: Dynamic Module Import Cache
 *
 * Deduplicates concurrent module import requests to prevent Vite chunk loading
 * race conditions during multi-delegation. Multiple agents trying to load the
 * same module simultaneously now share a single in-flight import promise.
 *
 * Without this: Promise.all([import(A), import(A), import(A)]) → 3 parallel fetches
 * With this: All three requests await the same cached promise → 1 fetch
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
     */
    async import<T = any>(modulePath: string): Promise<T> {
        // Check cache for in-flight import
        if (this.cache.has(modulePath)) {
            const request = this.cache.get(modulePath)!;
            request.refCount++;
            return request.promise;
        }

        // Create new import with retry logic
        const importPromise = this.importWithRetry<T>(modulePath);

        // Cache the in-flight promise
        const request: ModuleImportRequest = {
            promise: importPromise,
            refCount: 1
        };
        this.cache.set(modulePath, request);

        try {
            return await importPromise;
        } finally {
            // Decrement ref count; remove from cache when all requests complete
            request.refCount--;
            if (request.refCount === 0) {
                this.cache.delete(modulePath);
            }
        }
    }

    /**
     * Import with exponential backoff retry on transient failures.
     * Retries up to 3 times with 100ms, 200ms, 400ms delays.
     */
    private async importWithRetry<T = any>(modulePath: string, attempt = 1): Promise<T> {
        try {
            return await import(modulePath);
        } catch (error) {
            if (attempt < this.maxRetries) {
                const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.importWithRetry<T>(modulePath, attempt + 1);
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
            cachedModules: Array.from(this.cache.keys())
        };
    }
}

export const moduleImportCache = new ModuleImportCache();
