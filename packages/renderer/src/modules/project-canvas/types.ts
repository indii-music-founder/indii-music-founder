/**
 * Project Canvas Canonical Data Model & Types
 *
 * Defines the core types and Zod schemas for indii.music Project Canvas:
 * - ProjectCanvasDocument
 * - ProjectCanvasBlock
 * - ProjectCanvasEdge
 * - EntityReference
 *
 * Architectural constraints:
 * 1. Blocks reference canonical entities via EntityReference.
 * 2. Canvas does NOT store note bodies, workflow graphs, or binary media data.
 * 3. Semantic edges are non-executing (association, lineage, context, sequence).
 */

import { z } from 'zod';

// ============================================================================
// Entity Reference
// ============================================================================

export type EntityKind =
    | 'asset'
    | 'note'
    | 'document'
    | 'workflow'
    | 'workflow_run'
    | 'approval'
    | 'project_entity'
    | 'agent_output';

export const EntityReferenceSchema = z.object({
    kind: z.enum([
        'asset',
        'note',
        'document',
        'workflow',
        'workflow_run',
        'approval',
        'project_entity',
        'agent_output',
    ]),
    entityId: z.string().min(1),
    versionId: z.string().optional(),
    projectId: z.string().optional(),
    sourceService: z.string().optional(),
    runId: z.string().optional(),
});

export type EntityReference = z.infer<typeof EntityReferenceSchema>;

// ============================================================================
// Block Types & Display Settings
// ============================================================================

export type ProjectCanvasBlockType =
    | 'asset'
    | 'note'
    | 'document'
    | 'project_entity'
    | 'workflow'
    | 'workflow_run'
    | 'approval'
    | 'agent_output'
    | 'text'
    | 'frame';

export const BlockTypeEnum = z.enum([
    'asset',
    'note',
    'document',
    'project_entity',
    'workflow',
    'workflow_run',
    'approval',
    'agent_output',
    'text',
    'frame',
]);

export interface BlockPosition {
    x: number;
    y: number;
}

export interface BlockSize {
    width: number;
    height: number;
}

export interface BlockPresentationSettings {
    color?: string;
    collapsed?: boolean;
    headerBackground?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    customTitle?: string;
}

export interface BlockProvenance {
    creatorType: 'user' | 'agent' | 'workflow' | 'import' | 'derived';
    creatorId: string;
    agentName?: string;
    operation?: string;
    timestamp: number;
    correlationId?: string;
}

/** Non-authoritative display snapshot for fast cached rendering. */
export interface NonAuthoritativeSnapshot {
    title?: string;
    excerpt?: string;
    thumbnailUrl?: string;
    mediaType?: 'image' | 'audio' | 'video' | 'document';
    tags?: string[];
    cachedAt: number;
}

export const ProjectCanvasBlockSchema = z.object({
    id: z.string().min(1),
    type: BlockTypeEnum,
    canvasId: z.string().min(1),
    projectId: z.string().min(1),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    size: z.object({
        width: z.number().positive(),
        height: z.number().positive(),
    }),
    zIndex: z.number().int().min(0).max(1000).default(1),
    parentId: z.string().nullable().optional(),
    entityRef: EntityReferenceSchema.optional(),
    snapshot: z.object({
        title: z.string().optional(),
        excerpt: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        mediaType: z.enum(['image', 'audio', 'video', 'document']).optional(),
        tags: z.array(z.string()).optional(),
        cachedAt: z.number(),
    }).optional(),
    settings: z.record(z.unknown()).optional(),
    provenance: z.object({
        creatorType: z.enum(['user', 'agent', 'workflow', 'import', 'derived']),
        creatorId: z.string(),
        agentName: z.string().optional(),
        operation: z.string().optional(),
        timestamp: z.number(),
        correlationId: z.string().optional(),
    }).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});

