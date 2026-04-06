/**
 * Unit tests for CanvasTools — Agent-to-UI push tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentContext } from '@/services/agent/types';

// Mock the store to capture pushCanvas/clearCanvas calls
const mockPushCanvas = vi.fn();
const mockClearCanvas = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn(() => ({})),
        {
            getState: vi.fn(() => ({
                pushCanvas: mockPushCanvas,
                clearCanvas: mockClearCanvas,
            })),
            setState: vi.fn(),
            subscribe: vi.fn(() => () => { }),
        }
    ),
}));

// Must import AFTER mock is declared
const { CanvasTools } = await import('@/services/agent/tools/CanvasTools');

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
});
