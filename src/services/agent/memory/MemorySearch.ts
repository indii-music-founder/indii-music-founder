/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { db } from '../../firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit as firestoreLimit,
} from 'firebase/firestore';
import { FirebaseAIService as AIService } from '../../ai/FirebaseAIService';
import { APPROVED_MODELS } from '@/core/config/ai-models';
import { RequestBatcher } from '@/utils/RequestBatcher';
import { logger } from '@/utils/logger';
import type {
    AlwaysOnMemory,
    AlwaysOnMemoryCategory,
    MemoryTier,
    ConsolidationInsight,
} from '@/types/AlwaysOnMemory';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i]! * b[i]!;
        normA += a[i]! * a[i]!;
        normB += b[i]! * b[i]!;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================================================
// SEARCH OPTIONS
// ============================================================================

export interface MemorySearchOptions {
    /** Natural language search query */
    query: string;
    /** Filter by categories */
    categories?: AlwaysOnMemoryCategory[];
    /** Filter by tiers */
    tiers?: MemoryTier[];
    /** Filter by minimum importance */
    minImportance?: number;
    /** Filter by tags */
    tags?: string[];
    /** Filter by date range [startMs, endMs] */
    dateRange?: [number, number];
    /** Include consolidation insights in results */
    includeInsights?: boolean;
    /** Include connected memories when a match is found */
    includeConnections?: boolean;
    /** Maximum number of results */
    maxResults?: number;
}

export interface MemorySearchResult {
    memory: AlwaysOnMemory;
    /** Relevance score (0.0-1.0) combining semantic similarity, importance, and recency */
    relevanceScore: number;
    /** Why this memory matched */
    matchReason: 'semantic' | 'keyword' | 'entity' | 'topic' | 'connection';
}

export interface SearchResponse {
    results: MemorySearchResult[];
    insights: ConsolidationInsight[];
    totalCandidates: number;
    query: string;
}

// ============================================================================
// SEARCH ENGINE
// ============================================================================

/**
 * MemorySearch — Upgraded search engine for the Always-On Memory Agent.
 *
 * Improvements over the original:
 * - Consolidation-aware: includes insights in search results
 * - Connection traversal: when a memory matches, also returns connected memories
 * - Tier-based ranking: long-term and high-importance memories rank higher
 * - Multi-signal scoring: combines semantic similarity, importance, recency, and tier
 * - Keyword fallback: when embedding search fails, falls back to keyword matching
 */
export class MemorySearch {
    private static embeddingBatcher = new RequestBatcher<string, number[]>(
        async (texts: string[]) => {
            try {
                const results = await AIService.getInstance().batchEmbedContents(
                    texts,
                    APPROVED_MODELS.EMBEDDING_DEFAULT
                );
                return results;
            } catch (error) {
                logger.error('[MemorySearch] Batch embedding failed:', error);
                return texts.map(() => []);
            }
        },
        { maxBatchSize: 5, maxWaitMs: 100 }
    );

    /**
     * Search memories with semantic and metadata filtering.
     *
     * @param userId - User ID to search within
     * @param options - Search options (query, filters, etc.)
     * @returns Search response with ranked results and optional insights
     */
    public static async search(
        userId: string,
        options: MemorySearchOptions
    ): Promise<SearchResponse> {
        const {
            query: searchQuery,
            categories,
            tiers,
            minImportance,
            tags,
            dateRange,
            includeInsights = true,
            includeConnections = false,
            maxResults = 10,
        } = options;

        const response: SearchResponse = {
            results: [],
            insights: [],
            totalCandidates: 0,
            query: searchQuery,
        };

        try {
            // Step 1: Fetch candidate memories
            const candidates = await this.fetchCandidates(userId, {
                categories,
                tiers,
                minImportance,
                tags,
                dateRange,
                maxCandidates: maxResults * 4, // Fetch 4x for ranking headroom
            });

            response.totalCandidates = candidates.length;

            if (candidates.length === 0) return response;

            // Step 2: Score and rank candidates
            const scored = await this.scoreAndRank(searchQuery, candidates);

            // Step 3: Take top results
            const topResults = scored.slice(0, maxResults);

            // Step 4: Include connected memories if requested
            if (includeConnections && topResults.length > 0) {
                const connectedMemories = await this.getConnectedMemories(
                    userId,
                    topResults.map(r => r.memory),
                    candidates
                );
                // Add connected memories that aren't already in results
                const existingIds = new Set(topResults.map(r => r.memory.id));
                for (const conn of connectedMemories) {
                    if (!existingIds.has(conn.id)) {
                        topResults.push({
                            memory: conn,
                            relevanceScore: 0.3, // Lower score for connection-based matches
                            matchReason: 'connection',
                        });
                        existingIds.add(conn.id);
                    }
                }
            }

            response.results = topResults;

            // Step 5: Include consolidation insights if requested
            if (includeInsights) {
                response.insights = await this.searchInsights(userId, searchQuery);
            }
        } catch (error) {
            logger.error('[MemorySearch] Search failed:', error);
        }

        return response;
    }