export interface ProjectCanvasBlock {
    id: string;
    type: ProjectCanvasBlockType;
    canvasId: string;
    projectId: string;
    position: BlockPosition;
    size: BlockSize;
    zIndex: number;
    parentId?: string | null;
    entityRef?: EntityReference;
    snapshot?: NonAuthoritativeSnapshot;
    settings?: Record<string, unknown>;
    provenance?: BlockProvenance;
    createdAt: number;
    updatedAt: number;
}

// ============================================================================
// Semantic Edges (Non-Executing)
// ============================================================================

export type CanvasRelationshipType =
    | 'association' // these things belong together
    | 'lineage'     // target derived from source
    | 'context'     // source informed or supplied context to target
    | 'sequence';   // visual ordering (NOT executable automation)

export const CanvasRelationshipEnum = z.enum([
    'association',
    'lineage',
    'context',
    'sequence',
]);

export const ProjectCanvasEdgeSchema = z.object({
    id: z.string().min(1),
    canvasId: z.string().min(1),
    projectId: z.string().min(1),
    sourceBlockId: z.string().min(1),
    targetBlockId: z.string().min(1),
    relationship: CanvasRelationshipEnum,
    label: z.string().max(100).optional(),
    provenance: z.object({
        creatorType: z.enum(['user', 'agent', 'workflow']),
        creatorId: z.string(),
        timestamp: z.number(),
    }).optional(),
    createdAt: z.number(),
});

export interface ProjectCanvasEdge {
    id: string;
    canvasId: string;
    projectId: string;
    sourceBlockId: string;
    targetBlockId: string;
    relationship: CanvasRelationshipType;
    label?: string;
    provenance?: {
        creatorType: 'user' | 'agent' | 'workflow';
        creatorId: string;
        timestamp: number;
    };
    createdAt: number;
}

// ============================================================================
// Canvas Document
// ============================================================================

export interface CanvasViewport {
    x: number;
    y: number;
    zoom: number;
}

export const CanvasViewportSchema = z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
});

export const CURRENT_CANVAS_SCHEMA_VERSION = 1;

export const ProjectCanvasDocumentSchema = z.object({
    id: z.string().min(1),
    schemaVersion: z.number().int().min(1),
    projectId: z.string().min(1),
    ownerId: z.string().min(1),
    orgId: z.string().optional(),
    title: z.string().min(1).max(200),
    viewport: CanvasViewportSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
    lastEditorId: z.string().optional(),
    revision: z.number().int().min(0).default(0),
    templateId: z.string().optional(),
    blockIds: z.array(z.string()).default([]),
    edgeIds: z.array(z.string()).default([]),
});

export interface ProjectCanvasDocument {
    id: string;
    schemaVersion: number;
    projectId: string;
    ownerId: string;
    orgId?: string;
    title: string;
    viewport: CanvasViewport;
    createdAt: number;
    updatedAt: number;
    lastEditorId?: string;
    revision: number;
    templateId?: string;
    blockIds: string[];
    edgeIds: string[];
}

// ============================================================================
// Hydrated Entity Reference Status
// ============================================================================

export type HydratedEntityStatus =
    | 'resolved'
    | 'missing'
    | 'unauthorized'
    | 'loading'
    | 'error';

export interface HydratedEntityResult<T = unknown> {
    status: HydratedEntityStatus;
    reference: EntityReference;
    data?: T;
    errorMessage?: string;
}

// ============================================================================
// Schema Migration Helper
// ============================================================================

