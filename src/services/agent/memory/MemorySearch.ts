import { UserMemory } from '../types';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { FirebaseAIService as AIService } from '../../ai/FirebaseAIService';
import { logger } from '../../../utils/logger';

/**
 * MemorySearch handles the technical logic for searching user memories.
 * This includes vector search (via AIService) and fallback filters.
 */
export class MemorySearch {
    /**
     * Searches memories using vector embedding similarity.
     */
    public static async searchBySimilarity(
        userId: string,
        queryText: string,
        maxResults: number = 5
    ): Promise<UserMemory[]> {
        try {
            // Get embedding for the query
            const result = await AIService.getInstance().embedContent({
                model: 'text-embedding-004', // Using a standard embedding model
                content: { role: 'user', parts: [{ text: queryText }] }
            });
            const embedding = result.values;

            // Note: In a production environment, this would use a vector database
            // For now, we fetch recent memories and rank them manually (proto-vector search)
            // or use specific metadata filters.

            const memoryRef = collection(db, 'users', userId, 'memories');
            const q = query(
                memoryRef,
                orderBy('timestamp', 'desc'),
                firestoreLimit(20) // Fetch candidates for ranking
            );

            const snapshot = await getDocs(q);
            const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserMemory));

            // In the future, this is where cosine similarity ranking happens
            // For now, we return the filtered candidates
            return candidates.slice(0, maxResults);
        } catch (error) {
            logger.error('[MemorySearch] Similarity search failed:', error);
            return [];
        }
    }

    /**
     * Filters memories by specific metadata fields.
     */
    public static async filterByType(
        userId: string,
        type: string,
        maxResults: number = 10
    ): Promise<UserMemory[]> {
        const memoryRef = collection(db, 'users', userId, 'memories');
        const q = query(
            memoryRef,
            where('type', '==', type),
            orderBy('timestamp', 'desc'),
            firestoreLimit(maxResults)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserMemory));
    }
}
