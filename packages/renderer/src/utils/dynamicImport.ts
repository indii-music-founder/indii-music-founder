import { logger } from '@/utils/logger';

/**
 * Retries a dynamic import function multiple times.
 * If a ChunkLoadError is detected (e.g., after a new deployment),
 * it forcefully reloads the window after max retries are exhausted.
 */
export const importWithRetry = async <T>(componentImport: () => Promise<T>): Promise<T> => {
    let retries = 3;
    let interval = 500;
    while (retries > 0) {
        try {
            return await componentImport();
        } catch (error: any) {
            const isChunkLoadError = error?.name === 'ChunkLoadError' || 
                (error?.message && (
                    error.message.includes('Failed to fetch dynamically imported module') ||
                    error.message.includes('Importing a module script failed') ||
                    error.message.includes('Loading chunk')
                ));

            if (isChunkLoadError) {
                retries--;
                if (retries === 0) {
                    logger.warn('Chunk load failed after retries, forcing page reload.');
                    window.location.reload();
                    // Return a promise that never resolves while the page reloads
                    return new Promise(() => {}) as Promise<T>; 
                }
                await new Promise(resolve => setTimeout(resolve, interval));
                interval *= 1.5;
            } else {
                throw error;
            }
        }
    }
    return await componentImport(); // Should not reach here
};
