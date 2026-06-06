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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    return Promise.reject(new Error('Chunk load failed. Page reload triggered.')); 
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