export function migrateCanvasDocument(rawDoc: unknown): ProjectCanvasDocument {
    if (!rawDoc || typeof rawDoc !== 'object') {
        throw new Error('Invalid canvas document: must be an object');
    }
    const doc = rawDoc as Record<string, unknown>;
    const version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;

    if (version === 1) {
        return ProjectCanvasDocumentSchema.parse({
            id: doc.id || `canvas_${doc.projectId || 'default'}`,
            schemaVersion: 1,
            projectId: doc.projectId || 'default',
            ownerId: doc.ownerId || 'unknown',
            orgId: doc.orgId,
            title: doc.title || 'Project Canvas',
            viewport: doc.viewport || { x: 0, y: 0, zoom: 1 },
            createdAt: typeof doc.createdAt === 'number' ? doc.createdAt : Date.now(),
            updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
            lastEditorId: doc.lastEditorId,
            revision: typeof doc.revision === 'number' ? doc.revision : 0,
            templateId: doc.templateId,
            blockIds: Array.isArray(doc.blockIds) ? doc.blockIds : [],
            edgeIds: Array.isArray(doc.edgeIds) ? doc.edgeIds : [],
        }) as ProjectCanvasDocument;
    }

    throw new Error(`Unsupported canvas document schema version: ${version}`);
}

// ============================================================================
// Phase 3: Canvas Snapshots, Comments, and Lifecycle Templates
// ============================================================================

export const CanvasSnapshotSchema = z.object({
    id: z.string().min(1),
    canvasId: z.string().min(1),
    projectId: z.string().min(1),
    name: z.string().min(1).max(120),
    description: z.string().max(300).optional(),
    createdAt: z.number(),
    createdBy: z.string().optional(),
    blockCount: z.number().int().min(0),
    edgeCount: z.number().int().min(0),
    blocks: z.array(ProjectCanvasBlockSchema),
    edges: z.array(ProjectCanvasEdgeSchema),
    viewport: CanvasViewportSchema,
});

export type CanvasSnapshot = z.infer<typeof CanvasSnapshotSchema>;

export const CanvasCommentSchema = z.object({
    id: z.string().min(1),
    canvasId: z.string().min(1),
    projectId: z.string().min(1),
    targetType: z.enum(['block', 'region']),
    targetId: z.string().min(1),
    authorId: z.string().min(1),
    authorName: z.string().min(1),
    authorAvatar: z.string().optional(),
    content: z.string().min(1).max(1000),
    createdAt: z.number(),
    resolved: z.boolean().default(false),
    resolvedAt: z.number().optional(),
    resolvedBy: z.string().optional(),
});

export type CanvasComment = z.infer<typeof CanvasCommentSchema>;

export type ProjectEntityType = 'artist' | 'release' | 'campaign' | 'song';

export interface ResolvedProjectEntityData {
    entityId: string;
    entityType: ProjectEntityType;
    title: string;
    subtitle?: string;
    description?: string;
    thumbnailUrl?: string;
    metadata: Record<string, unknown>;
    tags?: string[];
}

export type LifecycleStage =
    | 'create'
    | 'prepare'
    | 'register'
    | 'deliver'
    | 'release'
    | 'track'
    | 'operate'
    | 'repeat';

export interface LifecycleLaneConfig {
    stage: LifecycleStage;
    label: string;
    description: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

// ============================================================================
// Multiplayer Ephemeral Presence
// ============================================================================

export const CanvasPresenceCursorSchema = z.object({
    x: z.number(),
    y: z.number(),
});

export type CanvasPresenceCursor = z.infer<typeof CanvasPresenceCursorSchema>;

export const CanvasPresenceSchema = z.object({
    userId: z.string().min(1),
    userName: z.string().min(1),
    userColor: z.string().min(1),
    avatarUrl: z.string().optional(),
    cursor: CanvasPresenceCursorSchema.nullable(),
    selectedBlockIds: z.array(z.string()).default([]),
    lastSeen: z.number(),
});

export type CanvasPresenceState = z.infer<typeof CanvasPresenceSchema>;

// ============================================================================
// View Virtualization & Level of Detail (LOD)
// ============================================================================

export type CanvasLODLevel = 'full' | 'low';

export interface CanvasViewportBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface CanvasVirtualizationResult {
    visibleBlocks: ProjectCanvasBlock[];
    culledBlockCount: number;
    totalBlockCount: number;
    isVirtualizing: boolean;
    isLowLOD: boolean;
    lodLevel: CanvasLODLevel;
    visibleEdges: ProjectCanvasEdge[];
    viewportBounds: CanvasViewportBounds;
}

