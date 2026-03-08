/**
 * AlwaysOnMemoryEngine — Core Orchestrator Service
 *
 * A persistent, evolving memory system that runs in the background, continuously
 * processing, consolidating, and connecting information. Inspired by Google's
 * Always-On Memory Agent (ADK reference implementation), adapted for indiiOS.
 *
 * Responsibilities:
 * - Ingest text and multimodal content into structured memories
 * - Run periodic consolidation to find cross-cutting insights
 * - Answer natural language queries grounded in stored memories
 * - Manage memory lifecycle (tiers, importance decay, archival)
 *
 * @see https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/agents/always-on-memory-agent
 */

import { FirestoreService } from '../FirestoreService';
import { FirebaseAIService } from '../ai/FirebaseAIService';
import { AI_MODELS, APPROVED_MODELS } from '@/core/config/ai-models';
import { RequestBatcher } from '@/utils/RequestBatcher';
import { logger } from '@/utils/logger';
import { Timestamp } from 'firebase/firestore';
import { MemorySummarizer } from './memory/MemorySummarizer';
import type {
    AlwaysOnMemory,
    AlwaysOnMemoryCategory,
    AlwaysOnEngineStatus,
    AlwaysOnMemoryConfig,
    ConsolidationInsight,
    ConsolidationConfig,
    IngestionEvent,
    IngestionContentType,
    MemoryTier,
    MemoryTierConfig,
    MemorySource,
    DEFAULT_CONSOLIDATION_CONFIG as _DCC,
    DEFAULT_TIER_CONFIG as _DTC,
    DEFAULT_ENGINE_CONFIG as _DEC,
} from '@/types/AlwaysOnMemory';
import {
    DEFAULT_CONSOLIDATION_CONFIG,
    DEFAULT_TIER_CONFIG,
    DEFAULT_ENGINE_CONFIG,
} from '@/types/AlwaysOnMemory';

// ─── Helpers ────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

// ─── Firestore Collection Paths ─────────────────────────────────

function memoriesPath(userId: string): string {
    return `users/${userId}/alwaysOnMemories`;
}

function insightsPath(userId: string): string {
    return `users/${userId}/consolidationInsights`;
}

function ingestionEventsPath(userId: string): string {
    return `users/${userId}/ingestionEvents`;
}

// ─── AlwaysOnMemoryEngine ───────────────────────────────────────

export class AlwaysOnMemoryEngine {
    private userId: string | null = null;
    private config: Omit<AlwaysOnMemoryConfig, 'userId'> = { ...DEFAULT_ENGINE_CONFIG };
    private consolidationTimer: ReturnType<typeof setInterval> | null = null;
    private decayTimer: ReturnType<typeof setInterval> | null = null;
    private isRunning = false;
    private startedAt: Date | null = null;
    private lastConsolidatedAt: Date | null = null;
    private lastIngestedAt: Date | null = null;
    private isConsolidating = false;
    private isIngesting = false;

    private embeddingBatcher = new RequestBatcher<string, number[]>(
        async (texts) => {
            try {
                const ai = FirebaseAIService.getInstance();
                const results: number[][] = [];
                for (const text of texts) {
                    const result = await ai.embedContent({
                        model: APPROVED_MODELS.EMBEDDING_DEFAULT,
                        content: { role: 'user', parts: [{ text }] },
                    });
                    results.push(result.values || []);
                }
                return results;
            } catch (error) {
                logger.error('[AlwaysOnMemoryEngine] Batch embedding failed:', error);
                throw error;
            }
        },
        { maxBatchSize: 10, maxWaitMs: 50 }
    );

    // ─── Collection Accessors ──────────────────────────────────

    private getMemoryService(userId: string): FirestoreService<AlwaysOnMemory> {
        return new FirestoreService<AlwaysOnMemory>(memoriesPath(userId));
    }

    private getInsightService(userId: string): FirestoreService<ConsolidationInsight> {
        return new FirestoreService<ConsolidationInsight>(insightsPath(userId));
    }

    private getIngestionService(userId: string): FirestoreService<IngestionEvent> {
        return new FirestoreService<IngestionEvent>(ingestionEventsPath(userId));
    }

    private async getEmbedding(text: string): Promise<number[]> {
        try {
            return await this.embeddingBatcher.add(text);
        } catch (error) {
            logger.warn('[AlwaysOnMemoryEngine] Embedding failed (non-blocking):', error);
            return [];
        }
    }

