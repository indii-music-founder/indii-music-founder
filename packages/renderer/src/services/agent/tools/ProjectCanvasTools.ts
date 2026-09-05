/**
 * ProjectCanvasTools.ts
 *
 * Conductor and Specialist Agent tools for interacting with the Project Canvas.
 *
 * Architectural Guarantees:
 * 1. Conductor actions include full provenance (agent ID, timestamp, operation).
 * 2. Canvas relationships are strictly semantic and non-executing.
 * 3. Never deletes canonical records without explicit user confirmation.
 * 4. Never stores base64 media payloads in canvas documents.
 */

import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';
import type { CanvasRelationshipType } from '@/modules/project-canvas/types';

export const ProjectCanvasTools = {
    /**
     * Pin an existing note to the current Project Canvas.
     */
    canvas_pin_note: wrapTool('canvas_pin_note', async (args: { noteId: string; title?: string }) => {
        try {
            const store = useStore.getState();
            const currentProjectId = store.currentProjectId;
            if (!currentProjectId) {
                return toolError('No active project context found.', 'CANVAS_NO_PROJECT');
            }

            const note = store.notes.find((n) => n.id === args.noteId);
            if (!note) {
                return toolError(`Note "${args.noteId}" not found in notes library.`, 'NOTE_NOT_FOUND');
            }

            const blockId = store.addCanvasBlock({
                type: 'note',
                position: { x: 300, y: 250 },
                size: { width: 280, height: 200 },
                zIndex: 1,
                entityRef: {
                    kind: 'note',
                    entityId: note.id,
                    projectId: currentProjectId,
                },
                snapshot: {
                    title: note.title,
                    excerpt: note.content ? note.content.slice(0, 160) : '',
                    cachedAt: Date.now(),
                },
                provenance: {
                    creatorType: 'agent',
                    creatorId: 'conductor',
                    agentName: 'Conductor',
                    operation: 'canvas_pin_note',
                    timestamp: Date.now(),
                },
            });

            logger.info(`[ProjectCanvasTools] Pinned note "${note.title}" to canvas`);
            return toolSuccess(
                { blockId, noteId: note.id },
                `Note "${note.title}" pinned to Project Canvas successfully.`
            );
        } catch (error) {
            logger.error('[ProjectCanvasTools] canvas_pin_note error:', error);
            return toolError(`Failed to pin note: ${String(error)}`, 'CANVAS_PIN_NOTE_ERROR');
        }
    }),

    /**
     * Create a new canonical note and place it directly onto the Project Canvas.
     */
    canvas_create_note: wrapTool('canvas_create_note', async (args: { title: string; content: string; tags?: string[] }) => {
        try {
            const store = useStore.getState();
            const currentProjectId = store.currentProjectId;
            if (!currentProjectId) {
                return toolError('No active project context found.', 'CANVAS_NO_PROJECT');
            }

            // 1. Create canonical note
            const noteId = store.addNote({
                title: args.title,
                content: args.content,
                attachments: [],
                tags: args.tags || [],
            });

            // 2. Place on canvas
            const blockId = store.addCanvasBlock({
                type: 'note',
                position: { x: 320, y: 260 },
                size: { width: 280, height: 200 },
                zIndex: 1,
                entityRef: {
                    kind: 'note',
                    entityId: noteId,
                    projectId: currentProjectId,
                },
                snapshot: {
                    title: args.title,
                    excerpt: args.content.slice(0, 160),
                    cachedAt: Date.now(),
                },
                provenance: {
                    creatorType: 'agent',
                    creatorId: 'conductor',
                    agentName: 'Conductor',
                    operation: 'canvas_create_note',
                    timestamp: Date.now(),
                },
            });

            return toolSuccess(
                { blockId, noteId },
                `Created canonical note "${args.title}" and placed it on Project Canvas.`
            );
        } catch (error) {
            logger.error('[ProjectCanvasTools] canvas_create_note error:', error);
            return toolError(`Failed to create note: ${String(error)}`, 'CANVAS_CREATE_NOTE_ERROR');
        }
    }),

    /**
     * Place an existing project asset onto the Project Canvas.
     */
    canvas_place_asset: wrapTool('canvas_place_asset', async (args: {
        assetId: string;
        url: string;
        title?: string;
        mediaType?: 'image' | 'audio' | 'video' | 'document';
    }) => {
        try {
            const store = useStore.getState();
            const currentProjectId = store.currentProjectId;
            if (!currentProjectId) {
                return toolError('No active project context found.', 'CANVAS_NO_PROJECT');
            }

            const blockId = store.addCanvasBlock({
                type: 'asset',
                position: { x: 340, y: 240 },
                size: { width: 300, height: 320 },
                zIndex: 1,
                entityRef: {
                    kind: 'asset',
                    entityId: args.assetId,
                    projectId: currentProjectId,
                },
                snapshot: {
                    title: args.title || 'Asset',
                    thumbnailUrl: args.url,
                    mediaType: args.mediaType || 'image',
                    cachedAt: Date.now(),
                },
                provenance: {
                    creatorType: 'agent',
                    creatorId: 'conductor',
                    agentName: 'Conductor',
                    operation: 'canvas_place_asset',
                    timestamp: Date.now(),
                },
            });

            return toolSuccess(
                { blockId, assetId: args.assetId },
                `Placed asset "${args.title || args.assetId}" on Project Canvas.`
            );
        } catch (error) {
            logger.error('[ProjectCanvasTools] canvas_place_asset error:', error);
            return toolError(`Failed to place asset: ${String(error)}`, 'CANVAS_PLACE_ASSET_ERROR');
        }
    }),

    /**
     * Create an organizational frame around blocks or on the canvas.
     */
    canvas_create_frame: wrapTool('canvas_create_frame', async (args: { title: string; width?: number; height?: number }) => {
        try {
            const store = useStore.getState();
            const currentProjectId = store.currentProjectId;
            if (!currentProjectId) {
                return toolError('No active project context found.', 'CANVAS_NO_PROJECT');
            }

            const blockId = store.addCanvasBlock({
                type: 'frame',
                position: { x: 200, y: 150 },
                size: { width: args.width || 600, height: args.height || 450 },
                zIndex: 0,
                snapshot: {
                    title: args.title,
                    cachedAt: Date.now(),
                },
                provenance: {
                    creatorType: 'agent',
                    creatorId: 'conductor',
                    agentName: 'Conductor',
                    operation: 'canvas_create_frame',
                    timestamp: Date.now(),
                },
            });

            return toolSuccess({ blockId, title: args.title }, `Created frame "${args.title}" on Project Canvas.`);
        } catch (error) {
            logger.error('[ProjectCanvasTools] canvas_create_frame error:', error);
            return toolError(`Failed to create frame: ${String(error)}`, 'CANVAS_CREATE_FRAME_ERROR');
        }
    }),

    /**
     * Connect two canvas blocks with a non-executing semantic relationship.
     */
    canvas_suggest_relationship: wrapTool('canvas_suggest_relationship', async (args: {
        sourceBlockId: string;
        targetBlockId: string;
        relationship: CanvasRelationshipType;
        reason: string;
    }) => {
        try {
            const store = useStore.getState();
            const edgeId = store.addCanvasEdge(
                args.sourceBlockId,
                args.targetBlockId,
                args.relationship,
                args.reason
            );

            return toolSuccess(
                { edgeId, relationship: args.relationship },
                `Connected blocks with "${args.relationship}" relationship: ${args.reason}`
            );
        } catch (error) {
            logger.error('[ProjectCanvasTools] canvas_suggest_relationship error:', error);
            return toolError(`Failed to create relationship: ${String(error)}`, 'CANVAS_RELATIONSHIP_ERROR');
        }
    }),

    /**
     * Post a persistent recommendation card with provenance.
     */
    canvas_post_recommendation: wrapTool('canvas_post_recommendation', async (args: {
        title: string;
        recommendation: string;
        agentName?: string;
    }) => {
        try {
            const store = useStore.getState();
            const currentProjectId = store.currentProjectId;
            if (!currentProjectId) {
                return toolError('No active project context found.', 'CANVAS_NO_PROJECT');
            }

            const now = Date.now();
            const blockId = store.addCanvasBlock({
                type: 'agent_output',
                position: { x: 380, y: 220 },
                size: { width: 340, height: 240 },
                zIndex: 2,
                snapshot: {
                    title: args.title,
                    excerpt: args.recommendation.slice(0, 160),
                    cachedAt: now,
                },
                settings: {
                    presentation: 'markdown',
                    title: args.title,
                    agentData: { content: args.recommendation },
                },
                provenance: {
                    creatorType: 'agent',
                    creatorId: args.agentName || 'conductor',
                    agentName: args.agentName || 'Conductor',
                    operation: 'recommendation',
                    timestamp: now,
                },
            });

            return toolSuccess(
                { blockId, title: args.title },
                `Posted recommendation "${args.title}" to Project Canvas.`
            );
        } catch (error) {
            logger.error('[ProjectCanvasTools] canvas_post_recommendation error:', error);
            return toolError(`Failed to post recommendation: ${String(error)}`, 'CANVAS_POST_RECOMMENDATION_ERROR');
        }
    }),
};
