/**
 * useCanvasVirtualization.ts
 *
 * Viewport bounding-box culling and Level of Detail (LOD) downsampling hook
 * for ultra-dense Project Canvas scenes (>500 blocks and dense edge networks).
 *
 * Guarantees:
 * 1. Blocks outside active viewport + margin are culled from DOM rendering.
 * 2. Low-zoom levels (< 0.4) trigger lightweight LOD representations.
 * 3. Interaction preservation: Selected and actively dragged/resized blocks
 *    are never culled, regardless of viewport coordinates.
 * 4. Edge culling: Edges whose source and target are both outside the culled
 *    viewport are omitted from SVG overlay rendering.
 */

import { useMemo } from 'react';
import type {
    ProjectCanvasBlock,
    ProjectCanvasEdge,
    CanvasViewport,
    CanvasViewportBounds,
    CanvasVirtualizationResult,
    CanvasLODLevel,
} from '../types';

export interface UseCanvasVirtualizationOptions {
    blocks: ProjectCanvasBlock[];
    edges: ProjectCanvasEdge[];
    viewport: CanvasViewport;
    containerDimensions: { width: number; height: number };
    selectedBlockIds?: string[];
    activeBlockId?: string | null;
    /** Extra margin in canvas pixels around viewport to avoid pop-in (default: 400) */
    cullingMargin?: number;
    /** Count threshold where viewport culling is automatically engaged (default: 500) */
    virtualizationThreshold?: number;
    /** Explicit override to force enable or disable virtualization */
    enabled?: boolean;
}

export function computeCanvasViewportBounds(
    viewport: CanvasViewport,
    containerDimensions: { width: number; height: number },
    margin = 400
): CanvasViewportBounds {
    const zoom = Math.max(viewport.zoom, 0.05);
    const width =
        containerDimensions.width > 0
            ? containerDimensions.width
            : typeof window !== 'undefined'
            ? window.innerWidth || 1920
            : 1920;
    const height =
        containerDimensions.height > 0
            ? containerDimensions.height
            : typeof window !== 'undefined'
            ? window.innerHeight || 1080
            : 1080;

    const minX = -viewport.x / zoom - margin;
    const minY = -viewport.y / zoom - margin;
    const maxX = (width - viewport.x) / zoom + margin;
    const maxY = (height - viewport.y) / zoom + margin;

    return {
        minX: minX === 0 ? 0 : minX,
        minY: minY === 0 ? 0 : minY,
        maxX: maxX === 0 ? 0 : maxX,
        maxY: maxY === 0 ? 0 : maxY,
    };
}

export function isBlockInViewport(
    block: ProjectCanvasBlock,
    bounds: CanvasViewportBounds
): boolean {
    const blockLeft = block.position.x;
    const blockTop = block.position.y;
    const blockRight = block.position.x + block.size.width;
    const blockBottom = block.position.y + block.size.height;

    return (
        blockRight >= bounds.minX &&
        blockLeft <= bounds.maxX &&
        blockBottom >= bounds.minY &&
        blockTop <= bounds.maxY
    );
}

export function useCanvasVirtualization({
    blocks,
    edges,
    viewport,
    containerDimensions,
    selectedBlockIds = [],
    activeBlockId = null,
    cullingMargin = 400,
    virtualizationThreshold = 500,
    enabled,
}: UseCanvasVirtualizationOptions): CanvasVirtualizationResult {
    // LOD calculation: low-zoom (< 0.4) uses lightweight representations
    const isLowLOD = viewport.zoom < 0.4;
    const lodLevel: CanvasLODLevel = isLowLOD ? 'low' : 'full';

    // Virtualization is active if explicitly enabled or if scene exceeds threshold (> 500 blocks)
    const isVirtualizing =
        typeof enabled === 'boolean' ? enabled : blocks.length >= virtualizationThreshold;

    const viewportBounds = useMemo(
        () => computeCanvasViewportBounds(viewport, containerDimensions, cullingMargin),
        [viewport, containerDimensions, cullingMargin]
    );

    const visibleBlocks = useMemo(() => {
        if (!isVirtualizing) {
            return blocks;
        }

        const selectedSet = new Set(selectedBlockIds);

        return blocks.filter((block) => {
            // Selected or active interacting blocks must NEVER be culled
            if (selectedSet.has(block.id) || (activeBlockId && activeBlockId === block.id)) {
                return true;
            }

            return isBlockInViewport(block, viewportBounds);
        });
    }, [blocks, isVirtualizing, selectedBlockIds, activeBlockId, viewportBounds]);

    const visibleEdges = useMemo(() => {
        if (!isVirtualizing) {
            return edges;
        }

        const visibleBlockIdSet = new Set(visibleBlocks.map((b) => b.id));

        return edges.filter((edge) => {
            // Retain edge if at least one endpoint is visible
            return visibleBlockIdSet.has(edge.sourceBlockId) || visibleBlockIdSet.has(edge.targetBlockId);
        });
    }, [edges, isVirtualizing, visibleBlocks]);

    const culledBlockCount = Math.max(0, blocks.length - visibleBlocks.length);

    return {
        visibleBlocks,
        culledBlockCount,
        totalBlockCount: blocks.length,
        isVirtualizing,
        isLowLOD,
        lodLevel,
        visibleEdges,
        viewportBounds,
    };
}
