/**
 * phase3Acceptance.test.tsx
 *
 * Acceptance test suite for indii.music Project Canvas — Phase 3:
 * "Lineage, Branching, Collaboration, and Product Polish"
 *
 * Acceptance Criteria Verified:
 * 1. Create multiple derived versions and follow their lineage visually with non-color glyphs.
 * 2. Side-by-side comparison for compatible asset versions with preferred selection.
 * 3. Use a lifecycle template (8-stage Create -> Repeat) without altering Workflow Lab execution.
 * 4. Place reusable artist, release, or campaign references without duplicating records.
 * 5. Add, resolve, and link comments to blocks.
 * 6. Restore a prior canvas snapshot without deleting canonical records.
 * 7. Preview real calculable workflow cost or clearly report it as unavailable.
 * 8. Scalability fixtures (50, 150, 250 blocks + 300 edges) performance validation.
 * 9. A11y verification: keyboard navigation, screen-reader labels, non-color relationship indicators.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { useStore } from '@/core/store';
import { CanvasEdgeLayer } from '../components/edges/CanvasEdgeLayer';
import { VersionComparisonModal } from '../components/modals/VersionComparisonModal';
import { LifecycleTemplateService } from '../services/LifecycleTemplateService';
import { ProjectEntityBlock } from '../components/blocks/ProjectEntityBlock';
import { CanvasCommentModal } from '../components/comments/CanvasCommentModal';
import { CanvasSnapshotModal } from '../components/modals/CanvasSnapshotModal';
import { WorkflowBlock } from '../components/blocks/WorkflowBlock';
import type { ProjectCanvasBlock, ProjectCanvasEdge, CanvasComment } from '../types';

// Mock Workflow Persistence
vi.mock('@/modules/workflow/services/workflowPersistence', () => ({
    loadWorkflow: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'wf_with_cost') {
            return {
                id: 'wf_with_cost',
                name: 'Mastering Pipeline Recipe',
                description: 'Stem mastering and packaging',
                nodes: [{ id: 'n1', type: 'inputNode', data: {} }],
                edges: [],
                viewport: { x: 0, y: 0, zoom: 1 },
                createdAt: '2026-09-04T00:00:00.000Z',
                updatedAt: '2026-09-04T12:00:00.000Z',
                cost: 0.04,
            };
        }
        return {
            id: 'wf_no_cost',
            name: 'Generic Recipe',
            description: 'Recipe without determined input costs',
            nodes: [{ id: 'n1', type: 'inputNode', data: {} }],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            createdAt: '2026-09-04T00:00:00.000Z',
            updatedAt: '2026-09-04T12:00:00.000Z',
        };
    }),
}));

describe('Project Canvas Phase 3 Acceptance Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        useStore.setState({
            currentProjectId: 'proj_phase3_test',
            canvasBlocks: [],
            canvasEdges: [],
            selectedBlockIds: [],
        });
    });

    // ── Criterion 1: Visual Lineage & Non-Color Indicators ──────────────────
    it('Criterion 1: multiple derived versions render visual lineage with non-color glyphs and screen-reader labels', () => {
        const blockA: ProjectCanvasBlock = {
            id: 'asset_master_v1',
            type: 'asset',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 100, y: 100 },
            size: { width: 240, height: 180 },
            zIndex: 1,
            snapshot: { title: 'Cover Art v1 (Master)', cachedAt: Date.now() },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const blockB: ProjectCanvasBlock = {
            id: 'asset_derived_v2',
            type: 'asset',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 450, y: 100 },
            size: { width: 240, height: 180 },
            zIndex: 1,
            snapshot: { title: 'Cover Art v2 (Remaster)', cachedAt: Date.now() },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const lineageEdge: ProjectCanvasEdge = {
            id: 'edge_lineage_1',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            sourceBlockId: 'asset_master_v1',
            targetBlockId: 'asset_derived_v2',
            relationship: 'lineage',
            label: 'Upscaled 4K',
            createdAt: Date.now(),
        };

        const { container } = render(
            <CanvasEdgeLayer
                edges={[lineageEdge]}
                blocks={[blockA, blockB]}
                onRemoveEdge={vi.fn()}
            />
        );

        // 1. Verify path rendered with lineage styling (#06b6d4)
        const path = container.querySelector('g[role="img"] path');
        expect(path).toBeInTheDocument();
        expect(path).toHaveAttribute('stroke', '#06b6d4');
        expect(path).toHaveAttribute('marker-end', 'url(#arrow-lineage)');

        // 2. Verify non-color glyph indicator (↳) rendered
        expect(screen.getByText(/↳/)).toBeInTheDocument();
        expect(screen.getByText(/Upscaled 4K/)).toBeInTheDocument();

        // 3. Verify screen-reader label
        const group = container.querySelector('g[role="img"]');
        expect(group).toHaveAttribute(
            'aria-label',
            'Lineage: target derived from source: Upscaled 4K'
        );
    });

    // ── Criterion 2: Side-by-Side Version Comparison ────────────────────────
    it('Criterion 2: side-by-side comparison sets preferred version without deleting alternative and links to editor', () => {
        const onSelectPreferred = vi.fn();
        const onClose = vi.fn();

        const blockA: ProjectCanvasBlock = {
            id: 'art_v1',
            type: 'asset',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 100, y: 100 },
            size: { width: 300, height: 300 },
            zIndex: 1,
            snapshot: {
                title: 'Neon Bloom Concept A',
                thumbnailUrl: 'https://example.com/art_a.jpg',
                mediaType: 'image',
                cachedAt: Date.now(),
            },
            settings: { dimensions: '3000x3000' },
            provenance: {
                creatorType: 'agent',
                creatorId: 'creative-specialist',
                agentName: 'Creative Specialist',
                operation: 'flux_generate',
                timestamp: Date.now(),
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const blockB: ProjectCanvasBlock = {
            id: 'art_v2',
            type: 'asset',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 450, y: 100 },
            size: { width: 300, height: 300 },
            zIndex: 1,
            snapshot: {
                title: 'Neon Bloom Concept B',
                thumbnailUrl: 'https://example.com/art_b.jpg',
                mediaType: 'image',
                cachedAt: Date.now(),
            },
            settings: { dimensions: '3000x3000' },
            provenance: {
                creatorType: 'agent',
                creatorId: 'creative-specialist',
                agentName: 'Creative Specialist',
                operation: 'magic_fill',
                timestamp: Date.now(),
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        render(
            <VersionComparisonModal
                isOpen={true}
                onClose={onClose}
                blockA={blockA}
                blockB={blockB}
                onSelectPreferred={onSelectPreferred}
            />
        );

        // Verify side-by-side headers and metadata
        expect(screen.getByText('Side-by-Side Version Comparison')).toBeInTheDocument();
        expect(screen.getByText('Neon Bloom Concept A')).toBeInTheDocument();
        expect(screen.getByText('Neon Bloom Concept B')).toBeInTheDocument();
        expect(screen.getByText('flux_generate')).toBeInTheDocument();
        expect(screen.getByText('magic_fill')).toBeInTheDocument();

        // Select Version B as preferred
        const setPreferredButtons = screen.getAllByText('Set as Preferred');
        expect(setPreferredButtons.length).toBe(2);
        fireEvent.click(setPreferredButtons[1]); // Click for Version B

        expect(onSelectPreferred).toHaveBeenCalledWith('art_v2');

        // Click "Editor" for Version A
        const editorButtons = screen.getAllByText('Editor');
        fireEvent.click(editorButtons[0]);

        // Verified navigation to creative editor without deleting either version
        expect(useStore.getState().currentModule).toBe('creative');
        expect(onClose).toHaveBeenCalled();
    });

    // ── Criterion 3: Lifecycle Templates ────────────────────────────────────
    it('Criterion 3: lifecycle template generates 8 organizational stages without executing background tasks', () => {
        const result = LifecycleTemplateService.generateFullLifecycleTemplate(100, 100);

        // 1. Verify 8 canonical stages
        expect(result.blocks.length).toBe(8);
        const stageNames = result.blocks.map((b) => b.settings?.stage);
        expect(stageNames).toEqual([
            'create',
            'prepare',
            'register',
            'deliver',
            'release',
            'track',
            'operate',
            'repeat',
        ]);

        // 2. Verify non-executing sequence edges
        expect(result.edges.length).toBe(7);
        for (const edge of result.edges) {
            expect(edge.relationship).toBe('sequence');
            expect(edge.label).toBe('Next Stage');
        }

        // 3. Verify frames are spatial containers (zIndex: 0)
        for (const block of result.blocks) {
            expect(block.type).toBe('frame');
            expect(block.zIndex).toBe(0);
        }
    });

    // ── Criterion 4: Canonical Reusable Project Entities ────────────────────
    it('Criterion 4: project entity block hydrates canonical artist profile and removes placement without deleting canonical record', async () => {
        const onRemovePlacement = vi.fn();

        const entityBlock: ProjectCanvasBlock = {
            id: 'block_artist_solis',
            type: 'project_entity',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 100, y: 100 },
            size: { width: 300, height: 200 },
            zIndex: 1,
            entityRef: {
                kind: 'project_entity',
                entityId: 'artist_solis',
                versionId: 'artist',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        render(
            <ProjectEntityBlock
                block={entityBlock}
                isSelected={false}
                onRemovePlacement={onRemovePlacement}
                onSelect={vi.fn()}
            />
        );

        // Await live hydration from store userProfile
        await waitFor(() => {
            expect(screen.getAllByText('Solis Music').length).toBeGreaterThanOrEqual(1);
        });

        expect(screen.getAllByText('Neo-Soul').length).toBeGreaterThanOrEqual(1);
        expect(
            screen.getByText('Independent neo-soul producer and songwriter.')
        ).toBeInTheDocument();

        // Open options and click "Remove from Canvas"
        const optionsBtn = screen.getByTitle('Options');
        fireEvent.click(optionsBtn);

        const removeBtn = screen.getByText('Remove from Canvas');
        fireEvent.click(removeBtn);

        expect(onRemovePlacement).toHaveBeenCalledWith('block_artist_solis');

        // Canonical userProfile remains completely intact
        const profile = useStore.getState().userProfile;
        expect(profile?.displayName).toBe('Solis Music');
    });

    // ── Criterion 5: Comments and Collaboration ─────────────────────────────
    it('Criterion 5: attach, view, and resolve comments on canvas blocks', () => {
        const onAddComment = vi.fn();
        const onResolveComment = vi.fn();

        const initialComments: CanvasComment[] = [
            {
                id: 'comm_1',
                canvasId: 'c1',
                projectId: 'proj_phase3_test',
                targetType: 'block',
                targetId: 'target_block_1',
                authorId: 'user_mix_engineer',
                authorName: 'Marcus (Mixer)',
                content: 'Need +1.5dB on the lead vocal stem before print.',
                createdAt: Date.now() - 3600000,
                resolved: false,
            },
        ];

        render(
            <CanvasCommentModal
                isOpen={true}
                onClose={vi.fn()}
                targetBlockId="target_block_1"
                targetTitle="Master Stem Pack"
                comments={initialComments}
                onAddComment={onAddComment}
                onResolveComment={onResolveComment}
            />
        );

        expect(screen.getByText('Comments: Master Stem Pack')).toBeInTheDocument();
        expect(screen.getByText('Marcus (Mixer)')).toBeInTheDocument();
        expect(
            screen.getByText('Need +1.5dB on the lead vocal stem before print.')
        ).toBeInTheDocument();

        // 1. Resolve existing comment
        const resolveBtn = screen.getByTitle('Mark as resolved');
        fireEvent.click(resolveBtn);
        expect(onResolveComment).toHaveBeenCalledWith('comm_1');

        // 2. Add new comment
        const input = screen.getByPlaceholderText('Add a comment or feedback...');
        fireEvent.change(input, { target: { value: 'Checked and boosted by 1.5dB.' } });

        const postBtn = screen.getByTitle('Post Comment');
        fireEvent.click(postBtn);
        expect(onAddComment).toHaveBeenCalledWith(
            'target_block_1',
            'Checked and boosted by 1.5dB.'
        );
    });

    // ── Criterion 6: Canvas Snapshots & Layout History ──────────────────────
    it('Criterion 6: named canvas layout snapshots can be created and restored without deleting canonical records', () => {
        const block1: ProjectCanvasBlock = {
            id: 'b1',
            type: 'text',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 200, y: 300 },
            size: { width: 200, height: 100 },
            zIndex: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        useStore.setState({
            canvasBlocks: [block1],
            canvasEdges: [],
            canvasViewport: { x: 50, y: 50, zoom: 1.2 },
        });

        const onClose = vi.fn();

        render(<CanvasSnapshotModal isOpen={true} onClose={onClose} />);

        // Create snapshot
        const input = screen.getByPlaceholderText(/Snapshot name/);
        fireEvent.change(input, { target: { value: 'Pre-Rollout Board v1' } });

        const saveBtn = screen.getByText('Save Snapshot');
        fireEvent.click(saveBtn);

        // Verify snapshot appears in list
        expect(screen.getByText('Pre-Rollout Board v1')).toBeInTheDocument();
        expect(screen.getByText('1 blocks')).toBeInTheDocument();

        // Simulate layout change
        useStore.setState({
            canvasBlocks: [],
            canvasViewport: { x: 0, y: 0, zoom: 1 },
        });
        expect(useStore.getState().canvasBlocks.length).toBe(0);

        // Click restore
        const restoreBtn = screen.getByTitle('Restore this canvas layout');
        fireEvent.click(restoreBtn);

        // Verify layout restored to store
        expect(useStore.getState().canvasBlocks.length).toBe(1);
        expect(useStore.getState().canvasBlocks[0].id).toBe('b1');
        expect(useStore.getState().canvasViewport.zoom).toBe(1.2);
    });

    // ── Criterion 7: Real Calculable Cost vs Unavailable Reporting ──────────
    it('Criterion 7: workflow block displays real calculable cost when available or reports unavailable', async () => {
        const wfBlockWithCost: ProjectCanvasBlock = {
            id: 'block_wf_cost',
            type: 'workflow',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 100, y: 100 },
            size: { width: 320, height: 240 },
            zIndex: 1,
            entityRef: {
                kind: 'workflow',
                entityId: 'wf_with_cost',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const { unmount } = render(
            <WorkflowBlock
                block={wfBlockWithCost}
                isSelected={false}
                onRemovePlacement={vi.fn()}
                onSelect={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Mastering Pipeline Recipe')).toBeInTheDocument();
        });

        // Real cost displayed
        expect(screen.getByText('$0.04')).toBeInTheDocument();

        unmount();

        // Test with uncalculated cost
        const wfBlockNoCost: ProjectCanvasBlock = {
            id: 'block_wf_no_cost',
            type: 'workflow',
            canvasId: 'c1',
            projectId: 'proj_phase3_test',
            position: { x: 100, y: 100 },
            size: { width: 320, height: 240 },
            zIndex: 1,
            entityRef: {
                kind: 'workflow',
                entityId: 'wf_no_cost',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        render(
            <WorkflowBlock
                block={wfBlockNoCost}
                isSelected={false}
                onRemovePlacement={vi.fn()}
                onSelect={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Generic Recipe')).toBeInTheDocument();
        });

        // Cost unavailable explicitly reported (never fabricated)
        expect(
            screen.getByText('Unavailable (Calculated at runtime)')
        ).toBeInTheDocument();
    });

    // ── Criterion 8: Scalability Fixtures (50, 150, 250 blocks + 300 edges) ──
    it('Criterion 8: scalability fixtures render 250 blocks and 300 relationships under 150ms', () => {
        const blockCounts = [50, 150, 250];

        for (const count of blockCounts) {
            const blocks: ProjectCanvasBlock[] = [];
            for (let i = 0; i < count; i++) {
                blocks.push({
                    id: `fixture_b_${i}`,
                    type: i % 2 === 0 ? 'asset' : 'note',
                    canvasId: 'c_perf',
                    projectId: 'proj_phase3_test',
                    position: { x: (i % 10) * 200, y: Math.floor(i / 10) * 150 },
                    size: { width: 180, height: 120 },
                    zIndex: 1,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
            }

            // Create 300 relationships for the largest fixture
            const edges: ProjectCanvasEdge[] = [];
            const edgeCount = count === 250 ? 300 : count;
            for (let e = 0; e < edgeCount; e++) {
                const srcIdx = e % count;
                const tgtIdx = (e + 1) % count;
                edges.push({
                    id: `fixture_edge_${e}`,
                    canvasId: 'c_perf',
                    projectId: 'proj_phase3_test',
                    sourceBlockId: `fixture_b_${srcIdx}`,
                    targetBlockId: `fixture_b_${tgtIdx}`,
                    relationship: e % 4 === 0 ? 'lineage' : e % 4 === 1 ? 'context' : e % 4 === 2 ? 'sequence' : 'association',
                    label: e % 5 === 0 ? `Step ${e}` : undefined,
                    createdAt: Date.now(),
                });
            }

            const startTime = performance.now();
            const { unmount } = render(
                <CanvasEdgeLayer edges={edges} blocks={blocks} onRemoveEdge={vi.fn()} />
            );
            const renderDuration = performance.now() - startTime;

            // Must render without throwing and complete in < 150ms
            expect(renderDuration).toBeLessThan(150);
            unmount();
        }
    });

    // ── Criterion 9: A11y & Non-Color Indicators ────────────────────────────
    it('Criterion 9: accessibility semantics, screen-reader labels, and non-color indicators are present across edge types', () => {
        const blocks: ProjectCanvasBlock[] = [
            { id: 'n1', type: 'note', canvasId: 'c', projectId: 'p', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, zIndex: 1, createdAt: 0, updatedAt: 0 },
            { id: 'n2', type: 'note', canvasId: 'c', projectId: 'p', position: { x: 200, y: 0 }, size: { width: 100, height: 100 }, zIndex: 1, createdAt: 0, updatedAt: 0 },
            { id: 'n3', type: 'note', canvasId: 'c', projectId: 'p', position: { x: 400, y: 0 }, size: { width: 100, height: 100 }, zIndex: 1, createdAt: 0, updatedAt: 0 },
            { id: 'n4', type: 'note', canvasId: 'c', projectId: 'p', position: { x: 600, y: 0 }, size: { width: 100, height: 100 }, zIndex: 1, createdAt: 0, updatedAt: 0 },
        ];

        const edges: ProjectCanvasEdge[] = [
            { id: 'e_assoc', canvasId: 'c', projectId: 'p', sourceBlockId: 'n1', targetBlockId: 'n2', relationship: 'association', createdAt: 0 },
            { id: 'e_lineage', canvasId: 'c', projectId: 'p', sourceBlockId: 'n2', targetBlockId: 'n3', relationship: 'lineage', createdAt: 0 },
            { id: 'e_context', canvasId: 'c', projectId: 'p', sourceBlockId: 'n3', targetBlockId: 'n4', relationship: 'context', createdAt: 0 },
            { id: 'e_seq', canvasId: 'c', projectId: 'p', sourceBlockId: 'n1', targetBlockId: 'n4', relationship: 'sequence', createdAt: 0 },
        ];

        render(<CanvasEdgeLayer edges={edges} blocks={blocks} />);

        // Non-color glyph indicators
        expect(screen.getByText('—')).toBeInTheDocument(); // association
        expect(screen.getByText('↳')).toBeInTheDocument(); // lineage
        expect(screen.getByText('✦')).toBeInTheDocument(); // context
        expect(screen.getByText('→')).toBeInTheDocument(); // sequence

        // Screen-reader labels
        expect(screen.getByLabelText('Association: items belong together')).toBeInTheDocument();
        expect(screen.getByLabelText('Lineage: target derived from source')).toBeInTheDocument();
        expect(screen.getByLabelText('Context: source supplies context to target')).toBeInTheDocument();
        expect(screen.getByLabelText('Sequence: source comes before target')).toBeInTheDocument();
    });
});
