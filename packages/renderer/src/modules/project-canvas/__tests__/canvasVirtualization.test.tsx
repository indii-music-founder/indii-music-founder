/**
 * canvasVirtualization.test.tsx
 *
 * Comprehensive tests for Project Canvas active viewport bounding-box culling
 * and Level of Detail (LOD) downsampling.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import {
    computeCanvasViewportBounds,
    isBlockInViewport,
    useCanvasVirtualization,
} from '../hooks/useCanvasVirtualization';
import { LODBlock } from '../components/blocks/LODBlock';
import { CanvasEdgeLayer } from '../components/edges/CanvasEdgeLayer';
import type { ProjectCanvasBlock, ProjectCanvasEdge } from '../types';

function createMockBlock(
    id: string,
    x: number,
    y: number,
    width = 300,
    height = 200,
    type: ProjectCanvasBlock['type'] = 'asset'
): ProjectCanvasBlock {
    return {
        id,
        canvasId: 'test_canvas',
        projectId: 'test_proj',
        type,
        position: { x, y },
        size: { width, height },
        zIndex: 1,
        snapshot: {
            title: `Block ${id}`,
            excerpt: `Excerpt for ${id}`,
            cachedAt: 1700000000000,
        },
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
    };
}

describe('Canvas Virtualization & Bounding-Box Culling', () => {
    describe('computeCanvasViewportBounds', () => {
        it('calculates spatial canvas bounds accounting for zoom and offset', () => {
            const viewport = { x: 100, y: 50, zoom: 1.0 };
            const containerDimensions = { width: 1000, height: 800 };
            const margin = 200;

            const bounds = computeCanvasViewportBounds(viewport, containerDimensions, margin);

            // minX: -100/1 - 200 = -300
            expect(bounds.minX).toBe(-300);
            // minY: -50/1 - 200 = -250
            expect(bounds.minY).toBe(-250);
            // maxX: (1000 - 100)/1 + 200 = 1100
            expect(bounds.maxX).toBe(1100);
            // maxY: (800 - 50)/1 + 200 = 950
            expect(bounds.maxY).toBe(950);
        });

        it('expands canvas spatial area at lower zoom levels', () => {
            const viewport = { x: 0, y: 0, zoom: 0.5 };
            const containerDimensions = { width: 1000, height: 800 };
            const margin = 0;

            const bounds = computeCanvasViewportBounds(viewport, containerDimensions, margin);

            expect(bounds.minX).toBe(0);
            expect(bounds.minY).toBe(0);
            expect(bounds.maxX).toBe(2000); // 1000 / 0.5
            expect(bounds.maxY).toBe(1600); // 800 / 0.5
        });
    });

    describe('isBlockInViewport', () => {
        const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

        it('returns true when block is fully within bounds', () => {
            const block = createMockBlock('b1', 100, 100, 300, 200);
            expect(isBlockInViewport(block, bounds)).toBe(true);
        });

        it('returns true when block intersects bounds boundary', () => {
            // Straddling the right edge (x=900, width=300 -> right=1200)
            const block = createMockBlock('b2', 900, 100, 300, 200);
            expect(isBlockInViewport(block, bounds)).toBe(true);
        });

        it('returns false when block is completely to the right of bounds', () => {
            const block = createMockBlock('b3', 1050, 100, 300, 200);
            expect(isBlockInViewport(block, bounds)).toBe(false);
        });

        it('returns false when block is completely to the left of bounds', () => {
            const block = createMockBlock('b4', -500, 100, 300, 200);
            expect(isBlockInViewport(block, bounds)).toBe(false);
        });

        it('returns false when block is completely above or below bounds', () => {
            const blockAbove = createMockBlock('b5', 100, -400, 300, 200);
            const blockBelow = createMockBlock('b6', 100, 1200, 300, 200);
            expect(isBlockInViewport(blockAbove, bounds)).toBe(false);
            expect(isBlockInViewport(blockBelow, bounds)).toBe(false);
        });
    });

    describe('useCanvasVirtualization Hook', () => {
        const createDenseScene = (count: number) => {
            const blocks: ProjectCanvasBlock[] = [];
            const edges: ProjectCanvasEdge[] = [];

            for (let i = 0; i < count; i++) {
                // Spread across a 10,000 x 10,000 canvas plane
                const x = (i % 25) * 400;
                const y = Math.floor(i / 25) * 350;
                blocks.push(createMockBlock(`block_${i}`, x, y));

                if (i > 0) {
                    edges.push({
                        id: `edge_${i}`,
                        canvasId: 'test_canvas',
                        projectId: 'test_proj',
                        sourceBlockId: `block_${i - 1}`,
                        targetBlockId: `block_${i}`,
                        relationship: 'association',
                        createdAt: 1700000000000,
                    });
                }
            }
            return { blocks, edges };
        };

        it('does not cull blocks when scene count is below virtualization threshold', () => {
            const { blocks, edges } = createDenseScene(50);
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 1.0 },
                    containerDimensions: { width: 1000, height: 800 },
                    virtualizationThreshold: 500,
                })
            );

            expect(result.current.isVirtualizing).toBe(false);
            expect(result.current.visibleBlocks.length).toBe(50);
            expect(result.current.culledBlockCount).toBe(0);
        });

        it('culls out-of-viewport blocks in an ultra-dense scene (>500 blocks)', () => {
            const { blocks, edges } = createDenseScene(600);
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 1.0 },
                    containerDimensions: { width: 1200, height: 800 },
                    cullingMargin: 200,
                    virtualizationThreshold: 500,
                })
            );

            expect(result.current.isVirtualizing).toBe(true);
            expect(result.current.totalBlockCount).toBe(600);
            // Out of 600 spread across 10,000x10,000 canvas, only a small fraction is within 1200x800 + margin
            expect(result.current.visibleBlocks.length).toBeLessThan(600);
            expect(result.current.visibleBlocks.length).toBeGreaterThan(0);
            expect(result.current.culledBlockCount).toBe(600 - result.current.visibleBlocks.length);
        });

        it('never culls selected blocks even if outside viewport', () => {
            const { blocks, edges } = createDenseScene(600);
            const farOutsideBlockId = 'block_599'; // Last block at far coordinate
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 1.0 },
                    containerDimensions: { width: 1000, height: 800 },
                    selectedBlockIds: [farOutsideBlockId],
                    virtualizationThreshold: 500,
                })
            );

            expect(result.current.visibleBlocks.some((b) => b.id === farOutsideBlockId)).toBe(true);
        });

        it('never culls active dragging/resizing block even if outside viewport', () => {
            const { blocks, edges } = createDenseScene(600);
            const draggingBlockId = 'block_550';
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 1.0 },
                    containerDimensions: { width: 1000, height: 800 },
                    activeBlockId: draggingBlockId,
                    virtualizationThreshold: 500,
                })
            );

            expect(result.current.visibleBlocks.some((b) => b.id === draggingBlockId)).toBe(true);
        });

        it('omits edges whose source and target are both culled', () => {
            const { blocks, edges } = createDenseScene(600);
            const { result } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 1.0 },
                    containerDimensions: { width: 1000, height: 800 },
                    virtualizationThreshold: 500,
                })
            );

            expect(result.current.visibleEdges.length).toBeLessThan(edges.length);
        });

        it('computes low LOD at zoom levels < 0.4', () => {
            const { blocks, edges } = createDenseScene(10);
            const { result: resultFull } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 0.8 },
                    containerDimensions: { width: 1000, height: 800 },
                })
            );

            const { result: resultLow } = renderHook(() =>
                useCanvasVirtualization({
                    blocks,
                    edges,
                    viewport: { x: 0, y: 0, zoom: 0.35 },
                    containerDimensions: { width: 1000, height: 800 },
                })
            );

            expect(resultFull.current.isLowLOD).toBe(false);
            expect(resultFull.current.lodLevel).toBe('full');

            expect(resultLow.current.isLowLOD).toBe(true);
            expect(resultLow.current.lodLevel).toBe('low');
        });
    });

    describe('LODBlock Component', () => {
        it('renders lightweight LOD representation with badge, title, and role', () => {
            const block = createMockBlock('lod_1', 0, 0, 300, 200, 'workflow');
            const onSelect = vi.fn();

            render(<LODBlock block={block} isSelected={false} onSelect={onSelect} />);

            const lodElement = screen.getByTestId('lod-block');
            expect(lodElement).toBeInTheDocument();
            expect(lodElement).toHaveAttribute('data-lod', 'true');
            expect(lodElement).toHaveAttribute('data-block-type', 'workflow');
            expect(screen.getByText('WORKFLOW')).toBeInTheDocument();
            expect(screen.getByText('Block lod_1')).toBeInTheDocument();

            fireEvent.click(lodElement);
            expect(onSelect).toHaveBeenCalledWith('lod_1', false);
        });

        it('displays SELECTED indicator when isSelected is true', () => {
            const block = createMockBlock('lod_2', 0, 0, 300, 200, 'note');

            render(<LODBlock block={block} isSelected={true} />);

            expect(screen.getByText('SELECTED')).toBeInTheDocument();
        });
    });

    describe('CanvasEdgeLayer LOD Downsampling', () => {
        const blocks = [
            createMockBlock('b1', 0, 0, 200, 100),
            createMockBlock('b2', 400, 0, 200, 100),
        ];
        const edges: ProjectCanvasEdge[] = [
            {
                id: 'edge_test',
                canvasId: 'test_canvas',
                projectId: 'test_proj',
                sourceBlockId: 'b1',
                targetBlockId: 'b2',
                relationship: 'lineage',
                label: 'Derived stem',
                createdAt: 1700000000000,
            },
        ];

        it('renders full bezier path and midpoint label badge at full detail (isLowLOD=false)', () => {
            render(<CanvasEdgeLayer edges={edges} blocks={blocks} isLowLOD={false} />);

            const svg = screen.getByLabelText('Project Canvas Semantic Relationships');
            expect(svg).toHaveAttribute('data-lod', 'false');
            expect(screen.getByText(/Derived stem/i)).toBeInTheDocument();
        });

        it('omits midpoint text badge and downsamples path at low detail (isLowLOD=true)', () => {
            render(<CanvasEdgeLayer edges={edges} blocks={blocks} isLowLOD={true} />);

            const svg = screen.getByLabelText('Project Canvas Semantic Relationships');
            expect(svg).toHaveAttribute('data-lod', 'true');
            // Midpoint text badge should NOT be rendered in Low LOD
            expect(screen.queryByText(/Derived stem/i)).toBeNull();
        });
    });
});
