import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface CachedContextRef {
    id: string; // The resource name in Vertex AI (e.g., projects/.../cachedContents/...)
    hash: string; // Content hash to check for changes
    expireTime: number; // ISO timestamp
    lastUsed: number;
}

export class CachedContextService {
    private static readonly COLLECTION = 'ai_context_cache';

    /**
     * Generate a stable hash for the context (system instruction + tools)
     */
    static generateHash(systemInstruction: string, tools?: any[]): string {
        const content = systemInstruction + (tools ? JSON.stringify(tools) : '');
        // Simple hash function for client-side
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    /**
     * Find an existing valid cache for this content
     */
    static async findCache(hash: string): Promise<string | null> {
        try {
            const ref = doc(db, this.COLLECTION, hash);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const data = snap.data() as CachedContextRef;
                // Check if expired (with 5 min buffer)
                if (data.expireTime > Date.now() + 300000) {
                    return data.id;
                }
            }
        } catch (error) {
            console.error('[CachedContextService] Failed to find cache:', error);
        }
        return null;
    }

    /**
     * Register a new cache in our database
     */
    static async registerCache(hash: string, resourceName: string, ttlSeconds: number = 3600): Promise<void> {
        try {
            const ref = doc(db, this.COLLECTION, hash);
            const data: CachedContextRef = {
                id: resourceName,
                hash,
                expireTime: Date.now() + (ttlSeconds * 1000),
                lastUsed: Date.now()
            };
            await setDoc(ref, {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('[CachedContextService] Failed to register cache:', error);
        }
    }

    /**
     * Determine if content is large enough to benefit from caching
     * Threshold: ~10k tokens (approx 40k chars)
     */
    static shouldCache(content: string): boolean {
        return content.length > 40000;
    }
}
