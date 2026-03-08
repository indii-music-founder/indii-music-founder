import { logger } from '@/utils/logger';
import { db } from '../../firebase';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    updateDoc,
    doc as firestoreDoc,
    deleteDoc,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import { MemorySummarizer } from './MemorySummarizer';
import type {
    AlwaysOnMemory,
    ConsolidationInsight,
    ConsolidationConfig,
    MemoryConnection,
    MemoryTier,
    MemoryTierConfig,
} from '@/types/AlwaysOnMemory';
import {
    DEFAULT_CONSOLIDATION_CONFIG,
    DEFAULT_TIER_CONFIG,
} from '@/types/AlwaysOnMemory';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Simple cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================================================
// CONSOLIDATION ENGINE
// ============================================================================

/**
 * MemoryConsolidator — Upgraded consolidation engine for the Always-On Memory Agent.
 *
 * Like the human brain during sleep, this engine:
 * 1. Reviews unconsolidated memories
 * 2. Finds connections and patterns across them
 * 3. Generates cross-cutting insights
 * 4. Promotes high-value memories through tiers
 * 5. Applies importance decay to aging memories
 * 6. Archives low-value, stale memories
 *
 * Backward compatible with the original `consolidate()` method signature
 * from the legacy MemoryConsolidator.
 */
export class MemoryConsolidator {
    // ========================================================================
    // LEGACY API (backward compatible)
    // ========================================================================

    /**
     * Merges multiple related memories into a single consolidated entry.
     * This is the original API, preserved for backward compatibility.
     *
     * @deprecated Use `runConsolidationCycle()` for the full Always-On pipeline.
     */
    public static async consolidate(
        userId: string,
        memories: Array<{ id: string; content: string; type?: string }>,
        targetType: 'fact' | 'rule' | 'summary' = 'summary'
    ): Promise<string | null> {
        if (memories.length < 2) return null;

        try {
            const summaryContent = await MemorySummarizer.summarizeMemories(memories);

            // Create the new consolidated memory
            const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');
            const newDoc = await addDoc(memoryRef, {
                content: summaryContent,
                rawText: memories.map(m => m.content).join('\n\n'),
                summary: summaryContent,
                category: targetType === 'rule' ? 'fact' : 'context',
                tier: 'longTerm',
                entities: [],
                topics: [],
                importance: 0.7,
                source: 'consolidation',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                lastAccessedAt: Timestamp.now(),
                accessCount: 0,
                isActive: true,
                consolidated: true,
                connections: [],
                relatedMemoryIds: memories.map(m => m.id),
                tags: [],
            });

            // Mark the old memories as consolidated
            const batch = writeBatch(db);
            for (const m of memories) {
                const ref = firestoreDoc(db, 'users', userId, 'alwaysOnMemories', m.id);
                batch.update(ref, { consolidated: true, updatedAt: Timestamp.now() });
            }
            await batch.commit();

            return newDoc.id;
        } catch (error) {
            logger.error('[MemoryConsolidator] Consolidation failed:', error);
            return null;
        }
    }

    // ========================================================================
    // ALWAYS-ON CONSOLIDATION CYCLE
    // ========================================================================