    // ─── Lifecycle ─────────────────────────────────────────────

    /**
     * Start the memory engine for a given user.
     * Begins the consolidation timer and importance decay timer.
     */
    start(userId: string, config?: Partial<Omit<AlwaysOnMemoryConfig, 'userId'>>): void {
        if (this.isRunning && this.userId === userId) {
            logger.debug('[AlwaysOnMemoryEngine] Already running for this user.');
            return;
        }
        this.stop(); // Clean up any previous run.

        this.userId = userId;
        this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
        this.isRunning = true;
        this.startedAt = new Date();

        // Consolidation timer
        const consolidationMs = this.config.consolidation.intervalMs;
        this.consolidationTimer = setInterval(() => {
            this.runConsolidation(userId).catch((e) =>
                logger.error('[AlwaysOnMemoryEngine] Background consolidation error:', e)
            );
        }, consolidationMs);

        // Importance decay timer (once per day)
        this.decayTimer = setInterval(() => {
            this.applyImportanceDecay(userId).catch((e) =>
                logger.error('[AlwaysOnMemoryEngine] Importance decay error:', e)
            );
        }, 1000 * 60 * 60 * 24); // 24 hours

        logger.info(`[AlwaysOnMemoryEngine] Started for user ${userId}. Consolidation every ${consolidationMs / 60000}m.`);
    }

    /** Stop the memory engine and clear all timers. */
    stop(): void {
        if (this.consolidationTimer) {
            clearInterval(this.consolidationTimer);
            this.consolidationTimer = null;
        }
        if (this.decayTimer) {
            clearInterval(this.decayTimer);
            this.decayTimer = null;
        }
        this.isRunning = false;
        this.userId = null;
        logger.info('[AlwaysOnMemoryEngine] Stopped.');
    }

    // ─── Ingestion ─────────────────────────────────────────────

    /**
     * Ingest raw text into the memory system.
     * Performs entity extraction, topic assignment, importance scoring, and storage.
     */
    async ingestText(
        userId: string,
        text: string,
        source: MemorySource = 'user_input',
        category: AlwaysOnMemoryCategory = 'fact',
        sourceFileName?: string,
    ): Promise<string> {
        if (!text.trim()) {
            logger.warn('[AlwaysOnMemoryEngine] Empty text, skipping ingestion.');
            return '';
        }

        this.isIngesting = true;
        const eventId = await this.logIngestionEvent(userId, 'text', source, 'processing');

        try {
            // 1. Duplicate check (by content hash)
            const service = this.getMemoryService(userId);
            let existingMemories: AlwaysOnMemory[] = [];
            try {
                existingMemories = await service.list();
            } catch (e) {
                logger.warn('[AlwaysOnMemoryEngine] List for dedup failed (non-blocking):', e);
            }

            const duplicate = existingMemories.find((m) => m.rawText === text);
            if (duplicate) {
                logger.debug('[AlwaysOnMemoryEngine] Duplicate detected, skipping.');
                await this.updateIngestionEvent(userId, eventId, 'skipped');
                this.isIngesting = false;
                return duplicate.id;
            }

            // 2. Extract structured information in parallel
            const [entities, topics, importance, summary] = await Promise.all([
                MemorySummarizer.extractEntities(text),
                MemorySummarizer.assignTopics(text),
                MemorySummarizer.scoreImportance(text, category),
                this.generateSummary(text),
            ]);

            // 3. Generate embedding
            const embedding = await this.getEmbedding(summary || text);

            // 4. Store memory
            const now = Timestamp.now();
            const memory: Omit<AlwaysOnMemory, 'id'> = {
                userId,
                content: summary || text.slice(0, 500),
                summary: summary || text.slice(0, 200),
                rawText: text,
                category,
                tier: 'shortTerm',
                entities,
                topics,
                importance,
                source,
                sourceFileName,
                createdAt: now,
                updatedAt: now,
                lastAccessedAt: now,
                accessCount: 0,
                isActive: true,
                consolidated: false,
                connections: [],
                relatedMemoryIds: [],
                tags: topics,
                embedding: embedding.length > 0 ? embedding : undefined,
                embeddingModel: embedding.length > 0 ? APPROVED_MODELS.EMBEDDING_DEFAULT : undefined,
            };

            const memoryId = await service.add(memory);
            this.lastIngestedAt = new Date();
            await this.updateIngestionEvent(userId, eventId, 'completed', memoryId);

            logger.info(`[AlwaysOnMemoryEngine] 📥 Ingested memory #${memoryId}: ${summary?.slice(0, 60)}...`);
            this.isIngesting = false;
            return memoryId;
        } catch (error) {
            logger.error('[AlwaysOnMemoryEngine] Ingestion failed:', error);
            await this.updateIngestionEvent(userId, eventId, 'failed', undefined, String(error));
            this.isIngesting = false;
            throw error;
        }
    }

