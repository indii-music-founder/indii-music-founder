import { logger } from '@/utils/logger';
import { db } from '../../firebase';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    deleteDoc,
    writeBatch,
    doc as firestoreDoc,
    getCountFromServer,
    Timestamp,
} from 'firebase/firestore';
import { FirebaseAIService as AIService } from '../../ai/FirebaseAIService';
import type { GenerationConfig } from '@/shared/types/ai.dto';
import { MemoryConsolidator } from './MemoryConsolidator';
import { MemoryIngestionPipeline, memoryIngestionPipeline } from './MemoryIngestionPipeline';
import { MemorySummarizer } from './MemorySummarizer';
import type {
    AlwaysOnMemory,
    AlwaysOnMemoryConfig,
    AlwaysOnEngineStatus,
    ConsolidationInsight,
    MemoryTier,
    AlwaysOnMemoryCategory,
} from '@/types/AlwaysOnMemory';
import {
    DEFAULT_ENGINE_CONFIG,
    DEFAULT_CONSOLIDATION_CONFIG,
} from '@/types/AlwaysOnMemory';

// ============================================================================
// ENGINE
// ============================================================================

/**
 * AlwaysOnMemoryEngine — The central orchestrator for the Always-On Memory Agent.
 *
 * Mirrors Google's hub-and-spoke ADK pattern in TypeScript:
 * - IngestAgent → MemoryIngestionPipeline (text, files, sessions)
 * - ConsolidateAgent → MemoryConsolidator (timer-based background consolidation)
 * - QueryAgent → Built-in query synthesis with citation references
 *
 * Key improvements over Google's reference:
 * 1. Tiered memory (working → shortTerm → longTerm → archived)
 * 2. Importance decay and reinforcement
 * 3. Entity graph for cross-memory connections
 * 4. Domain-aware categories for creative workflows
 * 5. Firestore persistence with cloud sync
 * 6. Integrated with indiiOS agent architecture
 *
 * @example
 * ```typescript
 * const engine = AlwaysOnMemoryEngine.getInstance();
 * await engine.start('user-123');
 *
 * // Ingest text
 * await engine.ingest('User prefers dark blue album art with minimal typography');
 *
 * // Query
 * const answer = await engine.query('What are the visual preferences?');
 *
 * // Manual consolidation
 * await engine.consolidateNow();
 *
 * // Stop
 * engine.stop();
 * ```
 */
export class AlwaysOnMemoryEngine {
    private static instance: AlwaysOnMemoryEngine | null = null;

    private userId: string = '';
    private config: AlwaysOnMemoryConfig | null = null;
    private consolidationTimer: ReturnType<typeof setInterval> | null = null;
    private isRunning = false;
    private isConsolidating = false;
    private isIngesting = false;
    private startedAt: Date | null = null;
    private lastConsolidatedAt: Date | null = null;
    private lastIngestedAt: Date | null = null;
    private pipeline: MemoryIngestionPipeline;

    private constructor() {
        this.pipeline = memoryIngestionPipeline;
    }

