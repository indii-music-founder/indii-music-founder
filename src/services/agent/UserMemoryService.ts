/**
 * User Memory Service
 *
 * Provides persistent, long-term memory for individual users across all sessions and projects.
 * Handles CRUD operations, semantic search, memory consolidation, and context building.
 */

import { FirestoreService } from '../FirestoreService';
import { AI } from '../ai/AIService';
import { AI_MODELS, APPROVED_MODELS } from '@/core/config/ai-models';
import { RequestBatcher } from '@/utils/RequestBatcher';
import { Timestamp } from 'firebase/firestore';
import {
  UserMemory,
  UserContext,
  MemoryCategory,
  MemoryImportance,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryConsolidationConfig,
  MemoryAnalytics,
  MemoryBatchResult,
} from '@/types/UserMemory';

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Default consolidation configuration
const DEFAULT_CONSOLIDATION_CONFIG: MemoryConsolidationConfig = {
  similarityThreshold: 0.85,
  maxMemoriesPerCategory: 100,
  decayFactor: 0.1,
  consolidationInterval: 86400000, // 24 hours
};

class UserMemoryService {
  private embeddingModel = APPROVED_MODELS.EMBEDDING_DEFAULT;

  // Batcher for embedding requests to save tokens and improve performance
  private embeddingBatcher = new RequestBatcher<string, number[]>(
    async (texts) => {
      try {
        return await AI.batchEmbedContents(texts as any, this.embeddingModel);
      } catch (error) {
        console.error('[UserMemoryService] Batch embedding failed:', error);
        throw error;
      }
    },
    { maxBatchSize: 20, maxWaitMs: 50 }
  );

  private getCollectionPath(userId: string): string {
    return `users/${userId}/memories`;
  }

  private getContextPath(userId: string): string {
    return `users/${userId}/context`;
  }

  private getService(userId: string): FirestoreService<UserMemory> {
    return new FirestoreService<UserMemory>(this.getCollectionPath(userId));
  }