    /**
     * Ingest a multimodal file (image, audio, video, PDF) via Gemini.
     * Extracts content description, then stores as structured memory.
     */
    async ingestFile(
        userId: string,
        fileBytes: Uint8Array,
        mimeType: string,
        fileName: string,
    ): Promise<string> {
        this.isIngesting = true;
        const contentType = this.mimeToContentType(mimeType);
        const eventId = await this.logIngestionEvent(userId, contentType, fileName, 'processing', mimeType, fileBytes.length);

        try {
            const sizeMb = fileBytes.length / (1024 * 1024);
            if (sizeMb > 20) {
                logger.warn(`[AlwaysOnMemoryEngine] Skipping ${fileName} (${sizeMb.toFixed(1)}MB) — exceeds 20MB limit.`);
                await this.updateIngestionEvent(userId, eventId, 'skipped');
                this.isIngesting = false;
                return '';
            }

            // Use Gemini to describe the file content
            const mediaType = mimeType.split('/')[0];
            const prompt = `You are a Memory Ingest Agent. Analyze this ${mediaType} file ("${fileName}") thoroughly.\n\n` +
                `1. Describe what the content contains in detail.\n` +
                `2. Extract key information: entities, topics, and any text or spoken content.\n` +
                `3. Provide a concise 2-3 sentence summary.\n\n` +
                `Return your analysis as plain text — the summary first, followed by key details.`;

            // Encode file bytes to base64 for inline data
            const base64 = this.uint8ArrayToBase64(fileBytes);
            const parts = [
                { text: prompt },
                { inlineData: { mimeType, data: base64 } },
            ];

            const description = await FirebaseAIService.getInstance().generateText(
                parts as any,
                AI_MODELS.TEXT.FAST,
            );

            // Now ingest the extracted text like a normal text ingestion
            const memoryId = await this.ingestText(
                userId,
                description,
                'file_ingestion',
                'fact',
                fileName,
            );

            await this.updateIngestionEvent(userId, eventId, 'completed', memoryId);
            logger.info(`[AlwaysOnMemoryEngine] 🖼️ Ingested ${mediaType}: ${fileName}`);
            this.isIngesting = false;
            return memoryId;
        } catch (error) {
            logger.error(`[AlwaysOnMemoryEngine] File ingestion failed for ${fileName}:`, error);
            await this.updateIngestionEvent(userId, eventId, 'failed', undefined, String(error));
            this.isIngesting = false;
            throw error;
        }
    }

    // ─── Query ─────────────────────────────────────────────────

