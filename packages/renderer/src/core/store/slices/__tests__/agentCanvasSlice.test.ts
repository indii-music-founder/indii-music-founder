/**
 * Unit tests for agentCanvasSlice — Agent-to-UI Push store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentCanvasSlice, type AgentCanvasSlice } from '@/core/store/slices/agentCanvasSlice';
import type { CanvasPushPayload } from '@/types/AgentCanvas';

// Minimal Zustand-compatible test harness
function createTestSlice(): AgentCanvasSlice {
    let state: AgentCanvasSlice;
    const set = (partial: Partial<AgentCanvasSlice> | ((s: AgentCanvasSlice) => Partial<AgentCanvasSlice>)) => {
        const patch = typeof partial === 'function' ? partial(state) : partial;
        state = { ...state, ...patch };
    };
    const get = () => state;
    state = createAgentCanvasSlice(set as any, get as any, {} as any);
    return new Proxy({} as AgentCanvasSlice, {
        get: (_target, prop: string) => {
            const val = state[prop as keyof AgentCanvasSlice];
            return typeof val === 'function' ? val.bind(state) : val;
        },
    });
}

const makePayload = (overrides?: Partial<CanvasPushPayload>): CanvasPushPayload => ({
    id: `panel-${Date.now()}`,
    title: 'Test Panel',
    type: 'markdown',
    data: { type: 'markdown', content: '# Hello World' },
    agentId: 'conductor',
    createdAt: Date.now(),
    ...overrides,
});

describe('agentCanvasSlice', () => {
    let slice: AgentCanvasSlice;

    beforeEach(() => {
        slice = createTestSlice();
    });

    describe('initial state', () => {
        it('should start with no panels and canvas closed', () => {
            expect(slice.canvasPanels).toHaveLength(0);
            expect(slice.isCanvasOpen).toBe(false);
        });
    });

    describe('pushCanvas', () => {
        it('should push a panel and open the canvas', () => {
            const payload = makePayload({ id: 'p1' });
            slice.pushCanvas(payload);
            expect(slice.canvasPanels).toHaveLength(1);
            expect(slice.canvasPanels[0]!.id).toBe('p1');
            expect(slice.isCanvasOpen).toBe(true);
        });

        it('should accumulate multiple panels', () => {
            slice.pushCanvas(makePayload({ id: 'p1' }));
            slice.pushCanvas(makePayload({ id: 'p2' }));
            slice.pushCanvas(makePayload({ id: 'p3' }));
            expect(slice.canvasPanels).toHaveLength(3);
        });
    });

    describe('clearCanvas', () => {
        it('should remove all panels and close canvas', () => {
            slice.pushCanvas(makePayload({ id: 'p1' }));
            slice.pushCanvas(makePayload({ id: 'p2' }));
            slice.clearCanvas();
            expect(slice.canvasPanels).toHaveLength(0);
            expect(slice.isCanvasOpen).toBe(false);
        });
    });

    describe('removePanel', () => {
        it('should remove a specific panel by ID', () => {
            slice.pushCanvas(makePayload({ id: 'p1' }));
            slice.pushCanvas(makePayload({ id: 'p2' }));
            slice.removePanel('p1');
            expect(slice.canvasPanels).toHaveLength(1);
            expect(slice.canvasPanels[0]!.id).toBe('p2');
        });

        it('should close canvas when last panel is removed', () => {
            slice.pushCanvas(makePayload({ id: 'p1' }));
            slice.removePanel('p1');
            expect(slice.canvasPanels).toHaveLength(0);
            expect(slice.isCanvasOpen).toBe(false);
        });
    });

    describe('toggleCanvas', () => {
        it('should toggle canvas open/closed', () => {
            expect(slice.isCanvasOpen).toBe(false);
            slice.toggleCanvas();
            expect(slice.isCanvasOpen).toBe(true);
            slice.toggleCanvas();
            expect(slice.isCanvasOpen).toBe(false);
        });
    });
});
