import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentContext } from '@/services/agent/types';
import { importWithRetry } from '@/utils/dynamicImport';

let mockCurrentProjectId: string | null = 'proj-123';
let mockCurrentCanvas: any = { id: 'canvas-1', name: 'Main Canvas' };
let mockCanvasBlocks: any[] = [];
let mockCanvasEdges: any[] = [];

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn(() => ({})),
        {
            getState: vi.fn(() => ({
                currentProjectId: mockCurrentProjectId,
                currentCanvas: mockCurrentCanvas,
                canvasBlocks: mockCanvasBlocks,
                canvasEdges: mockCanvasEdges,
                addCanvasBlock: vi.fn(() => 'block-new'),
                addCanvasEdge: vi.fn(() => 'edge-new'),
                notes: [],
            })),
            setState: vi.fn(),
            subscribe: vi.fn(() => () => {}),
        }
    ),
}));

const { ProjectCanvasTools } = await importWithRetry(() => import('@/services/agent/tools/ProjectCanvasTools'));

const mockContext: AgentContext = {
    userId: 'test-uid',
    chatHistory: [],
    activeModule: 'project-canvas',
};

describe('ProjectCanvasTools - canvas_get_project_canvas', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentProjectId = 'proj-123';
        mockCurrentCanvas = { id: 'canvas-1', title: 'Album Rollout Canvas' };
        mockCanvasBlocks = [];
        mockCanvasEdges = [];
    });

    it('returns error when no active project context exists', async () => {
        mockCurrentProjectId = null;
        const result = await ProjectCanvasTools.canvas_get_project_canvas({}, mockContext);
        expect(result.success).toBe(false);
        expect(result.error).toContain('No active project context found');
    });

    it('returns empty list when canvas has no blocks or edges', async () => {
        const result = await ProjectCanvasTools.canvas_get_project_canvas({}, mockContext);
        expect(result.success).toBe(true);
        expect(result.data.totalBlocks).toBe(0);
        expect(result.data.totalEdges).toBe(0);
        expect(result.data.canvasTitle).toBe('Album Rollout Canvas');
    });

    it('retrieves and truncates blocks with excerpts and edges', async () => {
        mockCanvasBlocks = [
            {
                id: 'b1',
                type: 'note',
                position: { x: 100, y: 150 },
                size: { width: 200, height: 100 },
                snapshot: { title: 'Tracklist Ideas', excerpt: '1. Detroit Sound, 2. Nightfall' },
                createdAt: 1000,
            },
            {
                id: 'b2',
                type: 'asset',
                position: { x: 350, y: 150 },
                size: { width: 300, height: 200 },
                snapshot: { title: 'Master WAV', excerpt: 'Audio file 44.1kHz' },
                createdAt: 1050,
            },
        ];
        mockCanvasEdges = [
            {
                id: 'e1',
                sourceBlockId: 'b1',
                targetBlockId: 'b2',
                relationship: 'references',
                label: 'relates to',
            },
        ];

        const result = await ProjectCanvasTools.canvas_get_project_canvas({}, mockContext);
        expect(result.success).toBe(true);
        expect(result.data.totalBlocks).toBe(2);
        expect(result.data.blocks[0].title).toBe('Tracklist Ideas');
        expect(result.data.blocks[0].excerpt).toContain('Detroit Sound');
        expect(result.data.totalEdges).toBe(1);
        expect(result.data.edges[0].sourceBlockId).toBe('b1');
    });

    it('filters blocks by blockType when provided', async () => {
        mockCanvasBlocks = [
            { id: 'b1', type: 'note', snapshot: { title: 'Note 1' } },
            { id: 'b2', type: 'asset', snapshot: { title: 'Asset 1' } },
        ];

        const result = await ProjectCanvasTools.canvas_get_project_canvas({ blockType: 'note' }, mockContext);
        expect(result.success).toBe(true);
        expect(result.data.totalBlocks).toBe(1);
        expect(result.data.blocks[0].id).toBe('b1');
    });
});
