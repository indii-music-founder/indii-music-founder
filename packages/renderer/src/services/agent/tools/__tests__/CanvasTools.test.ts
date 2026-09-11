/**
 * Unit tests for CanvasTools — Agent-to-UI push tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentContext } from '@/services/agent/types';
import { importWithRetry } from '@/utils/dynamicImport';

// Mock the store to capture pushCanvas/clearCanvas calls
const mockPushCanvas = vi.fn();
const mockClearCanvas = vi.fn();
let mockCanvasPanels: any[] = [];
let mockIsCanvasOpen = false;
let mockCurrentDoc: any = null;

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn(() => ({})),
        {
            getState: vi.fn(() => ({
                pushCanvas: mockPushCanvas,
                clearCanvas: mockClearCanvas,
                canvasPanels: mockCanvasPanels,
                isCanvasOpen: mockIsCanvasOpen,
                currentDoc: mockCurrentDoc,
            })),
            setState: vi.fn(),
            subscribe: vi.fn(() => () => { }),
        }
    ),
}));

// Must import AFTER mock is declared
const { CanvasTools } = await importWithRetry(() => import('@/services/agent/tools/CanvasTools'));

const mockContext: AgentContext = {
    userId: 'test-uid',
    chatHistory: [],
    activeModule: 'dashboard',
};

describe('CanvasTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('canvas_push', () => {
        it('should push a markdown panel', async () => {
            const result = await CanvasTools.canvas_push(
                {
                    title: 'Analysis Results',
                    type: 'markdown',
                    data: { type: 'markdown', content: '# Report\n\nAll good.' },
                },
                mockContext
            );
            expect(result.success).toBe(true);
            expect(mockPushCanvas).toHaveBeenCalledTimes(1);
            const call = mockPushCanvas.mock.calls[0]![0];
            expect(call.title).toBe('Analysis Results');
            expect(call.type).toBe('markdown');
        });

        it('should push a table panel', async () => {
            const result = await CanvasTools.canvas_push(
                {
                    title: 'Track Status',
                    type: 'table',
                    data: {
                        type: 'table',
                        columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }],
                        rows: [{ name: 'Track 1', status: 'Live' }, { name: 'Track 2', status: 'Pending' }],
                    },
                },
                mockContext
            );
            expect(result.success).toBe(true);
            const call = mockPushCanvas.mock.calls[0]![0];
            expect(call.type).toBe('table');
        });

        it('should reject invalid type', async () => {
            const result = await CanvasTools.canvas_push(
                {
                    title: 'Bad',
                    type: 'invalid_type' as 'markdown',
                    data: { type: 'markdown', content: 'x' },
                },
                mockContext
            );
            expect(result.success).toBe(false);
            expect(mockPushCanvas).not.toHaveBeenCalled();
        });

        it('should reject missing title', async () => {
            const result = await CanvasTools.canvas_push(
                {
                    title: '',
                    type: 'markdown',
                    data: { type: 'markdown', content: 'x' },
                },
                mockContext
            );
            expect(result.success).toBe(false);
        });
    });

    describe('canvas_clear', () => {
        it('should clear all panels', async () => {
            const result = await CanvasTools.canvas_clear({}, mockContext);
            expect(result.success).toBe(true);
            expect(mockClearCanvas).toHaveBeenCalledTimes(1);
        });
    });

    describe('canvas_inspect', () => {
        beforeEach(() => {
            mockCanvasPanels = [];
            mockIsCanvasOpen = false;
            mockCurrentDoc = null;
        });

        it('should return empty status when no panels are active', async () => {
            const result = await CanvasTools.canvas_inspect({}, mockContext);
            expect(result.success).toBe(true);
            expect(result.data.panelCount).toBe(0);
            expect(result.data.panels).toEqual([]);
            expect(result.data.isCanvasOpen).toBe(false);
            expect(result.message).toContain('Agent canvas drawer is currently empty');
        });

        it('should return structured summaries when panels are present', async () => {
            mockCanvasPanels = [
                {
                    id: 'p-1',
                    type: 'card',
                    title: 'Revenue Snapshot',
                    agentId: 'finance',
                    createdAt: 1000,
                    data: {
                        type: 'card',
                        cards: [{ title: 'MRR', value: '$5,200' }, { title: 'Streams', value: '1.2M' }],
                    },
                },
                {
                    id: 'p-2',
                    type: 'markdown',
                    title: 'Release Plan',
                    agentId: 'marketing',
                    createdAt: 2000,
                    data: {
                        type: 'markdown',
                        content: '# Marketing Rollout\n\nSingle drops on Friday.',
                    },
                },
            ];
            mockIsCanvasOpen = true;

            const result = await CanvasTools.canvas_inspect({}, mockContext);
            expect(result.success).toBe(true);
            expect(result.data.panelCount).toBe(2);
            expect(result.data.isCanvasOpen).toBe(true);
            expect(result.data.panels[0].title).toBe('Revenue Snapshot');
            expect(result.data.panels[0].excerpt).toContain('MRR: $5,200');
            expect(result.data.panels[1].title).toBe('Release Plan');
            expect(result.data.panels[1].excerpt).toContain('Marketing Rollout');
            expect(result.message).toContain('Agent canvas has 2 active panel(s)');
        });

        it('should retrieve a specific panel by panelId', async () => {
            mockCanvasPanels = [
                {
                    id: 'p-target',
                    type: 'markdown',
                    title: 'Target Panel',
                    agentId: 'generalist',
                    createdAt: 3000,
                    data: { content: 'Detailed markdown text' },
                },
            ];

            const result = await CanvasTools.canvas_inspect({ panelId: 'p-target' }, mockContext);
            expect(result.success).toBe(true);
            expect(result.data.panel.id).toBe('p-target');
            expect(result.data.panel.title).toBe('Target Panel');
        });

        it('should return error when queried panelId does not exist', async () => {
            mockCanvasPanels = [];
            const result = await CanvasTools.canvas_inspect({ panelId: 'p-missing' }, mockContext);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
});
