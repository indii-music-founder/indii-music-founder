/**
 * Always-On Memory Agent Types
 *
 * Extended type system for the Always-On Memory Agent — an active memory system
 * inspired by Google's ADK reference implementation, improved for indiiOS with
 * tiered memory, cross-cutting insights, multimodal ingestion, and importance decay.
 *
 * @see https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/agents/always-on-memory-agent
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// MEMORY TIERS
// ============================================================================

/**
 * Memory tiers model how the human brain stores information:
 * - Working:   Currently active, in-use information (seconds to minutes)
 * - ShortTerm: Recent information that hasn't been consolidated yet (hours to days)
 * - LongTerm:  Consolidated, high-value information (days to years)
 * - Archived:  Deprecated or superseded memories kept for reference
 */
export type MemoryTier = 'working' | 'shortTerm' | 'longTerm' | 'archived';

/**
 * Memory tier configuration — thresholds for automatic promotion/demotion
 */
export interface MemoryTierConfig {
    /** Maximum age (ms) before a working memory is promoted to short-term */
    workingToShortTermMs: number;
    /** Maximum age (ms) before a short-term memory is promoted to long-term */
    shortTermToLongTermMs: number;
    /** Minimum access count to prevent archival */
    minAccessCountForRetention: number;
    /** Maximum age (ms) before an unconsolidated long-term memory is archived */
    longTermToArchivedMs: number;
}

export const DEFAULT_TIER_CONFIG: MemoryTierConfig = {
    workingToShortTermMs: 1000 * 60 * 30,          // 30 minutes
    shortTermToLongTermMs: 1000 * 60 * 60 * 24,    // 24 hours
    minAccessCountForRetention: 2,
    longTermToArchivedMs: 1000 * 60 * 60 * 24 * 90, // 90 days
};

// ============================================================================
// CORE MEMORY TYPES
// ============================================================================

/**
 * Entity extracted from memory content — people, companies, products, concepts
 */
export interface MemoryEntity {
    name: string;
    type: 'person' | 'company' | 'product' | 'concept' | 'location' | 'genre' | 'tool' | 'other';
    /** Number of memories this entity appears in */
    mentionCount: number;
}

/**
 * Connection between two memories — a directed edge in the memory graph
 */
export interface MemoryConnection {
    fromMemoryId: string;
    toMemoryId: string;
    relationship: string;
    /** Confidence score 0.0-1.0, determined by the consolidation agent */
    confidence: number;
    discoveredAt: Timestamp;
}

/**
 * Extended memory item for the Always-On system.
 * Extends the existing UserMemory schema with tier, entities, connections, and decay.
 */
export interface AlwaysOnMemory {
    id: string;
    userId: string;

    // Content
    content: string;
    summary: string;
    rawText: string;
    category: AlwaysOnMemoryCategory;
    tier: MemoryTier;

    // Extracted structure
    entities: MemoryEntity[];
    topics: string[];
    importance: number; // 0.0 to 1.0 (continuous, not discrete levels)

    // Source tracking
    source: MemorySource;
    sourceSessionId?: string;
    sourceProjectId?: string;
    sourceFileName?: string;
    sourceMimeType?: string;

    // Metadata
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastAccessedAt: Timestamp;
    accessCount: number;

    // Lifecycle
    isActive: boolean;
    consolidated: boolean;
    expiresAt?: Timestamp;

    // Relationships
    connections: MemoryConnection[];
    relatedMemoryIds: string[];
    supersedes?: string;

    // Vector search
    embedding?: number[];
    embeddingModel?: string;

    // Tags
    tags: string[];
}

/**
 * Extended memory categories for indiiOS creative workflows
 */