    /**
     * Answer a natural language question using stored memories and consolidation insights.
     * Returns a synthesized answer with memory citations.
     */
    async queryMemory(userId: string, question: string): Promise<string> {
        try {
            // 1. Read all memories (most recent first)
            const memoryService = this.getMemoryService(userId);
            let allMemories: AlwaysOnMemory[] = [];
            try {
                allMemories = await memoryService.list();
            } catch (e) {
                logger.warn('[AlwaysOnMemoryEngine] Failed to list memories for query:', e);
            }

            if (allMemories.length === 0) {
                return 'I don\'t have any memories stored yet. Try ingesting some information first.';
            }

            // 2. Rank memories by relevance to the question
            const relevantMemories = await this.rankMemories(allMemories, question);

            // 3. Read consolidation insights
            const insightService = this.getInsightService(userId);
            let insights: ConsolidationInsight[] = [];
            try {
                insights = await insightService.list();
            } catch (e) {
                logger.warn('[AlwaysOnMemoryEngine] Failed to list insights (non-blocking):', e);
            }

            // 4. Build context for Gemini
            const memoryBlock = relevantMemories.slice(0, 20).map((m) =>
                `[Memory ${m.id}] (${m.category}, importance: ${m.importance.toFixed(2)}, tier: ${m.tier})\n` +
                `  ${m.summary}\n` +
                `  Entities: [${m.entities.map((e) => e.name).join(', ')}]\n` +
                `  Topics: [${m.topics.join(', ')}]`
            ).join('\n\n');

            const insightBlock = insights.slice(0, 5).map((i) =>
                `[Insight] (confidence: ${i.confidence.toFixed(2)})\n  ${i.insight}`
            ).join('\n\n');

            const prompt = `You are a Memory Query Agent for a creative music/visual production platform.
Answer the user's question based ONLY on the stored memories and insights below.
Reference memory IDs: [Memory X] for citations.
If no relevant memories exist, say so honestly.

STORED MEMORIES:
${memoryBlock}

${insightBlock ? `CONSOLIDATION INSIGHTS:\n${insightBlock}` : ''}

USER QUESTION: ${question}

Be thorough but concise. Always cite your sources.`;

            const answer = await FirebaseAIService.getInstance().generateText(
                prompt,
                AI_MODELS.TEXT.FAST,
            );

            // 5. Update access stats for retrieved memories
            this.updateAccessStats(userId, relevantMemories.slice(0, 10)).catch((e) =>
                logger.warn('[AlwaysOnMemoryEngine] Access stat update failed (non-blocking):', e)
            );

            return answer;
        } catch (error) {
            logger.error('[AlwaysOnMemoryEngine] Query failed:', error);
            return 'Sorry, I encountered an error while searching my memories. Please try again.';
        }
    }

    // ─── Consolidation ─────────────────────────────────────────

    /**
     * Run a consolidation cycle — finds connections between unconsolidated memories,
     * generates cross-cutting insights, and updates the memory graph.
     */
    async runConsolidation(userId: string): Promise<ConsolidationInsight | null> {
        if (this.isConsolidating) {
            logger.debug('[AlwaysOnMemoryEngine] Consolidation already in progress, skipping.');
            return null;
        }

        this.isConsolidating = true;
        try {
            const service = this.getMemoryService(userId);
            let allMemories: AlwaysOnMemory[] = [];
            try {
                allMemories = await service.list();
            } catch (e) {
                logger.warn('[AlwaysOnMemoryEngine] Failed to list memories for consolidation:', e);
                this.isConsolidating = false;
                return null;
            }

            // Filter unconsolidated active memories
            const unconsolidated = allMemories.filter((m) => !m.consolidated && m.isActive);

            if (unconsolidated.length < this.config.consolidation.minMemoriesForConsolidation) {
                logger.info(`[AlwaysOnMemoryEngine] 🔄 Skipping consolidation (${unconsolidated.length} unconsolidated, need ${this.config.consolidation.minMemoriesForConsolidation}).`);
                this.isConsolidating = false;
                return null;
            }

            // Take a batch
            const batch = unconsolidated.slice(0, this.config.consolidation.batchSize);

            logger.info(`[AlwaysOnMemoryEngine] 🔄 Running consolidation on ${batch.length} memories...`);

            // Generate insight
            const insightData = await MemorySummarizer.generateInsight(userId, batch);

            if (!insightData) {
                logger.info('[AlwaysOnMemoryEngine] 🔄 No meaningful insight found in this batch.');
                // Still mark as consolidated to avoid re-processing
                await this.markConsolidated(userId, batch);
                this.isConsolidating = false;
                this.lastConsolidatedAt = new Date();
                return null;
            }

            // Store the insight
            const insightService = this.getInsightService(userId);
            const insightId = await insightService.add(insightData);

            // Update connections on source memories
            for (const conn of insightData.connections) {
                for (const memoryId of [conn.fromMemoryId, conn.toMemoryId]) {
                    const memory = batch.find((m) => m.id === memoryId);
                    if (memory) {
                        const linkedId = memoryId === conn.fromMemoryId ? conn.toMemoryId : conn.fromMemoryId;
                        const updatedConnections = [...(memory.connections || []), conn];
                        const updatedRelated = [...new Set([...(memory.relatedMemoryIds || []), linkedId])];
                        await service.update(memoryId, {
                            connections: updatedConnections,
                            relatedMemoryIds: updatedRelated,
                            updatedAt: Timestamp.now(),
                        } as Partial<AlwaysOnMemory>);
                    }
                }
            }

            // Mark source memories as consolidated
            await this.markConsolidated(userId, batch);

            // Also store the insight as a memory of type 'insight'
            await this.ingestText(
                userId,
                `Consolidation Insight: ${insightData.insight}\n\nContext: ${insightData.summary}`,
                'consolidation',
                'insight',
            );

            this.lastConsolidatedAt = new Date();
            this.isConsolidating = false;

            logger.info(`[AlwaysOnMemoryEngine] 🔄 Consolidation complete. Insight: ${insightData.insight.slice(0, 80)}...`);

            return { id: insightId, ...insightData } as ConsolidationInsight;
        } catch (error) {
            logger.error('[AlwaysOnMemoryEngine] Consolidation failed:', error);
            this.isConsolidating = false;
            return null;
        }
    }

