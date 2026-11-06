import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateWorkflowFromPrompt,
    modifyWorkflowWithAI,
    auditionWorkflowVariants,
    encapsulateSubgraph,
    expandSubgraph
} from './workflowGenerator';
import type { SavedWorkflow, CustomNode } from '../types';
import { Status } from '../types';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateStructuredData: generate }
}));

// ── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_GRAPH = {
    name: 'Test Workflow',
    description: 'A valid generated workflow',
    nodes: [
        { id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input' } },
        {
            id: 'art-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'art-department-job-0' }
        },
        { id: 'end', type: 'outputNode', position: { x: 600, y: 0 }, data: { nodeType: 'output' } }
    ],
    edges: [
        { id: 'e1', source: 'start', target: 'art-1' },
        { id: 'e2', source: 'art-1', target: 'end' }
    ]
};

function makeSavedWorkflow(overrides: Partial<SavedWorkflow> = {}): SavedWorkflow {
    return {
        id: 'wf-test-001',
        name: 'Neon Drift Release',
        description: 'Full release campaign',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 0, y: 0 },
                data: { nodeType: 'input', prompt: 'Neon Drift', status: Status.PENDING }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 600, y: 0 },
                data: { nodeType: 'output', status: Status.PENDING }
            }
        ],
        edges: [{ id: 'e1', source: 'start', target: 'end' }],
        ...overrides
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('workflow architect response validation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects an empty provider result with a useful error', async () => {
        generate.mockResolvedValueOnce(undefined);
        await expect(generateWorkflowFromPrompt('Create cover art')).rejects.toThrow('incomplete graph');
    });

    it('rejects edges to nonexistent nodes', async () => {
        generate.mockResolvedValueOnce({
            nodes: [{ id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input' } }],
            edges: [{ id: 'bad', source: 'start', target: 'missing' }]
        });
        await expect(generateWorkflowFromPrompt('Create cover art')).rejects.toThrow('disconnected reference');
    });

    it('rejects invented department jobs', async () => {
        generate.mockResolvedValueOnce({
            nodes: [{ id: 'art', type: 'departmentNode', position: { x: 0, y: 0 }, data: { nodeType: 'department', departmentName: 'Imaginary', selectedJobId: 'fake' } }],
            edges: []
        });
        await expect(generateWorkflowFromPrompt('Create cover art')).rejects.toThrow('unavailable job');
    });

    it('returns a SavedWorkflow with correct shape when provider returns valid graph', async () => {
        generate.mockResolvedValueOnce(VALID_GRAPH);
        const result = await generateWorkflowFromPrompt('I want cover art for my album');
        expect(result.id).toBeTruthy();
        expect(result.nodes).toHaveLength(3);
        expect(result.edges).toHaveLength(2);
        expect(result.name).toBe('Test Workflow');
        expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });
});

describe('modifyWorkflowWithAI', () => {
    beforeEach(() => vi.clearAllMocks());

    it('merges AI-generated graph changes onto the existing workflow', async () => {
        const updatedGraph = {
            name: 'Neon Drift Release (Updated)',
            description: 'With added QC step',
            nodes: [
                { id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input' } },
                {
                    id: 'qc-1',
                    type: 'departmentNode',
                    position: { x: 300, y: 0 },
                    data: { nodeType: 'department', departmentName: 'Music Department', selectedJobId: 'music-audio-qc' }
                },
                { id: 'end', type: 'outputNode', position: { x: 600, y: 0 }, data: { nodeType: 'output' } }
            ],
            edges: [
                { id: 'e1', source: 'start', target: 'qc-1' },
                { id: 'e2', source: 'qc-1', target: 'end' }
            ]
        };
        generate.mockResolvedValueOnce(updatedGraph);

        const existing = makeSavedWorkflow();
        const result = await modifyWorkflowWithAI(existing, 'Add an Audio QC step before the output');

        expect(result.id).toBe('wf-test-001'); // Preserved original ID
        expect(result.name).toBe('Neon Drift Release (Updated)');
        expect(result.nodes.some(n => n.id === 'qc-1')).toBe(true);
        // updatedAt should be refreshed
        expect(result.updatedAt).not.toBe(existing.updatedAt);
    });

    it('rejects an AI-modified graph that references a nonexistent node', async () => {
        generate.mockResolvedValueOnce({
            nodes: [{ id: 'only-node', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input' } }],
            edges: [{ id: 'bad-edge', source: 'only-node', target: 'ghost-node' }]
        });
        const existing = makeSavedWorkflow();
        await expect(modifyWorkflowWithAI(existing, 'Break everything')).rejects.toThrow('disconnected reference');
    });
});

describe('auditionWorkflowVariants', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns structured variants from the AI provider', async () => {
        const mockVariants = {
            variants: [
                { id: 'v1', title: 'Cinematic', description: 'Dark and moody', prompt: 'cinematic', styleRationale: 'Great for playlists' },
                { id: 'v2', title: 'Minimal', description: 'Clean typography', prompt: 'minimal', styleRationale: 'Thumbnail legibility' },
                { id: 'v3', title: 'Analog', description: '35mm film grain', prompt: 'analog', styleRationale: 'Intimate indie feel' }
            ]
        };
        generate.mockResolvedValueOnce(mockVariants);

        const artNode: CustomNode = {
            id: 'art-1',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-department-job-0',
                prompt: 'neon city vibes',
                status: Status.PENDING
            }
        };

        const variants = await auditionWorkflowVariants(artNode, 'Neon Drift — synth-pop summer single');
        expect(variants).toHaveLength(3);
        expect(variants[0].title).toBe('Cinematic');
        expect(variants[1].styleRationale).toBe('Thumbnail legibility');
    });

    it('returns 3 fallback variants when the AI provider throws', async () => {
        generate.mockRejectedValueOnce(new Error('Model quota exceeded'));

        const artNode: CustomNode = {
            id: 'art-fallback',
            type: 'departmentNode',
            position: { x: 300, y: 0 },
            data: {
                nodeType: 'department',
                departmentName: 'Art Department',
                selectedJobId: 'art-department-job-0',
                prompt: 'ethereal dreamscape',
                status: Status.PENDING
            }
        };

        const variants = await auditionWorkflowVariants(artNode, 'Quiet Hours — ambient EP');
        expect(variants).toHaveLength(3);
        // All fallback variants should have required fields
        for (const v of variants) {
            expect(v.id).toBeTruthy();
            expect(v.title).toBeTruthy();
            expect(v.prompt).toContain('ethereal dreamscape');
        }
    });
});

