import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasAutosave } from '../useCanvasAutosave';
import { createDocFromImage } from '@/services/canvas/CanvasDoc';

const { mockStateRef, mockSaveDoc } = vi.hoisted(() => ({
    mockStateRef: { current: { currentDoc: null as unknown } },
    mockSaveDoc: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: unknown) => unknown) => selector(mockStateRef.current),
}));

vi.mock('@/services/canvas/CanvasDocumentService', () => ({
    CanvasDocumentService: { saveDoc: mockSaveDoc },
}));

describe('useCanvasAutosave (C1.5)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockSaveDoc.mockReset().mockResolvedValue(undefined);
        mockStateRef.current = { currentDoc: null };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not save when no document is open', () => {
        renderHook(() => useCanvasAutosave());
        act(() => {
            vi.advanceTimersByTime(3000);
        });
        expect(mockSaveDoc).not.toHaveBeenCalled();
    });

    it('persists the current doc after the debounce window', () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        const { rerender } = renderHook(() => useCanvasAutosave());

        act(() => {
            mockStateRef.current = { currentDoc: doc };
        });
        rerender();
        act(() => {
            vi.advanceTimersByTime(2100);
        });

        expect(mockSaveDoc).toHaveBeenCalledWith(doc);
    });

    it('debounces rapid changes into a single save of the latest doc', () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        const doc2 = { ...doc, updatedAt: doc.updatedAt + 1 };
        const { rerender } = renderHook(() => useCanvasAutosave());

        act(() => {
            mockStateRef.current = { currentDoc: doc };
        });
        rerender();
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        act(() => {
            mockStateRef.current = { currentDoc: doc2 };
        });
        rerender();
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(mockSaveDoc).not.toHaveBeenCalled(); // still inside the 2s debounce

        act(() => {
            vi.advanceTimersByTime(1100);
        });
        expect(mockSaveDoc).toHaveBeenCalledTimes(1);
        expect(mockSaveDoc).toHaveBeenCalledWith(doc2);
    });
});