    /**
     * Legacy API: Searches memories using vector embedding similarity.
     * Preserved for backward compatibility with existing code.
     */
    public static async searchBySimilarity(
        userId: string,
        queryText: string,
        maxResults: number = 5
    ): Promise<AlwaysOnMemory[]> {
        const response = await this.search(userId, {
            query: queryText,
            maxResults,
            includeInsights: false,
        });
        return response.results.map(r => r.memory);
    }

    /**
     * Legacy API: Filters memories by specific metadata fields.
     * Preserved for backward compatibility with existing code.
     */
    public static async filterByType(
        userId: string,
        type: string,
        maxResults: number = 10
    ): Promise<AlwaysOnMemory[]> {
        const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');
        const q = query(
            memoryRef,
            where('category', '==', type),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            firestoreLimit(maxResults)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AlwaysOnMemory[];
    }

    // ========================================================================
    // PRIVATE - CANDIDATE FETCHING
    // ========================================================================

    private static async fetchCandidates(
        userId: string,
        filters: {
            categories?: AlwaysOnMemoryCategory[];
            tiers?: MemoryTier[];
            minImportance?: number;
            tags?: string[];
            dateRange?: [number, number];
            maxCandidates: number;
        }
    ): Promise<AlwaysOnMemory[]> {
        const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');

        // Build constraints — Firestore limits compound queries, so we filter in code
        const constraints: any[] = [
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            firestoreLimit(filters.maxCandidates),
        ];

        const snapshot = await getDocs(query(memoryRef, ...constraints));
        let candidates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as AlwaysOnMemory[];

        // Apply client-side filters
        if (filters.categories?.length) {
            candidates = candidates.filter(m => filters.categories!.includes(m.category));
        }
        if (filters.tiers?.length) {
            candidates = candidates.filter(m => filters.tiers!.includes(m.tier));
        }
        if (filters.minImportance !== undefined) {
            candidates = candidates.filter(m => m.importance >= filters.minImportance!);
        }
        if (filters.tags?.length) {
            const tagSet = new Set(filters.tags.map(t => t.toLowerCase()));
            candidates = candidates.filter(m =>
                (m.tags || []).some(t => tagSet.has(t.toLowerCase()))
            );
        }
        if (filters.dateRange) {
            const [startMs, endMs] = filters.dateRange;
            candidates = candidates.filter(m => {
                const createdMs = m.createdAt?.toMillis?.() || 0;
                return createdMs >= startMs && createdMs <= endMs;
            });
        }

        return candidates;
    }

    // ========================================================================
    // PRIVATE - SCORING & RANKING
    // ========================================================================

    /**
     * Score and rank candidates using a multi-signal approach:
     * - Semantic similarity (embedding cosine similarity)
     * - Importance score
     * - Recency (exponential decay)
     * - Tier bonus (long-term and short-term memories get a boost)
     */
    private static async scoreAndRank(
        queryText: string,
        candidates: AlwaysOnMemory[]
    ): Promise<MemorySearchResult[]> {
        // Get query embedding
        let queryEmbedding: number[] = [];
        try {
            queryEmbedding = await this.embeddingBatcher.add(queryText);
        } catch (error) {
            logger.warn('[MemorySearch] Query embedding failed, using keyword fallback');
        }

        const now = Date.now();
        const queryWords = new Set(queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2));

        const scored: MemorySearchResult[] = candidates.map(memory => {
            let semanticScore = 0;
            let matchReason: MemorySearchResult['matchReason'] = 'keyword';

            // Semantic similarity
            if (queryEmbedding.length > 0 && memory.embedding?.length) {
                semanticScore = cosineSimilarity(queryEmbedding, memory.embedding);
                if (semanticScore > 0.3) matchReason = 'semantic';
            }

            // Keyword fallback
            if (semanticScore < 0.3) {
                const contentWords = new Set(
                    (memory.content || '').toLowerCase().split(/\s+/).filter(w => w.length > 2)
                );
                const overlap = [...queryWords].filter(w => contentWords.has(w)).length;
                const keywordScore = queryWords.size > 0 ? overlap / queryWords.size : 0;
                semanticScore = Math.max(semanticScore, keywordScore * 0.8);
            }

            // Entity match bonus
            const entityNames = (memory.entities || []).map(e => e.name.toLowerCase());
            const entityMatch = entityNames.some(name =>
                queryText.toLowerCase().includes(name)
            );
            if (entityMatch) {
                semanticScore = Math.max(semanticScore, 0.5);
                matchReason = 'entity';
            }

            // Topic match bonus
            const topicMatch = (memory.topics || []).some(topic =>
                queryText.toLowerCase().includes(topic.toLowerCase())
            );
            if (topicMatch) {
                semanticScore = Math.max(semanticScore, 0.4);
                if (matchReason === 'keyword') matchReason = 'topic';
            }

            // Importance score (0-1)
            const importanceScore = memory.importance || 0.5;

            // Recency score (exponential decay, half-life of 30 days)
            const ageMs = now - (memory.createdAt?.toMillis?.() || now);
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            const recencyScore = Math.exp(-ageDays / 30);

            // Tier bonus
            const tierBonus: Record<string, number> = {
                longTerm: 0.15,
                shortTerm: 0.10,
                working: 0.05,
                archived: -0.10,
            };
            const tierScore = tierBonus[memory.tier || 'working'] || 0;

            // Combined relevance score (weighted)
            const relevanceScore = Math.min(1.0, Math.max(0,
                semanticScore * 0.50 +    // 50% semantic similarity
                importanceScore * 0.20 +  // 20% importance
                recencyScore * 0.20 +     // 20% recency
                tierScore * 0.10          // 10% tier
            ));

            return { memory, relevanceScore, matchReason };
        });

        // Sort by relevance score (descending)
        scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return scored;
    }

