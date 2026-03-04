/**
 * User Memory Database Schema
 *
 * Provides persistent, long-term memory for individual users across all sessions and projects.
 * Memory is stored at the user level and accessible across the entire application.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Categories of user memory for organization and retrieval
 */
export type MemoryCategory =
  | 'preference'      // User preferences and settings (e.g., "prefers dark mode", "likes minimal UI")
  | 'fact'           // Facts about the user (e.g., "is a music producer", "uses FL Studio")
  | 'context'        // Working context (e.g., "working on album project", "learning mixing")
  | 'goal'           // User goals and objectives (e.g., "wants to release EP by June")
  | 'skill'          // User skills and expertise (e.g., "expert in sound design")
  | 'interaction'    // Notable interaction patterns (e.g., "asks detailed technical questions")
  | 'feedback'       // User feedback and corrections (e.g., "doesn't like auto-suggestions")
  | 'relationship';  // Social/professional relationships (e.g., "collaborates with @username")

/**
 * Memory importance levels for prioritization
 */
export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low';

/**
 * Core user memory item
 */
export interface UserMemory {
  id: string;
  userId: string;

  // Content
  content: string;              // The actual memory content
  category: MemoryCategory;     // Memory classification
  importance: MemoryImportance; // Priority level

  // Context
  sourceSessionId?: string;     // Session where memory originated
  sourceProjectId?: string;     // Project where memory originated
  tags: string[];               // Searchable tags

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;          // How often this memory is retrieved

  // Lifecycle
  isActive: boolean;            // Can be deactivated without deletion
  expiresAt?: Timestamp;        // Optional expiration for temporary memories

  // Relationships
  relatedMemoryIds: string[];   // IDs of related memories
  supersedes?: string;          // ID of memory this replaces

  // Vector search
  embedding?: number[];         // Vector embedding for semantic search
  embeddingModel?: string;      // Model used for embedding (e.g., "gemini-embedding-001")
}

/**
 * Aggregated user context for quick access
 */
export interface UserContext {
  userId: string;

  // Summary
  summary: string;              // Natural language summary of user
  lastUpdated: Timestamp;

  // Quick access facts
  topPreferences: string[];     // Most important preferences
  activeGoals: string[];        // Current active goals
  keyFacts: string[];          // Most important facts

  // Patterns
  interactionPatterns: {
    preferredCommunicationStyle: string;
    averageSessionLength: number;
    mostUsedFeatures: string[];
    timeOfDayUsage: Record<string, number>;
  };

  // Statistics
  stats: {
    totalMemories: number;
    totalSessions: number;
    totalProjects: number;
    firstInteractionAt: Timestamp;
    lastInteractionAt: Timestamp;
  };
}

/**
 * Memory search query parameters
 */
export interface MemorySearchQuery {
  userId: string;
  query?: string;                    // Semantic search query
  categories?: MemoryCategory[];     // Filter by categories
  importance?: MemoryImportance[];   // Filter by importance
  tags?: string[];                   // Filter by tags
  projectId?: string;                // Filter by source project
  isActive?: boolean;                // Filter by active status
  limit?: number;                    // Maximum results
  minRelevanceScore?: number;        // Minimum similarity score (0-1)
}

/**
 * Memory search result with relevance scoring
 */
export interface MemorySearchResult {
  memory: UserMemory;
  relevanceScore: number;           // Semantic similarity score (0-1)
  matchedTags: string[];            // Tags that matched the query
}

/**
 * Memory consolidation configuration
 */
export interface MemoryConsolidationConfig {
  similarityThreshold: number;      // Threshold for considering memories similar
  maxMemoriesPerCategory: number;   // Maximum memories to keep per category
  decayFactor: number;              // How much to decrease importance over time
  consolidationInterval: number;    // How often to consolidate (ms)
}

/**
 * Memory analytics for insights
 */
export interface MemoryAnalytics {
  userId: string;
  period: {
    start: Timestamp;
    end: Timestamp;
  };

  memoriesByCategory: Record<MemoryCategory, number>;
  memoriesByImportance: Record<MemoryImportance, number>;

  mostAccessedMemories: Array<{
    memoryId: string;
    content: string;
    accessCount: number;
  }>;

  memoryGrowthRate: number;         // Memories added per day
  averageMemoryLifespan: number;    // Average time before memory becomes inactive

  topTags: Array<{
    tag: string;
    count: number;
  }>;
}

/**
 * Batch memory operation result
 */
export interface MemoryBatchResult {
  success: boolean;
  processedCount: number;
  errorCount: number;
  errors: Array<{
    memoryId: string;
    error: string;
  }>;
}
