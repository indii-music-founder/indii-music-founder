import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoResizeTextarea } from './use-auto-resize-textarea';
import React from 'react';

// Mock component to use the hook
const TestComponent = ({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) => {
    const { textareaRef } = useAutoResizeTextarea({ minHeight, maxHeight });
    return (
        <textarea
            ref={textareaRef}
            data-testid="textarea"
            style={{ width: '100px' }}
        />
    );
};

describe('useAutoResizeTextarea', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should set initial height to minHeight', () => {
        const { getByTestId } = render(<TestComponent minHeight={50} />);
        const textarea = getByTestId('textarea');
        expect(textarea.style.height).toBe('50px');
    });

    it('should adjust height on resize event (debounced)', () => {
        const { getByTestId } = render(<TestComponent minHeight={50} />);
        const textarea = getByTestId('textarea');

        // Mock scrollHeight
        Object.defineProperty(textarea, 'scrollHeight', { value: 100, configurable: true });

        // Trigger resize
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });

        // Should not have updated immediately due to debounce
        expect(textarea.style.height).toBe('50px');

        // Fast-forward time for debounce + RAF
        act(() => {
            vi.advanceTimersByTime(100); // debounce
            vi.advanceTimersByTime(50); // RAF
        });

        expect(textarea.style.height).toBe('100px');
    });

    it('should respect maxHeight', () => {
        const { getByTestId } = render(<TestComponent minHeight={50} maxHeight={80} />);
        const textarea = getByTestId('textarea');

        Object.defineProperty(textarea, 'scrollHeight', { value: 100, configurable: true });

        act(() => {
            window.dispatchEvent(new Event('resize'));
            vi.advanceTimersByTime(100); // debounce
            vi.advanceTimersByTime(50); // RAF
        });

        expect(textarea.style.height).toBe('80px');
    });
});