    // ========================================================================
    // PRIVATE - CONNECTION TRAVERSAL
    // ========================================================================

    /**
     * Get memories connected to the matched memories.
     */
    private static async getConnectedMemories(
        userId: string,
        matchedMemories: AlwaysOnMemory[],
        allCandidates: AlwaysOnMemory[]
    ): Promise<AlwaysOnMemory[]> {
        const connectedIds = new Set<string>();
        const matchedIds = new Set(matchedMemories.map(m => m.id));

        for (const memory of matchedMemories) {
            // Add related memory IDs
            for (const relId of (memory.relatedMemoryIds || [])) {
                if (!matchedIds.has(relId)) connectedIds.add(relId);
            }
            // Add connection targets
            for (const conn of (memory.connections || [])) {
                if (!matchedIds.has(conn.toMemoryId)) connectedIds.add(conn.toMemoryId);
                if (!matchedIds.has(conn.fromMemoryId)) connectedIds.add(conn.fromMemoryId);
            }
        }

        // Find connected memories in our candidate pool
        const candidateMap = new Map(allCandidates.map(m => [m.id, m]));
        const connected: AlwaysOnMemory[] = [];

        for (const id of connectedIds) {
            const existing = candidateMap.get(id);
            if (existing) {
                connected.push(existing);
            }
        }

        return connected;
    }

    // ========================================================================
    // PRIVATE - INSIGHT SEARCH
    // ========================================================================

    /**
     * Search consolidation insights relevant to the query.
     */
    private static async searchInsights(
        userId: string,
        queryText: string,
        maxResults: number = 5
    ): Promise<ConsolidationInsight[]> {
        try {
            const insightRef = collection(db, 'users', userId, 'consolidationInsights');
            const q = query(
                insightRef,
                orderBy('createdAt', 'desc'),
                firestoreLimit(maxResults * 2) // Fetch extra for keyword filtering
            );

            const snapshot = await getDocs(q);
            const insights = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as ConsolidationInsight[];

            // Filter by keyword relevance
            const queryWords = new Set(
                queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
            );

            if (queryWords.size === 0) return insights.slice(0, maxResults);

            const scored = insights.map(insight => {
                const insightWords = new Set(
                    `${insight.summary} ${insight.insight}`.toLowerCase().split(/\s+/)
                );
                const overlap = [...queryWords].filter(w => insightWords.has(w)).length;
                return { insight, score: overlap / queryWords.size };
            });

            scored.sort((a, b) => b.score - a.score);
            return scored
                .filter(s => s.score > 0.1)
                .slice(0, maxResults)
                .map(s => s.insight);
        } catch (error) {
            logger.error('[MemorySearch] Insight search failed:', error);
            return [];
        }
    }
}
