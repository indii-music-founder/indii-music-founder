/**
 * User Memory Tools
 *
 * Provides agent tools for interacting with user-level persistent memory.
 * These tools enable agents to remember user preferences, facts, goals, and context
 * across all sessions and projects.
 */

// useStore removed

import { userMemoryService } from '@/services/agent/UserMemoryService';
import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import type { MemoryCategory, MemoryImportance } from '@/types/UserMemory';

// ============================================================================
// Types for UserMemoryTools
// ============================================================================

export const UserMemoryTools = {
  /**
   * Save a new memory to the user's persistent memory database
   */
  save_user_memory: wrapTool(
    'save_user_memory',
    async (
      args: {
        content: string;
        category?: MemoryCategory;
        importance?: MemoryImportance;
        tags?: string[];
      },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      const currentProjectId = toolContext
        ? toolContext.get('currentProjectId')
        : useStore.getState().currentProjectId;

      const currentSessionId = (toolContext
        ? toolContext.get('activeSessionId')
        : useStore.getState().activeSessionId) || undefined;

      try {
        const memoryId = await userMemoryService.saveMemory(
          userId,
          args.content,
          args.category || 'fact',
          args.importance || 'medium',
          {
            tags: args.tags,
            sourceProjectId: currentProjectId,
            sourceSessionId: currentSessionId,
          }
        );

        return {
          memoryId,
          content: args.content,
          category: args.category || 'fact',
          importance: args.importance || 'medium',
          message: `User memory saved: "${args.content.substring(0, 50)}${args.content.length > 50 ? '...' : ''}"`,
        };
      } catch (error) {
        return toolError(`Failed to save user memory: ${error}`, 'SAVE_FAILED');
      }
    }
  ),

  /**
   * Search user memories using semantic search
   */
  search_user_memory: wrapTool(
    'search_user_memory',
    async (
      args: {
        query: string;
        categories?: MemoryCategory[];
        importance?: MemoryImportance[];
        tags?: string[];
        limit?: number;
      },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        const results = await userMemoryService.searchMemories({
          userId,
          query: args.query,
          categories: args.categories,
          importance: args.importance,
          tags: args.tags,
          limit: args.limit || 10,
        });

        return {
          results: results.map((r) => ({
            content: r.memory.content,
            category: r.memory.category,
            importance: r.memory.importance,
            relevanceScore: r.relevanceScore,
            tags: r.memory.tags,
            createdAt: r.memory.createdAt.toDate().toISOString(),
          })),
          count: results.length,
          message:
            results.length > 0
              ? `Found ${results.length} relevant memories.`
              : 'No relevant memories found.',
        };
      } catch (error) {
        return toolError(`Failed to search user memories: ${error}`, 'SEARCH_FAILED');
      }
    }
  ),

  /**
   * Get aggregated user context summary
   */
  get_user_context: wrapTool(
    'get_user_context',
    async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        const context = await userMemoryService.getUserContext(userId);

        if (!context) {
          return {
            context: null,
            message: 'No user context available yet.',
          };
        }

        return {
          context: {
            summary: context.summary,
            topPreferences: context.topPreferences,
            activeGoals: context.activeGoals,
            keyFacts: context.keyFacts,
            stats: {
              totalMemories: context.stats.totalMemories,
              totalSessions: context.stats.totalSessions,
              totalProjects: context.stats.totalProjects,
            },
          },
          message: 'User context retrieved successfully.',
        };
      } catch (error) {
        return toolError(`Failed to get user context: ${error}`, 'CONTEXT_FAILED');
      }
    }
  ),

  /**
   * List user memories with optional filtering
   */
  list_user_memories: wrapTool(
    'list_user_memories',
    async (
      args: {
        categories?: MemoryCategory[];
        isActive?: boolean;
        limit?: number;
      },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        const memories = await userMemoryService.getAllMemories(userId, {
          categories: args.categories,
          isActive: args.isActive !== undefined ? args.isActive : true,
          limit: args.limit || 50,
        });

        return {
          memories: memories.map((m) => ({
            id: m.id,
            content: m.content,
            category: m.category,
            importance: m.importance,
            tags: m.tags,
            accessCount: m.accessCount,
            createdAt: m.createdAt.toDate().toISOString(),
            isActive: m.isActive,
          })),
          count: memories.length,
          message: `Retrieved ${memories.length} memories.`,
        };
      } catch (error) {
        return toolError(`Failed to list user memories: ${error}`, 'LIST_FAILED');
      }
    }
  ),

  /**
   * Update an existing user memory
   */
  update_user_memory: wrapTool(
    'update_user_memory',
    async (
      args: {
        memoryId: string;
        content?: string;
        category?: MemoryCategory;
        importance?: MemoryImportance;
        tags?: string[];
        isActive?: boolean;
      },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        const updates: any = {};
        if (args.content !== undefined) updates.content = args.content;
        if (args.category !== undefined) updates.category = args.category;
        if (args.importance !== undefined) updates.importance = args.importance;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.isActive !== undefined) updates.isActive = args.isActive;

        await userMemoryService.updateMemory(userId, args.memoryId, updates);

        return {
          memoryId: args.memoryId,
          updates,
          message: `Memory ${args.memoryId} updated successfully.`,
        };
      } catch (error) {
        return toolError(`Failed to update user memory: ${error}`, 'UPDATE_FAILED');
      }
    }
  ),

  /**
   * Deactivate a user memory (soft delete)
   */
  deactivate_user_memory: wrapTool(
    'deactivate_user_memory',
    async (
      args: { memoryId: string },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        await userMemoryService.deactivateMemory(userId, args.memoryId);

        return {
          memoryId: args.memoryId,
          message: `Memory ${args.memoryId} has been deactivated.`,
        };
      } catch (error) {
        return toolError(`Failed to deactivate user memory: ${error}`, 'DEACTIVATE_FAILED');
      }
    }
  ),

  /**
   * Delete a user memory permanently (hard delete)
   */
  delete_user_memory: wrapTool(
    'delete_user_memory',
    async (
      args: { memoryId: string },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        await userMemoryService.deleteMemory(userId, args.memoryId);

        return {
          memoryId: args.memoryId,
          message: `Memory ${args.memoryId} has been permanently deleted.`,
        };
      } catch (error) {
        return toolError(`Failed to delete user memory: ${error}`, 'DELETE_FAILED');
      }
    }
  ),

  /**
   * Get analytics about user memories
   */
  get_user_memory_analytics: wrapTool(
    'get_user_memory_analytics',
    async (
      args: { days?: number },
      _context?: AgentContext,
      toolContext?: ToolExecutionContext
    ) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        const analytics = await userMemoryService.getAnalytics(userId, args.days || 30);

        return {
          analytics: {
            period: {
              start: analytics.period.start.toDate().toISOString(),
              end: analytics.period.end.toDate().toISOString(),
            },
            memoriesByCategory: analytics.memoriesByCategory,
            memoriesByImportance: analytics.memoriesByImportance,
            memoryGrowthRate: analytics.memoryGrowthRate,
            topTags: analytics.topTags,
          },
          message: `Analytics generated for the last ${args.days || 30} days.`,
        };
      } catch (error) {
        return toolError(`Failed to get user memory analytics: ${error}`, 'ANALYTICS_FAILED');
      }
    }
  ),

  /**
   * Consolidate user memories to reduce redundancy
   */
  consolidate_user_memories: wrapTool(
    'consolidate_user_memories',
    async (_args, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
      const { useStore } = await import('@/core/store');
      const userId = toolContext ? toolContext.get('user')?.uid : useStore.getState().user?.uid;

      if (!userId) {
        return toolError('User not authenticated.', 'AUTH_REQUIRED');
      }

      try {
        const result = await userMemoryService.consolidateMemories(userId);

        return {
          success: result.success,
          processedCount: result.processedCount,
          errorCount: result.errorCount,
          message: result.success
            ? `Successfully consolidated ${result.processedCount} memories.`
            : `Consolidation completed with ${result.errorCount} errors.`,
        };
      } catch (error) {
        return toolError(`Failed to consolidate user memories: ${error}`, 'CONSOLIDATION_FAILED');
      }
    }
  ),
} satisfies Record<string, AnyToolFunction>;