describe('encapsulateSubgraph + expandSubgraph', () => {
    it('collapses selected nodes into a single subgraphNode and rewires external edges', () => {
        const workflow = makeSavedWorkflow({
            nodes: [
                { id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input', prompt: 'go', status: Status.PENDING } },
                { id: 'art-a', type: 'departmentNode', position: { x: 300, y: 0 }, data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'art-department-job-0', status: Status.PENDING } },
                { id: 'art-b', type: 'departmentNode', position: { x: 600, y: 0 }, data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'art-upscale-job', status: Status.PENDING } },
                { id: 'end', type: 'outputNode', position: { x: 900, y: 0 }, data: { nodeType: 'output', status: Status.PENDING } }
            ],
            edges: [
                { id: 'e1', source: 'start', target: 'art-a' },
                { id: 'e2', source: 'art-a', target: 'art-b' },
                { id: 'e3', source: 'art-b', target: 'end' }
            ]
        });

        const collapsed = encapsulateSubgraph(workflow, ['art-a', 'art-b'], 'Micro Art Suite');

        // Should have 3 nodes: start, the new subgraphNode, end
        expect(collapsed.nodes).toHaveLength(3);
        const subNode = collapsed.nodes.find(n => n.type === 'subgraphNode');
        expect(subNode).toBeDefined();
        expect((subNode!.data as { label: string }).label).toBe('Micro Art Suite');

        // External edges must be rewired to/from the composite node
        const sources = collapsed.edges.map(e => e.source);
        const targets = collapsed.edges.map(e => e.target);
        expect(sources).toContain('start');
        expect(targets).toContain('end');
        expect(sources.some(s => s === subNode!.id)).toBe(true);
        expect(targets.some(t => t === subNode!.id)).toBe(true);
    });

    it('round-trips: encapsulate then expand returns all original inner nodes to the canvas', () => {
        const workflow = makeSavedWorkflow({
            nodes: [
                { id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input', prompt: 'go', status: Status.PENDING } },
                { id: 'art-a', type: 'departmentNode', position: { x: 300, y: 0 }, data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'art-department-job-0', status: Status.PENDING } },
                { id: 'art-b', type: 'departmentNode', position: { x: 600, y: 0 }, data: { nodeType: 'department', departmentName: 'Art Department', selectedJobId: 'art-upscale-job', status: Status.PENDING } },
                { id: 'end', type: 'outputNode', position: { x: 900, y: 0 }, data: { nodeType: 'output', status: Status.PENDING } }
            ],
            edges: [
                { id: 'e1', source: 'start', target: 'art-a' },
                { id: 'e2', source: 'art-a', target: 'art-b' },
                { id: 'e3', source: 'art-b', target: 'end' }
            ]
        });

        const collapsed = encapsulateSubgraph(workflow, ['art-a', 'art-b'], 'Micro Art Suite');
        const subNodeId = collapsed.nodes.find(n => n.type === 'subgraphNode')!.id;

        const expanded = expandSubgraph(collapsed, subNodeId);

        // All 4 original nodes should be back on the canvas
        expect(expanded.nodes).toHaveLength(4);
        const expandedIds = expanded.nodes.map(n => n.id);
        expect(expandedIds).toContain('start');
        expect(expandedIds).toContain('art-a');
        expect(expandedIds).toContain('art-b');
        expect(expandedIds).toContain('end');

        // No composite node should remain
        expect(expanded.nodes.some(n => n.type === 'subgraphNode')).toBe(false);
    });

    it('returns workflow unchanged when given empty selection', () => {
        const workflow = makeSavedWorkflow();
        const result = encapsulateSubgraph(workflow, [], 'Empty');
        expect(result.nodes).toHaveLength(workflow.nodes.length);
        expect(result.edges).toHaveLength(workflow.edges.length);
    });

    it('returns workflow unchanged when asked to expand a non-subgraph node', () => {
        const workflow = makeSavedWorkflow();
        const result = expandSubgraph(workflow, 'start'); // 'start' is an inputNode, not a subgraphNode
        expect(result.nodes).toHaveLength(workflow.nodes.length);
    });
});
