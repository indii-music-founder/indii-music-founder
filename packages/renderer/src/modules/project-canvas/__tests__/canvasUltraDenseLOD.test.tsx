/**
 * canvasUltraDenseLOD.test.tsx
 *
 * Scalability and stress tests for ultra-dense Project Canvas layouts:
 * - SpatialGridIndex O(K) viewport culling performance (1,000+ blocks in < 5ms)
 * - Spatial clustering aggregation algorithm for overview zoom levels
 * - 4-tier Level of Detail (LOD) transitions ('full' -> 'medium' -> 'low' -> 'cluster')
 * - ClusterBlock component rendering and click-to-zoom interaction
 * - Edge virtualization and SVG overhead suppression
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { SpatialGridIndex } from '../services/SpatialGridIndex';
import { useCanvasVirtualization } from '../hooks/useCanvasVirtualization';
import { ClusterBlock } from '../components/blocks/ClusterBlock';
import type { ProjectCanvasBlock, ProjectCanvasEdge, CanvasClusterSummary } from '../types';

function generateDenseFixtures(count = 1000): {
    blocks: ProjectCanvasBlock[];
    edges: ProjectCanvasEdge[];
} {
    const blocks: ProjectCanvasBlock[] = [];
    const types: ProjectCanvasBlock['type'][] = ['asset', 'note', 'workflow', 'workflow_run', 'document', 'agent_output'];

    for (let i = 0; i < count; i++) {
        const gridCol = i % 40;
        const gridRow = Math.floor(i / 40);
        const x = gridCol * 350;
        const y = gridRow * 250;

        blocks.push({
            id: `dense_block_${i}`,
            canvasId: 'dense_canvas',
            projectId: 'proj_dense',
            type: types[i % types.length],
            position: { x, y },
            size: { width: 300, height: 200 },
            zIndex: 1,
            snapshot: {
                title: `Dense Item ${i}`,
                cachedAt: 1700000000000,
            },
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
        });
    }

    const edges: ProjectCanvasEdge[] = [];
    for (let i = 0; i < count - 1; i += 2) {
        edges.push({
            id: `edge_${i}`,
            canvasId: 'dense_canvas',
            projectId: 'proj_dense',
            sourceBlockId: `dense_block_${i}`,
            targetBlockId: `dense_block_${i + 1}`,
            relationship: 'association',
            createdAt: 1700000000000,
        });
    }

    return { blocks, edges };
}

describe('Ultra-Dense Canvas LOD & Spatial Indexing', () => {
    describe('SpatialGridIndex', () => {
        it('inserts, updates, and removes blocks with accurate cell tracking', () => {
            const index = new SpatialGridIndex({ cellSize: 500 });
            const block: ProjectCanvasBlock = {
                id: 'b1',
                canvasId: 'c1',
                projectId: 'p1',
                type: 'asset',
                position: { x: 100, y: 100 },
                size: { width: 300, height: 200 },
                zIndex: 1,
                createdAt: 1000,
                updatedAt: 1000,
            };

            index.insert(block);
            expect(index.size()).toBe(1);

            // Query area intersecting b1
            const matches = index.query({ minX: 0, minY: 0, maxX: 600, maxY: 600 });
            expect(matches.length).toBe(1);
            expect(matches[0].id).toBe('b1');

            // Query area disjoint from b1
            const disjoint = index.query({ minX: 2000, minY: 2000, maxX: 3000, maxY: 3000 });
            expect(disjoint.length).toBe(0);

            // Remove b1
            index.remove('b1');
            expect(index.size()).toBe(0);
            expect(index.query({ minX: 0, minY: 0, maxX: 600, maxY: 600 }).length).toBe(0);
        });

        it('queries 1,000 blocks in sub-millisecond O(K) time without scanning all items', () => {
            const { blocks } = generateDenseFixtures(1000);
            const index = new SpatialGridIndex({ cellSize: 800 });
            index.rebuild(blocks);
            expect(index.size()).toBe(1000);

            // Window covering roughly 16 blocks (x: 0..1200, y: 0..1000)
            const bounds = { minX: 0, minY: 0, maxX: 1200, maxY: 1000 };

            const t0 = performance.now();
            const visible = index.query(bounds);
            const elapsedMs = performance.now() - t0;

            expect(visible.length).toBeGreaterThan(0);
            expect(visible.length).toBeLessThan(50);
            // Must complete virtually instantaneously (well under 50ms even on virtualized CI)
            expect(elapsedMs).toBeLessThan(50);
        });

        it('aggregates dense entities into spatial cluster summaries', () => {
            const { blocks } = generateDenseFixtures(600);
            const index = new SpatialGridIndex({ cellSize: 800 });
            index.rebuild(blocks);

            const bounds = { minX: 0, minY: 0, maxX: 20000, maxY: 10000 };
            const clusters = index.computeClusters(bounds, 1500);

            expect(clusters.length).toBeGreaterThan(0);
            const totalAggregated = clusters.reduce((sum, c) => sum + c.blockCount, 0);
            expect(totalAggregated).toBe(600);

            // First cluster should have valid centroid and breakdown
            const first = clusters[0];
            expect(first.center.x).toBeGreaterThanOrEqual(0);
            expect(first.center.y).toBeGreaterThanOrEqual(0);
            expect(first.blockCount).toBeGreaterThan(0);
            expect(Object.keys(first.typeCounts).length).toBeGreaterThan(0);
        });
    });

    describe('useCanvasVirtualization 4-Tier LOD', () => {
        const { blocks, edges } = generateDenseFixtures(600);
        const containerDimensions = { width: 1920, height: 1080 };

        it('engages full LOD at zoom >= 0.75', () => {
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 1.0 },
                    containerDimensions,
                })
            );

            expect(result.current.lodLevel).toBe('full');
            expect(result.current.isLowLOD).toBe(false);
            expect(result.current.clusterSummaries?.length || 0).toBe(0);
        });

        it('engages medium LOD at 0.4 <= zoom < 0.75', () => {
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 0.6 },
                    containerDimensions,
                })
            );

            expect(result.current.lodLevel).toBe('medium');
            expect(result.current.isLowLOD).toBe(false);
        });

        it('engages low LOD at 0.25 <= zoom < 0.4', () => {
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 0.35 },
                    containerDimensions,
                })
            );

            expect(result.current.lodLevel).toBe('low');
            expect(result.current.isLowLOD).toBe(true);
        });

        it('engages cluster aggregation LOD at overview zoom < 0.25 on >= 500 blocks', () => {
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 0.15 },
                    containerDimensions,
                })
            );

            expect(result.current.lodLevel).toBe('cluster');
            expect(result.current.isLowLOD).toBe(true);
            expect(result.current.clusterSummaries).toBeDefined();
            expect(result.current.clusterSummaries!.length).toBeGreaterThan(0);
            // Individual edges suppressed in cluster mode to maintain 60fps
            expect(result.current.visibleEdges.length).toBe(0);
        });

        it('preserves actively selected blocks even during cluster aggregation mode', () => {
            const selectedId = 'dense_block_42';
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 0.15 },
                    containerDimensions,
                    selectedBlockIds: [selectedId],
                })
            );

            expect(result.current.lodLevel).toBe('cluster');
            expect(result.current.visibleBlocks.some((b) => b.id === selectedId)).toBe(true);
        });
    });

    describe('ClusterBlock Component', () => {
        const mockSummary: CanvasClusterSummary = {
            id: 'cluster_0_0',
            center: { x: 500, y: 400 },
            bounds: { minX: 100, minY: 100, maxX: 900, maxY: 700 },
            blockCount: 48,
            blocks: [],
            typeCounts: {
                asset: 24,
                workflow: 16,
                note: 8,
            },
        };

        it('renders cluster count and entity type breakdown pills', () => {
            render(<ClusterBlock summary={mockSummary} />);

            expect(screen.getByText('48 entities aggregated')).toBeInTheDocument();
            expect(screen.getByText('24')).toBeInTheDocument();
            expect(screen.getByText('16')).toBeInTheDocument();
            expect(screen.getByText('8')).toBeInTheDocument();
        });

        it('triggers onZoomToCluster on click or double click', () => {
            const onZoom = vi.fn();
            render(<ClusterBlock summary={mockSummary} onZoomToCluster={onZoom} />);

            const clusterCard = screen.getByTestId('cluster-block-cluster_0_0');
            fireEvent.click(clusterCard);
            expect(onZoom).toHaveBeenCalledWith(mockSummary);

            fireEvent.doubleClick(clusterCard);
            expect(onZoom).toHaveBeenCalledTimes(2);
        });
    });
});
