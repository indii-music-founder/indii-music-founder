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
import { SpatialGridIndex } from '../services/SpatialGridIndex';

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
    // Spatial hash grid index rebuilt only when blocks change
    const spatialIndex = useMemo(() => {
        const index = new SpatialGridIndex({ cellSize: 800 });
        index.rebuild(blocks);
        return index;
    }, [blocks]);

    // Virtualization is active if explicitly enabled or if scene exceeds threshold (>= 500 blocks)
    const isVirtualizing =
        typeof enabled === 'boolean' ? enabled : blocks.length >= virtualizationThreshold;

    const viewportBounds = useMemo(
        () => computeCanvasViewportBounds(viewport, containerDimensions, cullingMargin),
        [viewport, containerDimensions, cullingMargin]
    );

    // 4-Tier Level of Detail (LOD) computation:
    // 1. 'cluster': Overview zoom (< 0.25) on scenes >= 500 blocks collapses dense sectors into summary tiles
    // 2. 'low': Zoom < 0.4 uses lightweight bounding boxes (LODBlock)
    // 3. 'medium': 0.4 <= Zoom < 0.75 suppresses heavy media/waveform elements
    // 4. 'full': Zoom >= 0.75 renders full interactive blocks
    const lodLevel: CanvasLODLevel = useMemo(() => {
        if (viewport.zoom < 0.25 && (blocks.length >= virtualizationThreshold || isVirtualizing)) {
            return 'cluster';
        }
        if (viewport.zoom < 0.4) {
            return 'low';
        }
        if (viewport.zoom < 0.75) {
            return 'medium';
        }
        return 'full';
    }, [viewport.zoom, blocks.length, virtualizationThreshold, isVirtualizing]);

    const isLowLOD = lodLevel === 'low' || lodLevel === 'cluster';

    // Spatial clustering for overview mode
    const clusterSummaries = useMemo(() => {
        if (lodLevel !== 'cluster') {
            return [];
        }
        return spatialIndex.computeClusters(viewportBounds, 1200);
    }, [lodLevel, spatialIndex, viewportBounds]);

    // Visible blocks via sub-millisecond SpatialGridIndex query
    const visibleBlocks = useMemo(() => {
        if (lodLevel === 'cluster') {
            // When clustered, only actively selected or dragged blocks are rendered as individual elements
            const selectedSet = new Set(selectedBlockIds);
            return blocks.filter((b) => selectedSet.has(b.id) || (activeBlockId && activeBlockId === b.id));
        }

        if (!isVirtualizing) {
            return blocks;
        }

        const selectedSet = new Set(selectedBlockIds);
        const spatialMatches = spatialIndex.query(viewportBounds);
        const matchIdSet = new Set(spatialMatches.map((b) => b.id));

        const result: ProjectCanvasBlock[] = [...spatialMatches];

        // Ensure selected or actively dragged blocks are NEVER culled regardless of coordinates
        for (const block of blocks) {
            if (
                (selectedSet.has(block.id) || (activeBlockId && activeBlockId === block.id)) &&
                !matchIdSet.has(block.id)
            ) {
                result.push(block);
            }
        }

        return result;
    }, [blocks, isVirtualizing, lodLevel, spatialIndex, viewportBounds, selectedBlockIds, activeBlockId]);

    // Visible edges culling
    const visibleEdges = useMemo(() => {
        if (!isVirtualizing && lodLevel !== 'cluster') {
            return edges;
        }

        if (lodLevel === 'cluster') {
            // In cluster mode, suppress individual edges to maintain 60fps
            return [];
        }

        const visibleBlockIdSet = new Set(visibleBlocks.map((b) => b.id));

        return edges.filter((edge) => {
            // Retain edge if at least one endpoint is visible
            return visibleBlockIdSet.has(edge.sourceBlockId) || visibleBlockIdSet.has(edge.targetBlockId);
        });
    }, [edges, isVirtualizing, lodLevel, visibleBlocks]);

    const culledBlockCount = Math.max(0, blocks.length - visibleBlocks.length);

    return {
        visibleBlocks,
        clusterSummaries,
        culledBlockCount,
        totalBlockCount: blocks.length,
        isVirtualizing,
        isLowLOD,
        lodLevel,
        visibleEdges,
        viewportBounds,
    };
}