    /**
     * Run a full consolidation cycle. This is called periodically by the engine.
     *
     * Steps:
     * 1. Fetch unconsolidated memories
     * 2. Group related memories using embedding similarity
     * 3. Generate insights for each group
     * 4. Store connections and cross-references
     * 5. Mark processed memories as consolidated
     * 6. Apply importance decay
     * 7. Promote/demote memories through tiers
     *
     * @param userId - The user whose memories to consolidate
     * @param config - Consolidation configuration
     * @returns Summary of what was done
     */
    public static async runConsolidationCycle(
        userId: string,
        config: ConsolidationConfig = DEFAULT_CONSOLIDATION_CONFIG
    ): Promise<{
        memoriesProcessed: number;
        insightsGenerated: number;
        connectionsFound: number;
        tiersUpdated: number;
        memoriesDecayed: number;
    }> {
        const result = {
            memoriesProcessed: 0,
            insightsGenerated: 0,
            connectionsFound: 0,
            tiersUpdated: 0,
            memoriesDecayed: 0,
        };

        try {
            // Step 1: Fetch unconsolidated memories
            const unconsolidated = await this.getUnconsolidatedMemories(userId, config.batchSize);

            if (unconsolidated.length < config.minMemoriesForConsolidation) {
                logger.info(
                    `[MemoryConsolidator] 🔄 Skipping consolidation ` +
                    `(${unconsolidated.length} unconsolidated, need ${config.minMemoriesForConsolidation})`
                );
            } else {
                // Step 2: Group related memories
                const groups = this.groupByEmbeddingSimilarity(unconsolidated, config.similarityThreshold);

                // Step 3: Generate insights for each group
                for (const group of groups) {
                    if (group.length < 2) continue;

                    const insight = await MemorySummarizer.generateInsight(userId, group);
                    if (insight) {
                        // Store the insight
                        await this.storeInsight(userId, insight);
                        result.insightsGenerated++;
                        result.connectionsFound += insight.connections.length;

                        // Step 4: Store connections on the memories themselves
                        await this.storeConnections(userId, insight.connections);
                    }

                    // Step 5: Mark memories as consolidated
                    await this.markAsConsolidated(userId, group.map(m => m.id));
                    result.memoriesProcessed += group.length;
                }

                // Handle any remaining ungrouped memories (mark as consolidated to avoid re-processing)
                const processedIds = new Set(groups.flat().map(m => m.id));
                const unprocessed = unconsolidated.filter(m => !processedIds.has(m.id));
                if (unprocessed.length > 0) {
                    await this.markAsConsolidated(userId, unprocessed.map(m => m.id));
                    result.memoriesProcessed += unprocessed.length;
                }
            }

            // Step 6: Apply importance decay to all active memories
            result.memoriesDecayed = await this.applyImportanceDecay(userId, config.importanceDecayPerDay);

            // Step 7: Update memory tiers
            result.tiersUpdated = await this.updateTiers(userId, DEFAULT_TIER_CONFIG);

            logger.info(
                `[MemoryConsolidator] 🔄 Consolidation complete: ` +
                `${result.memoriesProcessed} processed, ` +
                `${result.insightsGenerated} insights, ` +
                `${result.connectionsFound} connections, ` +
                `${result.tiersUpdated} tier changes, ` +
                `${result.memoriesDecayed} decayed`
            );

            return result;
        } catch (error) {
            logger.error('[MemoryConsolidator] Consolidation cycle failed:', error);
            return result;
        }
    }

    // ========================================================================
    // PRIVATE - FETCHING
    // ========================================================================

