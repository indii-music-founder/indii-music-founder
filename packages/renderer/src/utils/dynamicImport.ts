import { logger } from '@/utils/logger';

const CHUNK_RELOAD_FLAG = 'agent-chunk-reload-attempted';

export function buildChunkRecoveryUrl(href: string, recoveryId: number): string {
    const url = new URL(href);
    url.searchParams.set('_chunk_reload', String(recoveryId));
    return url.toString();
}

function navigateToFreshDocument(): Promise<never> {
    const recoveryUrl = buildChunkRecoveryUrl(window.location.href, Date.now());
    window.location.replace(recoveryUrl);

    // Navigation abandons this JavaScript realm. Keeping the import pending
    // prevents the obsolete response executor from reporting a false agent
    // failure while the fresh document takes over.
    return new Promise<never>(() => undefined);
}

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
                if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
                    sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
                }
            } catch {
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
                    
                    try {
                        if (!sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
                            logger.warn('Loading a cache-busted document to recover from stale chunks.');
                            sessionStorage.setItem(CHUNK_RELOAD_FLAG, 'true');
                            return navigateToFreshDocument();
                        } else {
                            logger.error('Page was already reloaded for a chunk error recently. Aborting to prevent loop.');
                        }
                    } catch (navigationError) {
                        logger.error('Unable to navigate to a fresh document after a chunk error:', navigationError);
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
