/**
 * SpatialGridIndex.ts
 *
 * High-performance 2D Spatial Hash Grid index for Project Canvas.
 * Provides sub-millisecond O(K) bounding box viewport culling and spatial
 * cluster aggregation on dense canvas layouts (>500 to 5,000+ blocks).
 *
 * Guarantees:
 * - Constant-time O(1) block placement insertions, removals, and updates.
 * - O(K) spatial viewport queries where K is the number of items in intersecting
 *   grid buckets (avoiding O(N) linear array scans on every 60fps pan/zoom frame).
 * - Spatial cluster grouping for overview zoom levels (< 0.25) to collapse
 *   dense regions into lightweight cluster summary structures.
 */

import type {
    ProjectCanvasBlock,
    CanvasViewportBounds,
    CanvasClusterSummary,
} from '../types';

export interface SpatialGridIndexOptions {
    cellSize?: number;
}

export class SpatialGridIndex {
    private cellSize: number;
    private grid: Map<string, Set<string>> = new Map();
    private blockMap: Map<string, ProjectCanvasBlock> = new Map();
    private blockCells: Map<string, Set<string>> = new Map();

    constructor(options: SpatialGridIndexOptions = {}) {
        this.cellSize = options.cellSize && options.cellSize > 0 ? options.cellSize : 800;
    }

    private getCellKey(col: number, row: number): string {
        return `${col}:${row}`;
    }

    private getCellCoords(val: number): number {
        return Math.floor(val / this.cellSize);
    }

    private getCoveredCells(
        x: number,
        y: number,
        width: number,
        height: number
    ): string[] {
        const startCol = this.getCellCoords(x);
        const endCol = this.getCellCoords(x + Math.max(1, width));
        const startRow = this.getCellCoords(y);
        const endRow = this.getCellCoords(y + Math.max(1, height));

        const keys: string[] = [];
        for (let col = startCol; col <= endCol; col++) {
            for (let row = startRow; row <= endRow; row++) {
                keys.push(this.getCellKey(col, row));
            }
        }
        return keys;
    }

    /**
     * Insert or update a block in the spatial index.
     */
    public insert(block: ProjectCanvasBlock): void {
        this.remove(block.id);

        this.blockMap.set(block.id, block);
        const keys = this.getCoveredCells(
            block.position.x,
            block.position.y,
            block.size.width,
            block.size.height
        );

        const assignedCells = new Set<string>();
        for (const key of keys) {
            let cellSet = this.grid.get(key);
            if (!cellSet) {
                cellSet = new Set<string>();
                this.grid.set(key, cellSet);
            }
            cellSet.add(block.id);
            assignedCells.add(key);
        }
        this.blockCells.set(block.id, assignedCells);
    }

    /**
     * Remove a block from the spatial index.
     */
    public remove(blockId: string): void {
        this.blockMap.delete(blockId);
        const cells = this.blockCells.get(blockId);
        if (cells) {
            for (const key of cells) {
                const cellSet = this.grid.get(key);
                if (cellSet) {
                    cellSet.delete(blockId);
                    if (cellSet.size === 0) {
                        this.grid.delete(key);
                    }
                }
            }
            this.blockCells.delete(blockId);
        }
    }

    /**
     * Batch rebuild the entire index from a list of blocks.
     */
    public rebuild(blocks: ProjectCanvasBlock[]): void {
        this.clear();
        for (const block of blocks) {
            this.insert(block);
        }
    }

    /**
     * Clear the spatial index.
     */
    public clear(): void {
        this.grid.clear();
        this.blockMap.clear();
        this.blockCells.clear();
    }

    /**
     * Query blocks intersecting the given viewport bounding box in O(K) time.
     */
    public query(bounds: CanvasViewportBounds): ProjectCanvasBlock[] {
        const startCol = this.getCellCoords(bounds.minX);
        const endCol = this.getCellCoords(bounds.maxX);
        const startRow = this.getCellCoords(bounds.minY);
        const endRow = this.getCellCoords(bounds.maxY);

        const candidateIds = new Set<string>();

        for (let col = startCol; col <= endCol; col++) {
            for (let row = startRow; row <= endRow; row++) {
                const cellSet = this.grid.get(this.getCellKey(col, row));
                if (cellSet) {
                    for (const id of cellSet) {
                        candidateIds.add(id);
                    }
                }
            }
        }

        const visibleBlocks: ProjectCanvasBlock[] = [];
        for (const id of candidateIds) {
            const block = this.blockMap.get(id);
            if (!block) continue;

            const blockRight = block.position.x + block.size.width;
            const blockBottom = block.position.y + block.size.height;

            // Exact bounding-box intersection
            if (
                blockRight >= bounds.minX &&
                block.position.x <= bounds.maxX &&
                blockBottom >= bounds.minY &&
                block.position.y <= bounds.maxY
            ) {
                visibleBlocks.push(block);
            }
        }

        return visibleBlocks;
    }

    /**
     * Aggregate dense blocks into spatial cluster summaries.
     * Used when zoomed out to overview zoom (< 0.25) or when total entities exceed 500.
     */
    public computeClusters(
        bounds: CanvasViewportBounds,
        clusterCellSize = 1200
    ): CanvasClusterSummary[] {
        const visibleBlocks = this.query(bounds);
        if (visibleBlocks.length === 0) return [];

        const clustersBySector = new Map<string, ProjectCanvasBlock[]>();

        for (const block of visibleBlocks) {
            const sectorCol = Math.floor(block.position.x / clusterCellSize);
            const sectorRow = Math.floor(block.position.y / clusterCellSize);
            const sectorKey = `${sectorCol}:${sectorRow}`;

            let list = clustersBySector.get(sectorKey);
            if (!list) {
                list = [];
                clustersBySector.set(sectorKey, list);
            }
            list.push(block);
        }

        const summaries: CanvasClusterSummary[] = [];

        for (const [sectorKey, sectorBlocks] of clustersBySector.entries()) {
            if (sectorBlocks.length === 0) continue;

            let totalX = 0;
            let totalY = 0;
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            const typeCounts: Record<string, number> = {};

            for (const b of sectorBlocks) {
                const cx = b.position.x + b.size.width / 2;
                const cy = b.position.y + b.size.height / 2;
                totalX += cx;
                totalY += cy;

                minX = Math.min(minX, b.position.x);
                minY = Math.min(minY, b.position.y);
                maxX = Math.max(maxX, b.position.x + b.size.width);
                maxY = Math.max(maxY, b.position.y + b.size.height);

                typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
            }

            summaries.push({
                id: `cluster_${sectorKey}`,
                center: {
                    x: Math.round(totalX / sectorBlocks.length),
                    y: Math.round(totalY / sectorBlocks.length),
                },
                bounds: { minX, minY, maxX, maxY },
                blockCount: sectorBlocks.length,
                blocks: sectorBlocks,
                typeCounts,
            });
        }

        return summaries;
    }

    /**
     * Returns the total count of indexed blocks.
     */
    public size(): number {
        return this.blockMap.size;
    }
}