export type AlwaysOnMemoryCategory =
    | 'preference'      // User preferences (e.g., "prefers dark mode", "likes Lo-Fi beats")
    | 'fact'            // Facts about the user (e.g., "is a music producer", "uses FL Studio")
    | 'context'         // Working context (e.g., "working on album project")
    | 'goal'            // User goals (e.g., "wants to release EP by June")
    | 'skill'           // User skills (e.g., "expert in sound design")
    | 'interaction'     // Interaction patterns (e.g., "asks detailed technical questions")
    | 'feedback'        // User feedback/corrections (e.g., "doesn't like auto-suggestions")
    | 'relationship'    // Social/professional relationships
    | 'creative'        // Creative decisions (e.g., "album art should use dark blue palette")
    | 'business'        // Business intel (e.g., "Spotify pays $0.003/stream", "distributor deadline March 15")
    | 'technical'       // Technical preferences (e.g., "master at -14 LUFS", "export as WAV 24-bit")
    | 'insight';        // System-generated cross-cutting insights

/**
 * Memory source — where the memory came from
 */
export type MemorySource =
    | 'user_input'      // Direct user typing
    | 'agent_extraction'// Extracted from agent conversation
    | 'file_ingestion'  // Ingested from a file (inbox watcher)
    | 'api_ingest'      // Ingested via API call
    | 'consolidation'   // Generated during consolidation
    | 'system';         // System-generated (e.g., usage pattern detection)

// ============================================================================
// CONSOLIDATION TYPES
// ============================================================================

/**
 * Result of a consolidation cycle — cross-cutting insights
 */
export interface ConsolidationInsight {
    id: string;
    userId: string;

    /** IDs of the source memories that were consolidated */
    sourceMemoryIds: string[];

    /** Synthesized summary across all sources */
    summary: string;

    /** The key pattern or insight discovered */
    insight: string;

    /** Connections found between source memories */
    connections: MemoryConnection[];

    /** When this consolidation occurred */
    createdAt: Timestamp;

    /** Confidence score for the insight (0.0-1.0) */
    confidence: number;
}

/**
 * Configuration for the consolidation engine
 */
export interface ConsolidationConfig {
    /** How often to run consolidation (ms). Default: 30 minutes */
    intervalMs: number;
    /** Minimum number of unconsolidated memories required to trigger consolidation */
    minMemoriesForConsolidation: number;
    /** How many memories to process per consolidation cycle (batch size) */
    batchSize: number;
    /** Similarity threshold for considering memories related (0.0-1.0) */
    similarityThreshold: number;
    /** Importance decay factor per day (0.0-1.0). e.g., 0.05 = lose 5% importance per day */
    importanceDecayPerDay: number;
    /** Minimum importance before a memory is considered for archival */
    archivalImportanceThreshold: number;
}

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
    intervalMs: 1000 * 60 * 30,           // 30 minutes
    minMemoriesForConsolidation: 2,
    batchSize: 10,
    similarityThreshold: 0.75,
    importanceDecayPerDay: 0.02,          // 2% per day
    archivalImportanceThreshold: 0.1,
};

// ============================================================================
// INGESTION TYPES
// ============================================================================

/**
 * Status of an ingestion event
 */
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

/**
 * Input content type for ingestion
 */
export type IngestionContentType =
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'pdf'
    | 'structured_data';

/**
 * Record of an ingestion event
 */
export interface IngestionEvent {
    id: string;
    userId: string;

    /** What type of content was ingested */
    contentType: IngestionContentType;

    /** Original source (filename, URL, "api", "user_input", etc.) */
    source: string;

    /** MIME type if applicable */
    mimeType?: string;

    /** Size in bytes if applicable */
    sizeBytes?: number;

    /** Processing status */
    status: IngestionStatus;

    /** ID of the resulting memory (if successful) */
    resultMemoryId?: string;

    /** Error message if failed */
    errorMessage?: string;

    /** Timestamps */
    createdAt: Timestamp;
    processedAt?: Timestamp;
}

/**
 * Supported file extensions and their MIME types — matches Google's 27 file types
 */
