import { describe, it, expect } from 'vitest';
import {
    ProjectCanvasDocumentSchema,
    ProjectCanvasBlockSchema,
    ProjectCanvasEdgeSchema,
    EntityReferenceSchema,
    migrateCanvasDocument,
    CURRENT_CANVAS_SCHEMA_VERSION,
    type ProjectCanvasBlock,
    type ProjectCanvasEdge,
} from '../types';

describe('Project Canvas Schema Validation', () => {
    describe('ProjectCanvasDocumentSchema', () => {
        it('validates a correct ProjectCanvasDocument', () => {
            const validDoc = {
                id: 'canvas_proj_1',
                schemaVersion: CURRENT_CANVAS_SCHEMA_VERSION,
                projectId: 'proj_1',
                ownerId: 'user_123',
                title: 'Summer EP Canvas',
                viewport: { x: 100, y: 50, zoom: 1 },
                createdAt: 1700000000000,
                updatedAt: 1700000001000,
                revision: 1,
                blockIds: ['block_1'],
                edgeIds: [],
            };

            const parsed = ProjectCanvasDocumentSchema.parse(validDoc);
            expect(parsed.id).toBe('canvas_proj_1');
            expect(parsed.schemaVersion).toBe(1);
            expect(parsed.viewport.zoom).toBe(1);
        });

        it('rejects documents with negative zoom or empty required fields', () => {
            expect(() =>
                ProjectCanvasDocumentSchema.parse({
                    id: '',
                    schemaVersion: 1,
                    projectId: 'proj_1',
                    ownerId: 'user_123',
                    title: 'Canvas',
                    viewport: { x: 0, y: 0, zoom: -1 },
                    createdAt: 1000,
                    updatedAt: 1000,
                })
            ).toThrow();
        });
    });

    describe('ProjectCanvasBlockSchema', () => {
        it('validates an asset reference block without base64 binary', () => {
            const block: ProjectCanvasBlock = {
                id: 'block_asset_1',
                type: 'asset',
                canvasId: 'canvas_1',
                projectId: 'proj_1',
                position: { x: 200, y: 150 },
                size: { width: 320, height: 240 },
                zIndex: 10,
                entityRef: {
                    kind: 'asset',
                    entityId: 'asset_456',
                    versionId: 'v_1',
                    sourceService: 'AssetVersionService',
                },
                snapshot: {
                    title: 'Album Cover Concept',
                    mediaType: 'image',
                    thumbnailUrl: 'https://storage.googleapis.com/test-bucket/thumb.jpg',
                    cachedAt: 1700000000000,
                },
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
            };

            const parsed = ProjectCanvasBlockSchema.parse(block);
            expect(parsed.type).toBe('asset');
            expect(parsed.entityRef?.kind).toBe('asset');
            expect(parsed.snapshot?.thumbnailUrl).not.toContain('data:image/');
        });

        it('enforces zIndex bounds between 0 and 1000', () => {
            const baseBlock = {
                id: 'block_1',
                type: 'text',
                canvasId: 'canvas_1',
                projectId: 'proj_1',
                position: { x: 0, y: 0 },
                size: { width: 100, height: 100 },
                createdAt: 1000,
                updatedAt: 1000,
            };

            expect(() => ProjectCanvasBlockSchema.parse({ ...baseBlock, zIndex: -1 })).toThrow();
            expect(() => ProjectCanvasBlockSchema.parse({ ...baseBlock, zIndex: 1001 })).toThrow();
            expect(ProjectCanvasBlockSchema.parse({ ...baseBlock, zIndex: 500 }).zIndex).toBe(500);
        });

        it('validates provenance metadata for agent-created blocks', () => {
            const agentBlock = {
                id: 'block_agent_1',
                type: 'agent_output',
                canvasId: 'canvas_1',
                projectId: 'proj_1',
                position: { x: 50, y: 50 },
                size: { width: 400, height: 300 },
                zIndex: 5,
                provenance: {
                    creatorType: 'agent',
                    creatorId: 'conductor',
                    agentName: 'Conductor',
                    operation: 'suggest_structure',
                    timestamp: 1700000000000,
                    correlationId: 'run_12345',
                },
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
            };

            const parsed = ProjectCanvasBlockSchema.parse(agentBlock);
            expect(parsed.provenance?.creatorType).toBe('agent');
            expect(parsed.provenance?.agentName).toBe('Conductor');
        });
    });

    describe('ProjectCanvasEdgeSchema', () => {
        it('accepts only non-executing semantic relationship types', () => {
            const validRelationships = ['association', 'lineage', 'context', 'sequence'] as const;

            for (const rel of validRelationships) {
                const edge: ProjectCanvasEdge = {
                    id: `edge_${rel}`,
                    canvasId: 'canvas_1',
                    projectId: 'proj_1',
                    sourceBlockId: 'block_a',
                    targetBlockId: 'block_b',
                    relationship: rel,
                    createdAt: 1700000000000,
                };
                expect(ProjectCanvasEdgeSchema.parse(edge).relationship).toBe(rel);
            }
        });

        it('rejects executable edge types like trigger or automated_flow', () => {
            expect(() =>
                ProjectCanvasEdgeSchema.parse({
                    id: 'edge_invalid',
                    canvasId: 'canvas_1',
                    projectId: 'proj_1',
                    sourceBlockId: 'block_a',
                    targetBlockId: 'block_b',
                    relationship: 'executable_trigger',
                    createdAt: 1000,
                })
            ).toThrow();
        });
    });

    describe('EntityReferenceSchema', () => {
        it('validates canonical entity references', () => {
            const noteRef = {
                kind: 'note',
                entityId: 'note_uuid_123',
                sourceService: 'NotesService',
            };
            expect(EntityReferenceSchema.parse(noteRef).kind).toBe('note');

            const workflowRef = {
                kind: 'workflow',
                entityId: 'workflow_uuid_456',
                sourceService: 'workflowPersistence',
            };
            expect(EntityReferenceSchema.parse(workflowRef).kind).toBe('workflow');
        });
    });

    describe('migrateCanvasDocument', () => {
        it('migrates raw object to v1 schema with defaults', () => {
            const raw = {
                id: 'canvas_test',
                projectId: 'p1',
                title: 'Test Board',
            };

            const migrated = migrateCanvasDocument(raw);
            expect(migrated.schemaVersion).toBe(1);
            expect(migrated.id).toBe('canvas_test');
            expect(migrated.projectId).toBe('p1');
            expect(migrated.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
            expect(migrated.blockIds).toEqual([]);
            expect(migrated.revision).toBe(0);
        });

        it('throws for unsupported schema versions', () => {
            expect(() => migrateCanvasDocument({ schemaVersion: 999 })).toThrow(
                /Unsupported canvas document schema version/
            );
        });
    });
});