    // ─── Memory Lifecycle ──────────────────────────────────────

    /**
     * Promote/demote memories between tiers based on age and access patterns.
     */
    async promoteMemoryTiers(userId: string): Promise<number> {
        const service = this.getMemoryService(userId);
        let memories: AlwaysOnMemory[] = [];
        try {
            memories = await service.list();
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to list memories for tier promotion:', e);
            return 0;
        }

        const now = Date.now();
        const tierConfig = this.config.tiers;
        let promoted = 0;

        for (const memory of memories) {
            if (!memory.isActive) continue;
            const age = now - memory.createdAt.toMillis();
            let newTier: MemoryTier | null = null;

            switch (memory.tier) {
                case 'working':
                    if (age > tierConfig.workingToShortTermMs) {
                        newTier = 'shortTerm';
                    }
                    break;
                case 'shortTerm':
                    if (age > tierConfig.shortTermToLongTermMs) {
                        newTier = memory.consolidated ? 'longTerm' : 'shortTerm'; // Only promote if consolidated
                    }
                    break;
                case 'longTerm':
                    if (
                        age > tierConfig.longTermToArchivedMs &&
                        memory.accessCount < tierConfig.minAccessCountForRetention
                    ) {
                        newTier = 'archived';
                    }
                    break;
            }

            if (newTier && newTier !== memory.tier) {
                await service.update(memory.id, {
                    tier: newTier,
                    updatedAt: Timestamp.now(),
                } as Partial<AlwaysOnMemory>);
                promoted++;
            }
        }

        if (promoted > 0) {
            logger.info(`[AlwaysOnMemoryEngine] Promoted ${promoted} memories between tiers.`);
        }
        return promoted;
    }

    /**
     * Apply importance decay over time — memories that aren't accessed lose importance.
     */
    async applyImportanceDecay(userId: string): Promise<number> {
        const service = this.getMemoryService(userId);
        let memories: AlwaysOnMemory[] = [];
        try {
            memories = await service.list();
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to list memories for decay:', e);
            return 0;
        }

        const now = Date.now();
        const decayPerDay = this.config.consolidation.importanceDecayPerDay;
        const archivalThreshold = this.config.consolidation.archivalImportanceThreshold;
        let updated = 0;

        for (const memory of memories) {
            if (!memory.isActive) continue;

            const lastAccessMs = memory.lastAccessedAt?.toMillis() || memory.createdAt.toMillis();
            const daysSinceAccess = (now - lastAccessMs) / (1000 * 60 * 60 * 24);

            if (daysSinceAccess < 1) continue; // Only decay memories older than 1 day

            const decay = decayPerDay * daysSinceAccess;
            const newImportance = Math.max(0, memory.importance - decay);

            if (newImportance !== memory.importance) {
                const updates: Partial<AlwaysOnMemory> = {
                    importance: newImportance,
                    updatedAt: Timestamp.now(),
                };

                // Archive if below threshold
                if (newImportance < archivalThreshold && memory.tier !== 'archived') {
                    updates.tier = 'archived';
                    updates.isActive = false;
                }

                await service.update(memory.id, updates);
                updated++;
            }
        }

        if (updated > 0) {
            logger.info(`[AlwaysOnMemoryEngine] Applied importance decay to ${updated} memories.`);
        }
        return updated;
    }

    // ─── CRUD ──────────────────────────────────────────────────

