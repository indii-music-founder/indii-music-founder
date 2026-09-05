/**
 * InfiniteCanvasAdapter.ts
 *
 * Runtime compatibility adapter bridging between the legacy in-memory
 * InfiniteCanvas `CanvasImage` items and Project Canvas `ProjectCanvasBlock`.
 *
 * Requirements:
 * 1. Convert CanvasImage to referenced asset blocks.
 * 2. Retain parent/derived relationships as `lineage` edges.
 * 3. Never persist large base64 payloads inside ProjectCanvas records.
 * 4. Preserve entry points to existing creative tools (Creative Editor, variations, crop).
 */

import type { CanvasImage } from '@/core/store/slices/creative/creativeHistorySlice';
import type {
    ProjectCanvasBlock,
    ProjectCanvasEdge,
} from '../types';

export class InfiniteCanvasAdapter {
    /**
     * Convert an array of legacy in-memory CanvasImage objects into
     * ProjectCanvasBlocks and lineage ProjectCanvasEdges.
     */
    static convertLegacyImages(
        canvasImages: CanvasImage[],
        canvasId: string,
        projectId: string
    ): { blocks: ProjectCanvasBlock[]; edges: ProjectCanvasEdge[] } {
        const blocks: ProjectCanvasBlock[] = [];
        const edges: ProjectCanvasEdge[] = [];
        const now = Date.now();

        for (let i = 0; i < canvasImages.length; i++) {
            const img = canvasImages[i];
            const blockId = `block_legacy_${img.id}`;

            // Create asset reference block
            const block: ProjectCanvasBlock = {
                id: blockId,
                type: 'asset',
                canvasId,
                projectId,
                position: { x: img.x, y: img.y },
                size: {
                    width: Math.max(img.width || 250, 100),
                    height: Math.max(img.height || 250, 100),
                },
                zIndex: i + 1,
                entityRef: {
                    kind: 'asset',
                    entityId: img.id,
                    sourceService: 'creativeHistory',
                    projectId,
                },
                snapshot: {
                    title: img.prompt ? img.prompt.slice(0, 60) : `Canvas Image ${i + 1}`,
                    excerpt: img.prompt,
                    mediaType: 'image',
                    // Use clean URL or reference, never embed large base64 into durable snapshot
                    thumbnailUrl: img.base64?.startsWith('http') ? img.base64 : undefined,
                    cachedAt: now,
                },
                settings: {
                    aspect: img.aspect || 1,
                    originalX: img.originalX,
                    originalY: img.originalY,
                },
                provenance: {
                    creatorType: 'import',
                    creatorId: 'legacy_infinite_canvas',
                    operation: 'infinite_canvas_migration',
                    timestamp: now,
                },
                createdAt: now,
                updatedAt: now,
            };

            blocks.push(block);

            // If this image had a parentId, create a lineage edge
            if (img.parentId) {
                const parentBlockId = `block_legacy_${img.parentId}`;
                const edge: ProjectCanvasEdge = {
                    id: `edge_lineage_${img.parentId}_${img.id}`,
                    canvasId,
                    projectId,
                    sourceBlockId: parentBlockId,
                    targetBlockId: blockId,
                    relationship: 'lineage',
                    label: 'derived',
                    provenance: {
                        creatorType: 'workflow',
                        creatorId: 'creative_studio',
                        timestamp: now,
                    },
                    createdAt: now,
                };
                edges.push(edge);
            }
        }

        return { blocks, edges };
    }
}