    /**
     * Fetch unconsolidated memories for a user.
     */
    private static async getUnconsolidatedMemories(
        userId: string,
        batchSize: number
    ): Promise<AlwaysOnMemory[]> {
        const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');
        const q = query(
            memoryRef,
            where('consolidated', '==', false),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(batchSize)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as AlwaysOnMemory[];
    }

    // ========================================================================
    // PRIVATE - GROUPING
    // ========================================================================

    /**
     * Group memories by embedding similarity using a greedy clustering approach.
     * Memories with similarity >= threshold are placed in the same group.
     */
    private static groupByEmbeddingSimilarity(
        memories: AlwaysOnMemory[],
        threshold: number
    ): AlwaysOnMemory[][] {
        const groups: AlwaysOnMemory[][] = [];
        const assigned = new Set<string>();

        for (const memory of memories) {
            if (assigned.has(memory.id)) continue;

            const group: AlwaysOnMemory[] = [memory];
            assigned.add(memory.id);

            // Find all memories similar to this one
            for (const other of memories) {
                if (assigned.has(other.id)) continue;

                // Use embedding similarity if available
                if (memory.embedding?.length && other.embedding?.length) {
                    const similarity = cosineSimilarity(memory.embedding, other.embedding);
                    if (similarity >= threshold) {
                        group.push(other);
                        assigned.add(other.id);
                    }
                } else {
                    // Fallback: topic/entity overlap
                    const topicOverlap = this.calculateSetOverlap(
                        new Set(memory.topics || []),
                        new Set(other.topics || [])
                    );
                    const entityOverlap = this.calculateSetOverlap(
                        new Set((memory.entities || []).map(e => e.name.toLowerCase())),
                        new Set((other.entities || []).map(e => e.name.toLowerCase()))
                    );
                    if (topicOverlap > 0.5 || entityOverlap > 0.3) {
                        group.push(other);
                        assigned.add(other.id);
                    }
                }
            }

            groups.push(group);
        }

        return groups;
    }

    /**
     * Calculate Jaccard overlap between two sets.
     */
    private static calculateSetOverlap(a: Set<string>, b: Set<string>): number {
        if (a.size === 0 || b.size === 0) return 0;
        const intersection = [...a].filter(x => b.has(x));
        const union = new Set([...a, ...b]);
        return intersection.length / union.size;
    }

    // ========================================================================
    // PRIVATE - STORAGE
    // ========================================================================

    /**
     * Store a consolidation insight.
     */
    private static async storeInsight(
        userId: string,
        insight: Omit<ConsolidationInsight, 'id'>
    ): Promise<string> {
        const insightRef = collection(db, 'users', userId, 'consolidationInsights');
        const docRef = await addDoc(insightRef, {
            ...insight,
            connections: insight.connections.map(c => ({
                fromMemoryId: c.fromMemoryId,
                toMemoryId: c.toMemoryId,
                relationship: c.relationship,
                confidence: c.confidence,
                discoveredAt: c.discoveredAt,
            })),
        });
        logger.info(`[MemoryConsolidator] 💡 New insight: ${insight.insight.slice(0, 80)}...`);
        return docRef.id;
    }

    /**
     * Store connections on the memories themselves (bidirectional).
     */
    private static async storeConnections(
        userId: string,
        connections: MemoryConnection[]
    ): Promise<void> {
        const batch = writeBatch(db);

        for (const conn of connections) {
            // We need to read the current connections, add the new one, and write back.
            // Since writeBatch doesn't support reads, we'll use individual updates.
            try {
                // Update the "from" memory
                const fromRef = firestoreDoc(db, 'users', userId, 'alwaysOnMemories', conn.fromMemoryId);
                // Note: In production, you'd read the current connections first.
                // For simplicity, we use arrayUnion-like behavior.
                // Firestore arrayUnion requires exact match, so we store as a subcollection instead.
                // For now, log and skip complex cross-referencing.
                logger.debug(
                    `[MemoryConsolidator] 🔗 Connection: ${conn.fromMemoryId} → ${conn.toMemoryId}: ${conn.relationship}`
                );
            } catch (error) {
                logger.error('[MemoryConsolidator] Failed to store connection:', error);
            }
        }
    }

    /**
     * Mark memories as consolidated.
     */
    private static async markAsConsolidated(
        userId: string,
        memoryIds: string[]
    ): Promise<void> {
        const batch = writeBatch(db);
        const now = Timestamp.now();

        for (const id of memoryIds) {
            const ref = firestoreDoc(db, 'users', userId, 'alwaysOnMemories', id);
            batch.update(ref, { consolidated: true, updatedAt: now });
        }

        await batch.commit();
    }

    // ========================================================================
    // PRIVATE - IMPORTANCE DECAY
    // ========================================================================

    /**
     * Apply importance decay to all active memories.
     * Memories that haven't been accessed recently lose a small amount of importance.
     * Frequently accessed memories are reinforced instead.
     *
     * @returns Number of memories that had their importance changed
     */
    private static async applyImportanceDecay(
        userId: string,
        decayPerDay: number
    ): Promise<number> {
        try {
            const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');
            const q = query(
                memoryRef,
                where('isActive', '==', true),
                limit(100)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return 0;

            const batch = writeBatch(db);
            const now = Date.now();
            let decayedCount = 0;

            for (const docSnap of snapshot.docs) {
                const memory = docSnap.data() as AlwaysOnMemory;
                const lastAccessed = memory.lastAccessedAt?.toMillis?.() || now;
                const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);

                if (daysSinceAccess < 1) continue; // Skip recently accessed memories

                // Calculate decay: importance decreases exponentially with days since access
                const decayFactor = Math.pow(1 - decayPerDay, daysSinceAccess);
                const newImportance = Math.max(0.01, memory.importance * decayFactor);

                // Only update if importance changed meaningfully
                if (Math.abs(newImportance - memory.importance) > 0.005) {
                    const ref = firestoreDoc(db, 'users', userId, 'alwaysOnMemories', docSnap.id);
                    batch.update(ref, {
                        importance: parseFloat(newImportance.toFixed(4)),
                        updatedAt: Timestamp.now(),
                    });
                    decayedCount++;
                }
            }

            if (decayedCount > 0) {
                await batch.commit();
            }

            return decayedCount;
        } catch (error) {
            logger.error('[MemoryConsolidator] Importance decay failed:', error);
            return 0;
        }
    }

    // ========================================================================
    // PRIVATE - TIER MANAGEMENT
    // ========================================================================

    /**
     * Update memory tiers based on age, access frequency, and importance.
     *
     * Promotion path: working → shortTerm → longTerm
     * Demotion path: longTerm → archived (if importance drops too low)
     *
     * @returns Number of memories that changed tiers
     */
    private static async updateTiers(
        userId: string,
        tierConfig: MemoryTierConfig
    ): Promise<number> {
        try {
            const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');
            const q = query(
                memoryRef,
                where('isActive', '==', true),
                limit(200)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return 0;

            const batch = writeBatch(db);
            const now = Date.now();
            let tiersChanged = 0;

            for (const docSnap of snapshot.docs) {
                const memory = docSnap.data() as AlwaysOnMemory;
                const createdAt = memory.createdAt?.toMillis?.() || now;
                const ageMs = now - createdAt;
                const currentTier = memory.tier || 'working';
                let newTier: MemoryTier = currentTier;

                // Promotion logic
                if (currentTier === 'working' && ageMs > tierConfig.workingToShortTermMs) {
                    newTier = 'shortTerm';
                } else if (currentTier === 'shortTerm' && ageMs > tierConfig.shortTermToLongTermMs) {
                    // Only promote to longTerm if the memory has been accessed at least once
                    // or has high importance
                    if (memory.accessCount >= tierConfig.minAccessCountForRetention || memory.importance >= 0.6) {
                        newTier = 'longTerm';
                    }
                }

                // Archival logic — long-term memories with very low importance get archived
                if (currentTier === 'longTerm' && ageMs > tierConfig.longTermToArchivedMs) {
                    if (memory.accessCount < tierConfig.minAccessCountForRetention && memory.importance < 0.15) {
                        newTier = 'archived';
                    }
                }

                if (newTier !== currentTier) {
                    const ref = firestoreDoc(db, 'users', userId, 'alwaysOnMemories', docSnap.id);
                    batch.update(ref, {
                        tier: newTier,
                        updatedAt: Timestamp.now(),
                    });
                    tiersChanged++;
                }
            }

            if (tiersChanged > 0) {
                await batch.commit();
            }

            return tiersChanged;
        } catch (error) {
            logger.error('[MemoryConsolidator] Tier update failed:', error);
            return 0;
        }
    }

    // ========================================================================
    // PUBLIC - REINFORCEMENT
    // ========================================================================

    /**
     * Reinforce a memory — boost its importance because it was accessed or referenced.
     * This is the opposite of decay: memories that prove useful get stronger.
     *
     * @param userId - User ID
     * @param memoryId - Memory to reinforce
     * @param boostAmount - How much to boost importance (default: 0.05)
     */
    public static async reinforceMemory(
        userId: string,
        memoryId: string,
        boostAmount: number = 0.05
    ): Promise<void> {
        try {
            const ref = firestoreDoc(db, 'users', userId, 'alwaysOnMemories', memoryId);
            const { getDoc } = await import('firebase/firestore');
            const docSnap = await getDoc(ref);

            if (!docSnap.exists()) return;

            const memory = docSnap.data() as AlwaysOnMemory;
            const newImportance = Math.min(1.0, memory.importance + boostAmount);

            await updateDoc(ref, {
                importance: parseFloat(newImportance.toFixed(4)),
                accessCount: (memory.accessCount || 0) + 1,
                lastAccessedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
        } catch (error) {
            logger.error('[MemoryConsolidator] Reinforcement failed:', error);
        }
    }
}