    /** Get all memories for a user, optionally filtered. */
    async getMemories(
        userId: string,
        filters?: {
            category?: AlwaysOnMemoryCategory;
            tier?: MemoryTier;
            search?: string;
            limit?: number;
        },
    ): Promise<AlwaysOnMemory[]> {
        const service = this.getMemoryService(userId);
        let memories: AlwaysOnMemory[] = [];
        try {
            memories = await service.list();
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to list memories:', e);
            return [];
        }

        // Apply filters
        if (filters?.category) {
            memories = memories.filter((m) => m.category === filters.category);
        }
        if (filters?.tier) {
            memories = memories.filter((m) => m.tier === filters.tier);
        }
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            memories = memories.filter(
                (m) =>
                    m.summary.toLowerCase().includes(q) ||
                    m.content.toLowerCase().includes(q) ||
                    m.topics.some((t) => t.includes(q)) ||
                    m.entities.some((e) => e.name.toLowerCase().includes(q))
            );
        }

        // Sort by importance + recency
        memories.sort((a, b) => {
            const scoreA = a.importance + (a.accessCount * 0.01);
            const scoreB = b.importance + (b.accessCount * 0.01);
            return scoreB - scoreA;
        });

        if (filters?.limit) {
            memories = memories.slice(0, filters.limit);
        }