    /**
     * Get the singleton instance of the engine.
     */
    public static getInstance(): AlwaysOnMemoryEngine {
        if (!AlwaysOnMemoryEngine.instance) {
            AlwaysOnMemoryEngine.instance = new AlwaysOnMemoryEngine();
        }
        return AlwaysOnMemoryEngine.instance;
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    /**
     * Start the Always-On Memory Engine for a specific user.
     * Begins the background consolidation timer.
     *
     * @param userId - The user to operate for
     * @param config - Optional configuration overrides
     */
    public async start(
        userId: string,
        config?: Partial<Omit<AlwaysOnMemoryConfig, 'userId'>>
    ): Promise<void> {
        if (this.isRunning && this.userId === userId) {
            logger.info('[AlwaysOnMemoryEngine] Already running for this user');
            return;
        }

        // Stop any existing engine
        if (this.isRunning) {
            this.stop();
        }

        this.userId = userId;
        this.config = {
            userId,
            ...DEFAULT_ENGINE_CONFIG,
            ...config,
        };
        this.isRunning = true;
        this.startedAt = new Date();

        // Start the consolidation timer
        const intervalMs = this.config.consolidation.intervalMs;
        this.consolidationTimer = setInterval(async () => {
            await this.runConsolidationCycle();
        }, intervalMs);

        logger.info(
            `[AlwaysOnMemoryEngine] 🧠 Started for user ${userId}\n` +
            `   Consolidation: every ${intervalMs / 60000}m\n` +
            `   Inbox watcher: ${this.config.inboxWatcherEnabled ? 'enabled' : 'disabled'}`
        );
    }

    /**
     * Stop the engine and clear all timers.
     */
    public stop(): void {
        if (this.consolidationTimer) {
            clearInterval(this.consolidationTimer);
            this.consolidationTimer = null;
        }
        this.isRunning = false;
        logger.info('[AlwaysOnMemoryEngine] 🧠 Engine stopped');
    }

    /**
     * Check if the engine is currently running.
     */
    public get running(): boolean {
        return this.isRunning;
    }

    // ========================================================================
    // INGEST (IngestAgent equivalent)
    // ========================================================================

    /**
     * Ingest text into the memory system.
     *
     * @param text - The text to remember
     * @param source - Where this came from (default: 'user_input')
     * @param category - Optional category override
     * @returns Summary of what was stored
     */
    public async ingest(
        text: string,
        source: string = 'user_input',
        category?: AlwaysOnMemoryCategory
    ): Promise<string> {
        if (!this.userId) throw new Error('Engine not started. Call start() first.');

        this.isIngesting = true;
        try {
            const result = await this.pipeline.ingestText(this.userId, { text, source, category });
            this.lastIngestedAt = new Date();

            if (result.skipped) {
                return `Skipped: ${result.skipReason}`;
            }
            return result.success
                ? `📥 Stored: ${result.summary}`
                : `❌ Failed: ${result.error}`;
        } finally {
            this.isIngesting = false;
        }
    }

    /**
     * Ingest a file into the memory system.
     *
     * @param fileBytes - Raw file content
     * @param fileName - Original filename
     * @param mimeType - MIME type of the file
     * @returns Summary of what was stored
     */
    public async ingestFile(
        fileBytes: Uint8Array,
        fileName: string,
        mimeType: string
    ): Promise<string> {
        if (!this.userId) throw new Error('Engine not started. Call start() first.');

        this.isIngesting = true;
        try {
            const result = await this.pipeline.ingestFile(this.userId, {
                fileBytes,
                fileName,
                mimeType,
                sizeBytes: fileBytes.length,
            });
            this.lastIngestedAt = new Date();

            return result.success
                ? `🔮 Ingested ${fileName}: ${result.summary}`
                : `❌ Failed: ${result.error}`;
        } finally {
            this.isIngesting = false;
        }
    }

    /**
     * Ingest key memories from an agent conversation session.
     *
     * @param messages - Conversation messages
     * @param sessionId - Session ID for tracking
     * @returns Number of memories extracted
     */
    public async ingestFromSession(
        messages: Array<{ role: string; text: string }>,
        sessionId: string
    ): Promise<number> {
        if (!this.userId) throw new Error('Engine not started. Call start() first.');

        this.isIngesting = true;
        try {
            const results = await this.pipeline.ingestFromSession(this.userId, messages, sessionId);
            this.lastIngestedAt = new Date();
            return results.filter(r => r.success && !r.skipped).length;
        } finally {
            this.isIngesting = false;
        }
    }

    // ========================================================================
    // CONSOLIDATE (ConsolidateAgent equivalent)
    // ========================================================================

    /**
     * Trigger an immediate consolidation cycle.
     * Normally runs on a timer, but can be called manually.
     */
    public async consolidateNow(): Promise<string> {
        return this.runConsolidationCycle();
    }

    /**
     * Internal consolidation cycle runner.
     */
    private async runConsolidationCycle(): Promise<string> {
        if (!this.userId) return 'Engine not started';
        if (this.isConsolidating) return 'Consolidation already in progress';

        this.isConsolidating = true;
        try {
            const config = this.config?.consolidation || DEFAULT_CONSOLIDATION_CONFIG;
            const result = await MemoryConsolidator.runConsolidationCycle(this.userId, config);
            this.lastConsolidatedAt = new Date();

            return (
                `🔄 Consolidation complete: ` +
                `${result.memoriesProcessed} processed, ` +
                `${result.insightsGenerated} insights, ` +
                `${result.connectionsFound} connections`
            );
        } catch (error) {
            logger.error('[AlwaysOnMemoryEngine] Consolidation failed:', error);
            return `❌ Consolidation failed: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            this.isConsolidating = false;
        }
    }

    // ========================================================================
    // QUERY (QueryAgent equivalent)
    // ========================================================================

    /**
     * Query the memory system with a natural language question.
     * Reads all memories and consolidation insights, then synthesizes an answer
     * with source citations.
     *
     * @param question - The question to answer
     * @returns Synthesized answer with [Memory X] citations
     */
    public async query(question: string): Promise<string> {
        if (!this.userId) throw new Error('Engine not started. Call start() first.');

        try {
            // Step 1: Fetch all memories (most recent first)
            const memories = await this.getAllMemories(50);

            // Step 2: Fetch consolidation insights
            const insights = await this.getInsights(10);

            // Step 3: If no memories exist, say so honestly
            if (memories.length === 0) {
                return 'I don\'t have any memories stored yet. Try ingesting some information first.';
            }

            // Step 4: Build a context block for the LLM
            const memoryBlock = memories.map((m, i) =>
                `[Memory ${m.id}] (${m.category}, importance: ${m.importance.toFixed(2)}, ` +
                `tier: ${m.tier}):\n  ${m.summary || m.content}`
            ).join('\n\n');

            const insightBlock = insights.length > 0
                ? '\n\nCONSOLIDATION INSIGHTS:\n' + insights.map((ins, i) =>
                    `[Insight ${i + 1}]: ${ins.insight} (from memories: ${ins.sourceMemoryIds.join(', ')})`
                ).join('\n')
                : '';

            // Step 5: Synthesize answer using Gemini Pro for deep reasoning
            const prompt = `You are a Memory Query Agent for a creative music/visual production platform called indiiOS.
Answer the following question based ONLY on the stored memories and insights below.
Reference memory IDs in your answer like [Memory abc123].
If no relevant memories exist for the question, say so honestly.
Be thorough but concise. Always cite your sources.

MEMORIES:
${memoryBlock}
${insightBlock}

QUESTION: ${question}

ANSWER:`;

            const answer = await AIService.getInstance().generateText(
                prompt,
                0,
                { temperature: 0.3 } as Record<string, unknown>
            );

            // Step 6: Reinforce accessed memories (boost importance of relevant ones)
            this.reinforceAccessedMemories(memories, answer).catch(err => {
                logger.error('[AlwaysOnMemoryEngine] Reinforcement failed:', err);
            });

            return answer;
        } catch (error) {
            logger.error('[AlwaysOnMemoryEngine] Query failed:', error);
            return `❌ Query failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    // ========================================================================
    // STATUS & MANAGEMENT
    // ========================================================================

    /**
     * Get the current status of the engine.
     */
    public async getStatus(): Promise<AlwaysOnEngineStatus> {
        const status: AlwaysOnEngineStatus = {
            isRunning: this.isRunning,
            isConsolidating: this.isConsolidating,
            isIngesting: this.isIngesting,
            totalMemories: 0,
            unconsolidatedCount: 0,
            totalInsights: 0,
            memoriesByTier: { working: 0, shortTerm: 0, longTerm: 0, archived: 0 },
            memoriesByCategory: {},
            startedAt: this.startedAt || undefined,
            lastConsolidatedAt: this.lastConsolidatedAt || undefined,
            lastIngestedAt: this.lastIngestedAt || undefined,
        };

        if (!this.userId) return status;

        try {
            // Get total count
            const memoryRef = collection(db, 'users', this.userId, 'alwaysOnMemories');
            const totalSnap = await getCountFromServer(query(memoryRef, where('isActive', '==', true)));
            status.totalMemories = totalSnap.data().count;

            // Get unconsolidated count
            const unconsolidatedSnap = await getCountFromServer(
                query(memoryRef, where('consolidated', '==', false), where('isActive', '==', true))
            );
            status.unconsolidatedCount = unconsolidatedSnap.data().count;

            // Get insights count
            const insightRef = collection(db, 'users', this.userId, 'consolidationInsights');
            const insightSnap = await getCountFromServer(query(insightRef));
            status.totalInsights = insightSnap.data().count;

            // Get tier breakdown (fetch a sample to estimate)
            const tierSample = await getDocs(
                query(memoryRef, where('isActive', '==', true), limit(200))
            );
            for (const doc of tierSample.docs) {
                const data = doc.data();
                const tier = (data.tier || 'working') as MemoryTier;
                status.memoriesByTier[tier] = (status.memoriesByTier[tier] || 0) + 1;

                const category = data.category as AlwaysOnMemoryCategory;
                if (category) {
                    status.memoriesByCategory[category] = (status.memoriesByCategory[category] || 0) + 1;
                }
            }
        } catch (error) {
            logger.error('[AlwaysOnMemoryEngine] Status fetch failed:', error);
        }

        return status;
    }

    /**
     * Get all memories for the current user.
     */
    public async getAllMemories(maxCount: number = 50): Promise<AlwaysOnMemory[]> {
        if (!this.userId) return [];

        const memoryRef = collection(db, 'users', this.userId, 'alwaysOnMemories');
        const q = query(
            memoryRef,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(maxCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as AlwaysOnMemory[];
    }

    /**
     * Get consolidation insights for the current user.
     */
    public async getInsights(maxCount: number = 10): Promise<ConsolidationInsight[]> {
        if (!this.userId) return [];

        const insightRef = collection(db, 'users', this.userId, 'consolidationInsights');
        const q = query(
            insightRef,
            orderBy('createdAt', 'desc'),
            limit(maxCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as ConsolidationInsight[];
    }

    /**
     * Delete a specific memory.
     */
    public async deleteMemory(memoryId: string): Promise<void> {
        if (!this.userId) throw new Error('Engine not started');

        const ref = firestoreDoc(db, 'users', this.userId, 'alwaysOnMemories', memoryId);
        await deleteDoc(ref);
        logger.info(`[AlwaysOnMemoryEngine] 🗑️ Deleted memory ${memoryId}`);
    }

    /**
     * Clear all memories and insights for the current user. Full reset.
     */
    public async clearAll(): Promise<{ memoriesDeleted: number; insightsDeleted: number }> {
        if (!this.userId) throw new Error('Engine not started');

        let memoriesDeleted = 0;
        let insightsDeleted = 0;

        // Delete all memories
        const memoryRef = collection(db, 'users', this.userId, 'alwaysOnMemories');
        const memorySnapshot = await getDocs(query(memoryRef, limit(500)));
        const memBatch = writeBatch(db);
        for (const doc of memorySnapshot.docs) {
            memBatch.delete(doc.ref);
            memoriesDeleted++;
        }
        if (memoriesDeleted > 0) await memBatch.commit();

        // Delete all insights
        const insightRef = collection(db, 'users', this.userId, 'consolidationInsights');
        const insightSnapshot = await getDocs(query(insightRef, limit(500)));
        const insBatch = writeBatch(db);
        for (const doc of insightSnapshot.docs) {
            insBatch.delete(doc.ref);
            insightsDeleted++;
        }
        if (insightsDeleted > 0) await insBatch.commit();

        // Delete all ingestion events
        const eventRef = collection(db, 'users', this.userId, 'ingestionEvents');
        const eventSnapshot = await getDocs(query(eventRef, limit(500)));
        const evtBatch = writeBatch(db);
        for (const doc of eventSnapshot.docs) {
            evtBatch.delete(doc.ref);
        }
        if (!eventSnapshot.empty) await evtBatch.commit();

        logger.info(
            `[AlwaysOnMemoryEngine] 🗑️ Full reset: ${memoriesDeleted} memories, ${insightsDeleted} insights deleted`
        );

        return { memoriesDeleted, insightsDeleted };
    }

    // ========================================================================
    // PRIVATE - UTILITY
    // ========================================================================

    /**
     * Reinforce memories that were referenced in a query answer.
     * Memories that prove useful get an importance boost.
     */
    private async reinforceAccessedMemories(
        memories: AlwaysOnMemory[],
        answer: string
    ): Promise<void> {
        // Find memory IDs referenced in the answer
        for (const memory of memories) {
            if (answer.includes(memory.id) || answer.includes(`Memory ${memory.id}`)) {
                await MemoryConsolidator.reinforceMemory(this.userId, memory.id, 0.03);
            }
        }
    }
}

// Export singleton accessor
export const alwaysOnMemoryEngine = AlwaysOnMemoryEngine.getInstance();
