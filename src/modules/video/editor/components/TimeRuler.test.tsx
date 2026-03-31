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

    beforeEach(() => {
        vi.clearAllMocks();
        // Default store state
        (useVideoEditorStore as import("vitest").Mock).mockImplementation((selector: any) => {
            const state = { currentTime: 0 };
            return selector ? selector(state) : state;
        });
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
        (useVideoEditorStore as import("vitest").Mock).mockImplementation((selector: any) => {
            const state = { currentTime: 150 };
            return selector ? selector(state) : state;
        });

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
        (useVideoEditorStore as import("vitest").Mock).mockImplementation((selector: any) => {
            const state = { currentTime: 10 };
            return selector ? selector(state) : state;
        });

        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'ArrowLeft' });

        expect(mockOnSeek).toHaveBeenCalledWith(9);
    });

    it('respects boundaries', () => {
        // Test lower bound
        (useVideoEditorStore as import("vitest").Mock).mockImplementation((selector: any) => {
            const state = { currentTime: 0 };
            return selector ? selector(state) : state;
        });

        const { unmount } = render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');
        fireEvent.keyDown(slider, { key: 'ArrowLeft' });
        expect(mockOnSeek).not.toHaveBeenCalled(); // Should not seek if already at 0
        unmount();

        // Test upper bound
        (useVideoEditorStore as import("vitest").Mock).mockImplementation((selector: any) => {
            const state = { currentTime: 300 };
            return selector ? selector(state) : state;
        });

        render(<TimeRuler {...defaultProps} />);
        const sliderMax = screen.getByRole('slider');
        fireEvent.keyDown(sliderMax, { key: 'ArrowRight' });
        expect(mockOnSeek).not.toHaveBeenCalled(); // Should not seek if already at max
    });
});