        return memories;
    }

    /** Get all consolidation insights for a user. */
    async getInsights(userId: string): Promise<ConsolidationInsight[]> {
        try {
            return await this.getInsightService(userId).list();
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to list insights:', e);
            return [];
        }
    }

    /** Delete a specific memory by ID. */
    async deleteMemory(userId: string, memoryId: string): Promise<void> {
        const service = this.getMemoryService(userId);
        await service.delete(memoryId);
        logger.info(`[AlwaysOnMemoryEngine] 🗑️ Deleted memory #${memoryId}`);
    }

    /** Clear all memories, insights, and ingestion events. Full reset. */
    async clearAll(userId: string): Promise<{ memoriesDeleted: number; insightsDeleted: number }> {
        const memService = this.getMemoryService(userId);
        const insightService = this.getInsightService(userId);
        const ingestionService = this.getIngestionService(userId);

        const memories = await memService.list();
        const insights = await insightService.list();
        const events = await ingestionService.list();

        await Promise.all([
            ...memories.map((m) => memService.delete(m.id)),
            ...insights.map((i) => insightService.delete(i.id)),
            ...events.map((e) => ingestionService.delete(e.id)),
        ]);

        logger.info(`[AlwaysOnMemoryEngine] 🗑️ Cleared ${memories.length} memories, ${insights.length} insights.`);
        return { memoriesDeleted: memories.length, insightsDeleted: insights.length };
    }

    // ─── Status ────────────────────────────────────────────────

    /** Get the current engine status with memory statistics. */
    async getStatus(userId: string): Promise<AlwaysOnEngineStatus> {
        const service = this.getMemoryService(userId);
        let memories: AlwaysOnMemory[] = [];
        try {
            memories = await service.list();
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to list memories for status:', e);
        }

        let insightCount = 0;
        try {
            const insights = await this.getInsightService(userId).list();
            insightCount = insights.length;
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to count insights:', e);
        }

        const memoriesByTier: Record<MemoryTier, number> = {
            working: 0,
            shortTerm: 0,
            longTerm: 0,
            archived: 0,
        };
        const memoriesByCategory: Partial<Record<AlwaysOnMemoryCategory, number>> = {};

        for (const m of memories) {
            memoriesByTier[m.tier] = (memoriesByTier[m.tier] || 0) + 1;
            memoriesByCategory[m.category] = (memoriesByCategory[m.category] || 0) + 1;
        }

        return {
            isRunning: this.isRunning,
            isConsolidating: this.isConsolidating,
            isIngesting: this.isIngesting,
            totalMemories: memories.length,
            unconsolidatedCount: memories.filter((m) => !m.consolidated).length,
            totalInsights: insightCount,
            memoriesByTier,
            memoriesByCategory,
            startedAt: this.startedAt || undefined,
            lastConsolidatedAt: this.lastConsolidatedAt || undefined,
            lastIngestedAt: this.lastIngestedAt || undefined,
        };
    }

    // ─── Internal Helpers ──────────────────────────────────────

    private async generateSummary(text: string): Promise<string> {
        if (text.length < 200) return text;
        try {
            const prompt = `Summarize the following information in 1-2 concise sentences. Preserve specific names, numbers, and key details.\n\n${text.slice(0, 4000)}`;
            return await FirebaseAIService.getInstance().generateText(
                prompt,
                AI_MODELS.TEXT.FAST,
                { temperature: 0.2 } as any,
            );
        } catch (error) {
            logger.warn('[AlwaysOnMemoryEngine] Summary generation failed, using truncation:', error);
            return text.slice(0, 300);
        }
    }

    private async rankMemories(memories: AlwaysOnMemory[], query: string): Promise<AlwaysOnMemory[]> {
        // Try vector similarity ranking
        const queryEmbedding = await this.getEmbedding(query);
        const hasEmbeddings = queryEmbedding.length > 0 && memories.some((m) => m.embedding && m.embedding.length > 0);

        if (hasEmbeddings) {
            return memories
                .map((m) => {
                    const vectorScore = m.embedding && m.embedding.length > 0
                        ? cosineSimilarity(queryEmbedding, m.embedding)
                        : 0;
                    const importanceBoost = m.importance * 0.2;
                    const daysOld = (Date.now() - m.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
                    const recencyScore = 1 / (1 + 0.05 * daysOld);
                    const score = vectorScore * 0.6 + importanceBoost + recencyScore * 0.2;
                    return { memory: m, score };
                })
                .sort((a, b) => b.score - a.score)
                .map((item) => item.memory);
        }

        // Keyword fallback
        const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        return memories
            .map((m) => {
                const text = `${m.summary} ${m.content} ${m.topics.join(' ')} ${m.entities.map((e) => e.name).join(' ')}`.toLowerCase();
                const matchCount = keywords.filter((k) => text.includes(k)).length;
                const score = matchCount / Math.max(keywords.length, 1) + m.importance * 0.2;
                return { memory: m, score };
            })
            .sort((a, b) => b.score - a.score)
            .map((item) => item.memory);
    }

    private async markConsolidated(userId: string, memories: AlwaysOnMemory[]): Promise<void> {
        const service = this.getMemoryService(userId);
        await Promise.all(
            memories.map((m) =>
                service.update(m.id, {
                    consolidated: true,
                    updatedAt: Timestamp.now(),
                } as Partial<AlwaysOnMemory>)
            )
        );
    }

    private async updateAccessStats(userId: string, memories: AlwaysOnMemory[]): Promise<void> {
        const service = this.getMemoryService(userId);
        const now = Timestamp.now();
        await Promise.all(
            memories.map((m) =>
                service.update(m.id, {
                    accessCount: (m.accessCount || 0) + 1,
                    lastAccessedAt: now,
                } as Partial<AlwaysOnMemory>)
            )
        );
    }

    private async logIngestionEvent(
        userId: string,
        contentType: IngestionContentType,
        source: string,
        status: 'processing',
        mimeType?: string,
        sizeBytes?: number,
    ): Promise<string> {
        try {
            const service = this.getIngestionService(userId);
            return await service.add({
                userId,
                contentType,
                source,
                mimeType,
                sizeBytes,
                status,
                createdAt: Timestamp.now(),
            } as Omit<IngestionEvent, 'id'>);
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to log ingestion event (non-blocking):', e);
            return '';
        }
    }

    private async updateIngestionEvent(
        userId: string,
        eventId: string,
        status: 'completed' | 'failed' | 'skipped',
        resultMemoryId?: string,
        errorMessage?: string,
    ): Promise<void> {
        if (!eventId) return;
        try {
            const service = this.getIngestionService(userId);
            await service.update(eventId, {
                status,
                resultMemoryId,
                errorMessage,
                processedAt: Timestamp.now(),
            } as Partial<IngestionEvent>);
        } catch (e) {
            logger.warn('[AlwaysOnMemoryEngine] Failed to update ingestion event (non-blocking):', e);
        }
    }

    private mimeToContentType(mimeType: string): IngestionContentType {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType === 'application/pdf') return 'pdf';
        return 'text';
    }

    private uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

// ─── Singleton Export ───────────────────────────────────────────

export const alwaysOnMemoryEngine = new AlwaysOnMemoryEngine();