  private getContextService(userId: string): FirestoreService<UserContext> {
    return new FirestoreService<UserContext>(this.getContextPath(userId));
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      return await this.embeddingBatcher.add(text);
    } catch (error) {
      console.warn('[UserMemoryService] Failed to get embedding:', error);
      return [];
    }
  }

  /**
   * Save a new memory for a user
   */
  async saveMemory(
    userId: string,
    content: string,
    category: MemoryCategory = 'fact',
    importance: MemoryImportance = 'medium',
    options?: {
      tags?: string[];
      sourceSessionId?: string;
      sourceProjectId?: string;
      expiresAt?: Date;
      relatedMemoryIds?: string[];
    }
  ): Promise<string> {
    const service = this.getService(userId);

    // Check for exact duplicates
    let existingMemories: UserMemory[] = [];
    try {
      existingMemories = await service.list();
    } catch (e) {
      console.warn('[UserMemoryService] Failed to list memories for dedup: (Non-blocking)', e);
    }

    const duplicate = existingMemories.find((m) => m.content === content);
    if (duplicate) {
      console.log('[UserMemoryService] Duplicate memory detected, skipping');
      return duplicate.id;
    }

    // Generate embedding for semantic search
    const embedding = await this.getEmbedding(content);

    const now = Timestamp.now();
    const memory: Omit<UserMemory, 'id'> = {
      userId,
      content,
      category,
      importance,
      sourceSessionId: options?.sourceSessionId,
      sourceProjectId: options?.sourceProjectId,
      tags: options?.tags || [],
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      isActive: true,
      expiresAt: options?.expiresAt ? Timestamp.fromDate(options.expiresAt) : undefined,
      relatedMemoryIds: options?.relatedMemoryIds || [],
      embedding: embedding.length > 0 ? embedding : undefined,
      embeddingModel: embedding.length > 0 ? this.embeddingModel : undefined,
    };

    let memoryId = '';
    try {
      memoryId = await service.add(memory);
    } catch (e) {
      console.error('[UserMemoryService] Failed to save memory: (Non-blocking)', e);
    }

    // Update user context asynchronously
    this.updateUserContext(userId).catch((e) =>
      console.error('[UserMemoryService] Failed to update user context:', e)
    );

    console.log(`[UserMemoryService] Saved memory for user ${userId}: ${content.substring(0, 50)}...`);
    return memoryId;
  }

  /**
   * Retrieve a specific memory by ID
   */
  async getMemory(userId: string, memoryId: string): Promise<UserMemory | null> {
    const service = this.getService(userId);
    const memory = await service.get(memoryId);

    if (memory) {
      // Update access stats
      this.updateAccessStats(userId, [memory]).catch((e) =>
        console.warn('[UserMemoryService] Failed to update access stats: (Non-blocking)', e)
      );
    }

    return memory;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    userId: string,
    memoryId: string,
    updates: Partial<Omit<UserMemory, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    const service = this.getService(userId);

    // If content is being updated, regenerate embedding
    if (updates.content) {
      const embedding = await this.getEmbedding(updates.content);
      updates.embedding = embedding.length > 0 ? embedding : undefined;
      updates.embeddingModel = embedding.length > 0 ? this.embeddingModel : undefined;
    }

    updates.updatedAt = Timestamp.now();
    await service.update(memoryId, updates);

    console.log(`[UserMemoryService] Updated memory ${memoryId} for user ${userId}`);
  }

  /**
   * Delete a memory (hard delete)
   */
  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const service = this.getService(userId);
    await service.delete(memoryId);
    console.log(`[UserMemoryService] Deleted memory ${memoryId} for user ${userId}`);
  }

  /**
   * Deactivate a memory (soft delete)
   */
  async deactivateMemory(userId: string, memoryId: string): Promise<void> {
    await this.updateMemory(userId, memoryId, { isActive: false });
    console.log(`[UserMemoryService] Deactivated memory ${memoryId} for user ${userId}`);
  }

  /**
   * Search memories with semantic and metadata filtering
   */
  async searchMemories(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const { userId, categories, importance, tags, projectId, isActive = true, limit = 10, minRelevanceScore = 0.6 } = query;
    const service = this.getService(userId);

    try {
      let memories: UserMemory[] = [];
      try {
        memories = await service.list();
      } catch (e) {
        console.warn('[UserMemoryService] Failed to list memories for search: (Non-blocking)', e);
        return [];
      }

      // Apply metadata filters
      memories = memories.filter((m) => {
        if (isActive !== undefined && m.isActive !== isActive) return false;
        if (categories && !categories.includes(m.category)) return false;
        if (importance && !importance.includes(m.importance)) return false;
        if (projectId && m.sourceProjectId !== projectId) return false;
        if (tags && tags.length > 0 && !tags.some((t) => m.tags.includes(t))) return false;

        // Filter expired memories
        if (m.expiresAt && m.expiresAt.toMillis() < Date.now()) return false;

        return true;
      });

      if (memories.length === 0) return [];

      // If no query provided, return by importance and recency
      if (!query.query) {
        const sorted = memories
          .sort((a, b) => {
            const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            const aScore = importanceOrder[a.importance] + (a.accessCount * 0.01);
            const bScore = importanceOrder[b.importance] + (b.accessCount * 0.01);
            return bScore - aScore;
          })
          .slice(0, limit);

        return sorted.map((memory) => ({
          memory,
          relevanceScore: 1.0,
          matchedTags: [],
        }));
      }

      // Semantic search with embeddings
      const queryEmbedding = await this.getEmbedding(query.query);
      const hasVectorSupport = queryEmbedding.length > 0 && memories.some((m) => m.embedding && m.embedding.length > 0);

      let scored: { memory: UserMemory; relevanceScore: number; matchedTags: string[] }[];

      if (hasVectorSupport) {
        // Vector-based semantic search
        scored = memories.map((m) => {
          let vectorScore = 0;
          if (m.embedding && m.embedding.length > 0) {
            vectorScore = cosineSimilarity(queryEmbedding, m.embedding);
          }

          // Importance boost
          const importanceBoost = { critical: 0.3, high: 0.2, medium: 0.1, low: 0 }[m.importance];

          // Recency score (decay over 90 days)
          const daysOld = (Date.now() - m.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
          const recencyScore = 1 / (1 + 0.05 * daysOld);

          // Access frequency boost
          const frequencyBoost = Math.min(m.accessCount * 0.01, 0.1);

          // Final score: 60% semantic + 20% importance + 15% recency + 5% frequency
          const relevanceScore = vectorScore * 0.6 + importanceBoost + recencyScore * 0.15 + frequencyBoost;

          // Check for tag matches
          const matchedTags = tags ? m.tags.filter((t) => tags.includes(t)) : [];

          return { memory: m, relevanceScore, matchedTags };
        });
      } else {
        // Keyword-based fallback search
        const keywords = query.query.toLowerCase().split(' ').filter((w) => w.length > 2);
        scored = memories.map((m) => {
          let matchCount = 0;
          const content = m.content.toLowerCase();
          keywords.forEach((k) => {
            if (content.includes(k)) matchCount++;
          });

          const keywordScore = matchCount > 0 ? 0.5 + Math.min(matchCount * 0.1, 0.4) : 0;
          const importanceBoost = { critical: 0.3, high: 0.2, medium: 0.1, low: 0 }[m.importance];
          const relevanceScore = keywordScore + importanceBoost;

          const matchedTags = tags ? m.tags.filter((t) => tags.includes(t)) : [];

          return { memory: m, relevanceScore, matchedTags };
        });
      }

      // Sort by relevance and filter by minimum score
      const results = scored
        .filter((s) => s.relevanceScore >= minRelevanceScore)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      // Update access stats for retrieved memories
      this.updateAccessStats(
        userId,
        results.map((r) => r.memory)
      ).catch((e) => console.error('[UserMemoryService] Failed to update access stats:', e));

      return results;
    } catch (error) {
      console.error('[UserMemoryService] Error searching memories:', error);
      return [];
    }
  }

  /**
   * Get all memories for a user (with optional filtering)
   */
  async getAllMemories(
    userId: string,
    filters?: {
      categories?: MemoryCategory[];
      isActive?: boolean;
      limit?: number;
    }
  ): Promise<UserMemory[]> {
    const service = this.getService(userId);
    let memories = await service.list();

    if (filters) {
      if (filters.categories) {
        memories = memories.filter((m) => filters.categories!.includes(m.category));
      }
      if (filters.isActive !== undefined) {
        memories = memories.filter((m) => m.isActive === filters.isActive);
      }
      if (filters.limit) {
        memories = memories.slice(0, filters.limit);
      }
    }

    return memories;
  }

  /**
   * Update access statistics for memories
   */
  private async updateAccessStats(userId: string, memories: UserMemory[]): Promise<void> {
    const service = this.getService(userId);
    const now = Timestamp.now();
    const updates = memories.map((memory) =>
      service.update(memory.id, {
        accessCount: (memory.accessCount || 0) + 1,
        lastAccessedAt: now,
      })
    );
    await Promise.all(updates);
  }

  /**
   * Build and cache user context summary
   */
  async updateUserContext(userId: string): Promise<UserContext> {
    const service = this.getService(userId);
    const memories = await service.list();

    // Filter active memories
    const activeMemories = memories.filter((m) => m.isActive);

    // Get top preferences, goals, and facts
    const topPreferences = activeMemories
      .filter((m) => m.category === 'preference' && m.importance !== 'low')
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5)
      .map((m) => m.content);

    const activeGoals = activeMemories
      .filter((m) => m.category === 'goal' && m.isActive)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, 5)
      .map((m) => m.content);

    const keyFacts = activeMemories
      .filter((m) => m.category === 'fact' && (m.importance === 'critical' || m.importance === 'high'))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map((m) => m.content);

    // Generate natural language summary
    const summaryPrompt = `
You are a User Context Summarization Agent.

TASK:
Create a concise, natural language summary of this user based on their memory data.
Focus on preferences, goals, skills, and interaction patterns.

USER MEMORIES:
Preferences: ${topPreferences.join('; ')}
Goals: ${activeGoals.join('; ')}
Key Facts: ${keyFacts.join('; ')}

OUTPUT:
Return a 2-3 sentence summary that captures the essence of this user.
Be specific and actionable. Avoid generic statements.
    `.trim();

    let summary = '';
    try {
      const result = await AI.generateContent({
        model: AI_MODELS.TEXT.FAST,
        contents: { role: 'user', parts: [{ text: summaryPrompt }] },
      });
      summary = result.text() || 'No summary available';
    } catch (error) {
      console.error('[UserMemoryService] Failed to generate summary:', error);
      summary = 'Unable to generate summary';
    }

    // Calculate statistics
    const firstMemory = activeMemories.reduce(
      (oldest, m) => (m.createdAt.toMillis() < oldest.toMillis() ? m.createdAt : oldest),
      Timestamp.now()
    );

    const lastMemory = activeMemories.reduce(
      (latest, m) => (m.createdAt.toMillis() > latest.toMillis() ? m.createdAt : latest),
      Timestamp.fromMillis(0)
    );

    // Calculate interaction patterns from memory data
    const sessionIds = new Set(activeMemories.map(m => m.sourceSessionId).filter(Boolean));
    const totalSessions = sessionIds.size || 1;

    // Infer communication style from memory categories and lengths
    const avgContentLength = activeMemories.length > 0
      ? activeMemories.reduce((sum, m) => sum + m.content.length, 0) / activeMemories.length
      : 0;
    const preferredCommunicationStyle = avgContentLength > 150 ? 'detailed' : avgContentLength > 75 ? 'balanced' : 'concise';

    // Estimate average session length from memory timestamps per session
    let averageSessionLength = 0;
    if (sessionIds.size > 0) {
      const sessionDurations: number[] = [];
      sessionIds.forEach(sessionId => {
        const sessionMemories = activeMemories.filter(m => m.sourceSessionId === sessionId);
        if (sessionMemories.length >= 2) {
          const times = sessionMemories.map(m => m.createdAt.toMillis()).sort((a, b) => a - b);
          sessionDurations.push(times[times.length - 1] - times[0]);
        }
      });
      if (sessionDurations.length > 0) {
        averageSessionLength = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length / 60000; // minutes
      }
    }

    // Track most used features based on memory tags
    const featureCounts = new Map<string, number>();
    activeMemories.forEach(m => {
      m.tags.forEach(tag => {
        featureCounts.set(tag, (featureCounts.get(tag) || 0) + 1);
      });
    });
    const mostUsedFeatures = Array.from(featureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([feature]) => feature);

    // Track time of day usage patterns
    const timeOfDayUsage: Record<string, number> = {};
    activeMemories.forEach(m => {
      const hour = new Date(m.createdAt.toMillis()).getHours();
      const period = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      timeOfDayUsage[period] = (timeOfDayUsage[period] || 0) + 1;
    });

    const context: UserContext = {
      userId,
      summary,
      lastUpdated: Timestamp.now(),
      topPreferences,
      activeGoals,
      keyFacts,
      interactionPatterns: {
        preferredCommunicationStyle,
        averageSessionLength,
        mostUsedFeatures,
        timeOfDayUsage,
      },
      stats: {
        totalMemories: activeMemories.length,
        totalSessions,
        totalProjects: new Set(activeMemories.map((m) => m.sourceProjectId).filter(Boolean)).size,
        firstInteractionAt: firstMemory,
        lastInteractionAt: lastMemory,
      },
    };

    // Save context
    const contextService = this.getContextService(userId);
    try {
      await contextService.add(context);
    } catch (error) {
      console.error('[UserMemoryService] Failed to save context:', error);
    }

    return context;
  }

  /**
   * Get cached user context
   */
  async getUserContext(userId: string): Promise<UserContext | null> {
    const contextService = this.getContextService(userId);
    const contexts = await contextService.list();

    if (contexts.length === 0) {
      // Generate context if it doesn't exist
      return await this.updateUserContext(userId);
    }

    // Return most recent context
    const latestContext = contexts.sort((a, b) => b.lastUpdated.toMillis() - a.lastUpdated.toMillis())[0];

    // Refresh if older than 24 hours
    const isStale = Date.now() - latestContext.lastUpdated.toMillis() > 86400000;
    if (isStale) {
      this.updateUserContext(userId).catch((e) =>
        console.error('[UserMemoryService] Failed to refresh context:', e)
      );
    }

    return latestContext;
  }

  /**
   * Consolidate similar memories to reduce redundancy
   */
  async consolidateMemories(
    userId: string,
    config: Partial<MemoryConsolidationConfig> = {}
  ): Promise<MemoryBatchResult> {
    const fullConfig = { ...DEFAULT_CONSOLIDATION_CONFIG, ...config };
    const service = this.getService(userId);
    const memories = await service.list();

    let processedCount = 0;
    const errors: Array<{ memoryId: string; error: string }> = [];

    try {
      // Filter candidates for consolidation (facts older than 7 days)
      const candidates = memories.filter(
        (m) =>
          m.category === 'fact' &&
          m.isActive &&
          Date.now() - m.createdAt.toMillis() > 7 * 86400000 &&
          m.importance !== 'critical'
      );

      if (candidates.length < 5) {
        console.log('[UserMemoryService] Not enough memories to consolidate');
        return { success: true, processedCount: 0, errorCount: 0, errors: [] };
      }

      // Group by category and prepare for AI consolidation
      const textToSummarize = candidates.map((c) => `[${c.id}] ${c.content}`).join('\n');
      const existingSummaries = memories
        .filter((m) => m.category !== 'fact')
        .map((m) => m.content)
        .join('\n');

      const prompt = `
You are a Memory Consolidation Agent.

TASK:
Review the following memory fragments and consolidate them into concise, high-value summaries.
- Merge similar or related memories
- Discard redundant or trivial information
- Preserve critical details
- Check against existing summaries to avoid duplication

EXISTING SUMMARIES/RULES:
${existingSummaries}

MEMORY FRAGMENTS TO PROCESS (format: [id] content):
${textToSummarize}

OUTPUT RULES:
Return a strict JSON object with:
- "consolidated": Array of strings (new summary text)
- "idsToDelete": Array of memory IDs that were successfully incorporated

JSON FORMAT:
{
  "consolidated": ["summary 1", "summary 2"],
  "idsToDelete": ["id_1", "id_2"]
}
      `.trim();

      const result = await AI.generateContent({
        model: AI_MODELS.TEXT.FAST,
        contents: { role: 'user', parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json' },
      });

      const responseText = result.text() || '{}';
      const parsed = JSON.parse(responseText) as { consolidated: string[]; idsToDelete: string[] };

      // Delete redundant memories
      if (parsed.idsToDelete && parsed.idsToDelete.length > 0) {
        const deletePromises = parsed.idsToDelete.map(async (id) => {
          if (candidates.some((c) => c.id === id)) {
            try {
              await service.delete(id);
              processedCount++;
            } catch (error) {
              errors.push({ memoryId: id, error: String(error) });
            }
          }
        });
        await Promise.all(deletePromises);
      }

      // Add new consolidated memories
      if (parsed.consolidated && parsed.consolidated.length > 0) {
        const addPromises = parsed.consolidated.map((content) =>
          this.saveMemory(userId, content, 'fact', 'medium').catch((error) => {
            errors.push({ memoryId: 'new', error: String(error) });
          })
        );
        await Promise.all(addPromises);
      }

      console.log(
        `[UserMemoryService] Consolidated ${parsed.idsToDelete?.length || 0} memories into ${parsed.consolidated?.length || 0} summaries`
      );

      return {
        success: errors.length === 0,
        processedCount,
        errorCount: errors.length,
        errors,
      };
    } catch (error) {
      console.error('[UserMemoryService] Consolidation failed:', error);
      return {
        success: false,
        processedCount,
        errorCount: 1,
        errors: [{ memoryId: 'batch', error: String(error) }],
      };
    }
  }

  /**
   * Clear all memories for a user (use with caution)
   */
  async clearAllMemories(userId: string): Promise<void> {
    const service = this.getService(userId);
    const memories = await service.list();
    await Promise.all(memories.map((m) => service.delete(m.id)));
    console.log(`[UserMemoryService] Cleared all memories for user ${userId}`);
  }

  /**
   * Export user memories as JSON
   */
  async exportMemories(userId: string): Promise<UserMemory[]> {
    const service = this.getService(userId);
    return await service.list();
  }

  /**
   * Import memories from JSON (for migration or backup restoration)
   */
  async importMemories(userId: string, memories: Omit<UserMemory, 'id'>[]): Promise<MemoryBatchResult> {
    const service = this.getService(userId);
    let processedCount = 0;
    const errors: Array<{ memoryId: string; error: string }> = [];

    for (const memory of memories) {
      try {
        await service.add({ ...memory, userId });
        processedCount++;
      } catch (error) {
        errors.push({ memoryId: 'import', error: String(error) });
      }
    }

    return {
      success: errors.length === 0,
      processedCount,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * Regenerate embeddings for existing memories (migration helper)
   */
  async regenerateEmbeddings(userId: string): Promise<number> {
    const service = this.getService(userId);
    const memories = await service.list();

    let updated = 0;
    for (const memory of memories) {
      if (!memory.embedding || memory.embedding.length === 0) {
        const embedding = await this.getEmbedding(memory.content);
        if (embedding.length > 0) {
          await service.update(memory.id, {
            embedding,
            embeddingModel: this.embeddingModel,
          });
          updated++;
        }
      }
    }
    return updated;
  }

  /**
   * Get analytics for user memories
   */
  async getAnalytics(userId: string, days: number = 30): Promise<MemoryAnalytics> {
    const service = this.getService(userId);
    const memories = await service.list();

    const startTime = Timestamp.fromMillis(Date.now() - days * 86400000);
    const endTime = Timestamp.now();

    // Filter memories within the period
    const periodMemories = memories.filter(
      (m) => m.createdAt.toMillis() >= startTime.toMillis() && m.createdAt.toMillis() <= endTime.toMillis()
    );

    // Count by category
    const memoriesByCategory = {} as Record<MemoryCategory, number>;
    const categories: MemoryCategory[] = ['preference', 'fact', 'context', 'goal', 'skill', 'interaction', 'feedback', 'relationship'];
    categories.forEach((cat) => {
      memoriesByCategory[cat] = memories.filter((m) => m.category === cat).length;
    });

    // Count by importance
    const memoriesByImportance = {} as Record<MemoryImportance, number>;
    const importanceLevels: MemoryImportance[] = ['critical', 'high', 'medium', 'low'];
    importanceLevels.forEach((imp) => {
      memoriesByImportance[imp] = memories.filter((m) => m.importance === imp).length;
    });

    // Most accessed memories
    const mostAccessedMemories = memories
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map((m) => ({
        memoryId: m.id,
        content: m.content.substring(0, 100),
        accessCount: m.accessCount,
      }));

    // Calculate growth rate
    const memoryGrowthRate = periodMemories.length / days;

    // Calculate average lifespan
    const inactiveMemories = memories.filter((m) => !m.isActive);
    const averageMemoryLifespan =
      inactiveMemories.length > 0
        ? inactiveMemories.reduce((sum, m) => sum + (m.updatedAt.toMillis() - m.createdAt.toMillis()), 0) /
        inactiveMemories.length /
        86400000
        : 0;

    // Top tags
    const tagCounts = new Map<string, number>();
    memories.forEach((m) => {
      m.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    return {
      userId,
      period: { start: startTime, end: endTime },
      memoriesByCategory,
      memoriesByImportance,
      mostAccessedMemories,
      memoryGrowthRate,
      averageMemoryLifespan,
      topTags,
    };
  }
}

export const userMemoryService = new UserMemoryService();
