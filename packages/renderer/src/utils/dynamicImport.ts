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
            const result = await componentImport();
            
            // Clear reload flag on successful import so future legitimate errors can recover
            try {
                if (sessionStorage.getItem('agent-chunk-reload-attempted')) {
                    sessionStorage.removeItem('agent-chunk-reload-attempted');
                }
            } catch (e) {
                // Ignore errors
            }
            
            return result;
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
                    logger.warn('Chunk load failed after retries.');
                    
                    const reloadFlag = 'agent-chunk-reload-attempted';
                    try {
                        if (!sessionStorage.getItem(reloadFlag)) {
                            logger.warn('Forcing page reload to recover from stale chunk.');
                            sessionStorage.setItem(reloadFlag, 'true');
                            window.location.reload();
                            return Promise.reject(new Error('Chunk load failed. Page reload triggered.')); 
                        } else {
                            logger.error('Page was already reloaded for a chunk error recently. Aborting to prevent loop.');
                        }
                    } catch (e) {
                        // Ignore sessionStorage access errors (e.g. in test env)
                    }
                    
                    return Promise.reject(new Error('Chunk load failed permanently.')); 
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
