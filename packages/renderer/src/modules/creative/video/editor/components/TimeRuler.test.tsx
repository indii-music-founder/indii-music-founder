import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeRuler } from './TimeRuler';
import { useVideoEditorStore } from '../../store/videoEditorStore';

// Mock store
vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

describe('TimeRuler', () => {
    const mockOnSeek = vi.fn();
    const defaultProps = {
        durationInFrames: 300,
        fps: 30,
        onSeek: mockOnSeek,
    };

    type MockVideoEditorState = { currentTime: number };
    type MockSelector = (state: MockVideoEditorState) => unknown;

    const setMockStoreState = (currentTime: number) => {
        (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation(
            (selector?: MockSelector) => {
                const state: MockVideoEditorState = { currentTime };
                return selector ? selector(state) : state;
            }
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default store state
        setMockStoreState(0);
    });

    it('renders with accessibility attributes', () => {
        render(<TimeRuler {...defaultProps} />);

        const slider = screen.getByRole('slider');
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveAttribute('tabIndex', '0');
        expect(slider).toHaveAttribute('aria-label', 'Timeline scrubber');
        expect(slider).toHaveAttribute('aria-valuemin', '0');
        expect(slider).toHaveAttribute('aria-valuemax', '300');
        expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('updates aria-valuenow when currentTime changes', () => {
        setMockStoreState(150);

        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '150');
    });

    it('seeks forward with Right Arrow', () => {
        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'ArrowRight' });

        // Should seek forward by 1 frame (or whatever logic I implement)
        // Assuming 1 frame for now
        expect(mockOnSeek).toHaveBeenCalledWith(1);
    });

    it('seeks backward with Left Arrow', () => {
        // Set start time to 10
        setMockStoreState(10);

        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'ArrowLeft' });

        expect(mockOnSeek).toHaveBeenCalledWith(9);
    });

    it('respects boundaries', () => {
        // Test lower bound
        setMockStoreState(0);

        const { unmount } = render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');
        fireEvent.keyDown(slider, { key: 'ArrowLeft' });
        expect(mockOnSeek).not.toHaveBeenCalled(); // Should not seek if already at 0
        unmount();

        // Test upper bound
        setMockStoreState(300);

        render(<TimeRuler {...defaultProps} />);
        const sliderMax = screen.getByRole('slider');
        fireEvent.keyDown(sliderMax, { key: 'ArrowRight' });
        expect(mockOnSeek).not.toHaveBeenCalled(); // Should not seek if already at max
    });
});
