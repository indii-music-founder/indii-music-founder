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
 * - Removed global sequential queue: it serialised UNRELATED modules behind
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
    
    // Global mutex queue for sequential loading (ISSUE-034)
    private importQueue: (() => Promise<void>)[] = [];
    private isProcessingQueue = false;

    /**
     * Import a module with automatic deduplication and retry logic.
     * Multiple simultaneous requests for the same module share the same promise.
     * Unrelated modules are fetched concurrently (no global queue).
     */
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
                    this.cache.delete(modulePath);
                }
            }
        }

        // Cache-miss: kick off the import and cache the in-flight promise
        let resolveRequest: (val: T) => void;
        let rejectRequest: (err: unknown) => void;
     */
    async import<T = any>(modulePath: string): Promise<T> {
        // Check cache for in-flight import
        if (this.cache.has(modulePath)) {
            const request = this.cache.get(modulePath)!;
            request.refCount++;
            return request.promise;
        }

        // Create a new deferred promise for this import request
        let resolveRequest: (val: T) => void;
        let rejectRequest: (err: any) => void;
        const requestPromise = new Promise<T>((res, rej) => {
            resolveRequest = res;
            rejectRequest = rej;
        });

        const request: ModuleImportRequest = {
            promise: requestPromise,
            refCount: 1,
        };
        this.cache.set(modulePath, request);

        // Fire the import immediately (no queue — parallel is correct here)
        this.importWithRetry<T>(modulePath)
            .then(result => resolveRequest(result))
            .catch(err => rejectRequest(err));
        // Cache the in-flight promise BEFORE queueing so simultaneous same-module requests can attach
        const request: ModuleImportRequest = {
            promise: requestPromise,
            refCount: 1
        };
        this.cache.set(modulePath, request);

        // Add the import operation to the sequential queue
        this.importQueue.push(async () => {
            try {
                const result = await this.importWithRetry<T>(modulePath);
                resolveRequest(result);
            } catch (err) {
                rejectRequest(err);
            }
        });

        // Start processing if not already
        if (!this.isProcessingQueue) {
            this.processQueue();
        }

        try {
            return await requestPromise;
        } finally {
            // Decrement ref count; remove from cache when all requests complete
            request.refCount--;
            if (request.refCount === 0) {
                this.cache.delete(modulePath);
            }
        }
    }

    /**
     * Process the import queue sequentially to avoid browser chunk loading race conditions.
     */
    private async processQueue() {
        if (this.isProcessingQueue || this.importQueue.length === 0) return;
        
        this.isProcessingQueue = true;
        
        while (this.importQueue.length > 0) {
            const importTask = this.importQueue.shift();
            if (importTask) {
                await importTask();
            }
        }
        
        this.isProcessingQueue = false;
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
            cachedModules: Array.from(this.cache.keys()),
            cachedModules: Array.from(this.cache.keys())
        };
    }
}

export const moduleImportCache = new ModuleImportCache();