export const SUPPORTED_TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.json', '.csv', '.log', '.xml', '.yaml', '.yml',
]);

export const SUPPORTED_MEDIA_EXTENSIONS: Record<string, string> = {
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    // Video
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    // Documents
    '.pdf': 'application/pdf',
};

export const ALL_SUPPORTED_EXTENSIONS = new Set([
    ...SUPPORTED_TEXT_EXTENSIONS,
    ...Object.keys(SUPPORTED_MEDIA_EXTENSIONS),
]);

/** Maximum file size for inline Gemini ingestion (20MB) */
export const MAX_INLINE_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ============================================================================
// ENGINE STATE & CONFIG
// ============================================================================

/**
 * Runtime status of the Always-On Memory Engine
 */
export interface AlwaysOnEngineStatus {
    isRunning: boolean;
    isConsolidating: boolean;
    isIngesting: boolean;

    /** Total memories in the system */
    totalMemories: number;
    /** Memories not yet consolidated */
    unconsolidatedCount: number;
    /** Total consolidation insights */
    totalInsights: number;
    /** Memories by tier */
    memoriesByTier: Record<MemoryTier, number>;
    /** Memories by category */
    memoriesByCategory: Partial<Record<AlwaysOnMemoryCategory, number>>;

    /** When the engine was last started */
    startedAt?: Date;
    /** When the last consolidation cycle ran */
    lastConsolidatedAt?: Date;
    /** When the last ingestion occurred */
    lastIngestedAt?: Date;
}

/**
 * Full engine configuration
 */
export interface AlwaysOnMemoryConfig {
    /** User ID the engine operates for */
    userId: string;
    /** Consolidation configuration */
    consolidation: ConsolidationConfig;
    /** Memory tier configuration */
    tiers: MemoryTierConfig;
    /** Whether the file inbox watcher is enabled */
    inboxWatcherEnabled: boolean;
    /** Path to the inbox folder (Electron only) */
    inboxPath: string;
    /** Port for the HTTP API (0 = disabled) */
    apiPort: number;
}

export const DEFAULT_ENGINE_CONFIG: Omit<AlwaysOnMemoryConfig, 'userId'> = {
    consolidation: DEFAULT_CONSOLIDATION_CONFIG,
    tiers: DEFAULT_TIER_CONFIG,
    inboxWatcherEnabled: false,
    inboxPath: '~/indiiOS/memory-inbox',
    apiPort: 0,
};

// ============================================================================
// ZUSTAND STATE
// ============================================================================

/**
 * Zustand state slice for the Memory Agent dashboard
 */
export interface MemoryAgentSliceState {
    // Data
    memories: AlwaysOnMemory[];
    insights: ConsolidationInsight[];
    ingestionEvents: IngestionEvent[];
    engineStatus: AlwaysOnEngineStatus;

    // UI State
    isMemoryDashboardOpen: boolean;
    memorySearchQuery: string;
    memoryFilterCategory: AlwaysOnMemoryCategory | 'all';
    memoryFilterTier: MemoryTier | 'all';
    selectedMemoryId: string | null;

    // Actions
    setMemoryDashboardOpen: (open: boolean) => void;
    setMemorySearchQuery: (query: string) => void;
    setMemoryFilterCategory: (category: AlwaysOnMemoryCategory | 'all') => void;
    setMemoryFilterTier: (tier: MemoryTier | 'all') => void;
    setSelectedMemoryId: (id: string | null) => void;
    loadMemories: (userId: string) => Promise<void>;
    loadInsights: (userId: string) => Promise<void>;
    refreshEngineStatus: (userId: string) => Promise<void>;
    ingestText: (userId: string, text: string, source?: string) => Promise<void>;
    triggerConsolidation: (userId: string) => Promise<void>;
    deleteMemoryById: (userId: string, memoryId: string) => Promise<void>;
    queryMemory: (userId: string, question: string) => Promise<string>;
}
