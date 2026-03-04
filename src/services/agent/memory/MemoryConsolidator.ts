import { UserMemory } from '../types';
import { db } from '../../firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { MemorySummarizer } from './MemorySummarizer';
import { logger } from '../../../utils/logger';

/**
 * MemoryConsolidator handles the periodic maintenance of the memory system,
 * such as merging redundant memories and archiving old one.
 */
export class MemoryConsolidator {
    /**
     * Merges multiple related memories into a single consolidated entry.
     */
    public static async consolidate(
        userId: string,
        memories: UserMemory[],
        targetType: 'fact' | 'rule' | 'summary' = 'summary'
    ): Promise<string | null> {
        if (memories.length < 2) return null;

        try {
            const summaryContent = await MemorySummarizer.summarizeMemories(memories);

            // 1. Create the new consolidated memory
            const memoryRef = collection(db, 'users', userId, 'memories');
            const newDoc = await addDoc(memoryRef, {
                content: summaryContent,
                type: targetType,
                timestamp: serverTimestamp(),
                consolidated: true,
                sourceIds: memories.map(m => m.id)
            });

            // 2. Delete the old redundant memories (cleanup)
            // Note: In some systems we might "archive" them instead, 
            // but for codebase reduction we delete.
            const deletePromises = memories.map(m =>
                deleteDoc(doc(db, 'users', userId, 'memories', m.id))
            );
            await Promise.all(deletePromises);

            return newDoc.id;
        } catch (error) {
            logger.error('[MemoryConsolidator] Consolidation failed:', error);
            return null;
        }
    }
}
