import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeRuler } from './TimeRuler';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { TRACK_HEADER_WIDTH } from '../constants';

// Mock store
vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

// Polyfill PointerEvent for jsdom if needed
if (typeof window.PointerEvent === 'undefined') {

    class MockPointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, params: PointerEventInit = {}) {
            super(type, params);
            this.pointerId = params.pointerId ?? 0;
        }
    }
    window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
}

describe('TimeRuler', () => {

    const mockOnSeek = vi.fn();
    const defaultProps = {
        durationInFrames: 300,
        fps: 30,
        onSeek: mockOnSeek,
    };

    type MockVideoEditorState = {
        currentTime: number;
        timelineZoom?: number;
        loopRegion?: { a: number; b: number } | null;
    };
    type MockSelector = (state: MockVideoEditorState) => unknown;

    const setMockStoreState = (overrides: Partial<MockVideoEditorState> | number) => {
        const fullState: MockVideoEditorState = typeof overrides === 'number'
            ? { currentTime: overrides, timelineZoom: 1, loopRegion: null }
            : { currentTime: 0, timelineZoom: 1, loopRegion: null, ...overrides };

        (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation(
            (selector?: MockSelector) => {
                return selector ? selector(fullState) : fullState;
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

    it('renders 192px track header offset spacer by default', () => {
        render(<TimeRuler {...defaultProps} />);
        const spacer = screen.getByTestId('time-ruler-spacer');
        expect(spacer).toBeInTheDocument();
        expect(spacer.style.width).toBe(`${TRACK_HEADER_WIDTH}px`);
    });

    it('renders custom track header offset spacer if prop is passed', () => {
        render(<TimeRuler {...defaultProps} trackHeaderOffset={240} />);
        const spacer = screen.getByTestId('time-ruler-spacer');
        expect(spacer.style.width).toBe('240px');
    });

    it('seeks forward with Right Arrow', () => {
        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        expect(mockOnSeek).toHaveBeenCalledWith(1);
    });

    it('seeks backward with Left Arrow', () => {
        setMockStoreState(10);

        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'ArrowLeft' });
        expect(mockOnSeek).toHaveBeenCalledWith(9);
    });

    it('seeks with Home and End keys', () => {
        setMockStoreState(50);
        render(<TimeRuler {...defaultProps} />);
        const slider = screen.getByRole('slider');

        fireEvent.keyDown(slider, { key: 'Home' });
        expect(mockOnSeek).toHaveBeenCalledWith(0);

        fireEvent.keyDown(slider, { key: 'End' });
        expect(mockOnSeek).toHaveBeenCalledWith(300);
    });

    it('respects boundaries with arrow keys', () => {
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

    it('renders loop region overlay and in/out markers when loopRegion is set', () => {
        setMockStoreState({ loopRegion: { a: 30, b: 90 }, timelineZoom: 1 });
        render(<TimeRuler {...defaultProps} />);

        const overlay = screen.getByTestId('loop-region-overlay');
        expect(overlay).toBeInTheDocument();
        // At zoom 1: a=30 -> 60px, b=90 -> 180px, width = 120px
        expect(overlay.style.left).toBe('60px');
        expect(overlay.style.width).toBe('120px');

        const inMarker = screen.getByTestId('loop-in-marker');
        expect(inMarker).toBeInTheDocument();
        expect(inMarker).toHaveTextContent('⟦');

        const outMarker = screen.getByTestId('loop-out-marker');
        expect(outMarker).toBeInTheDocument();
        expect(outMarker).toHaveTextContent('⟧');
    });

    it('does not render loop region when loopRegion is null', () => {
        setMockStoreState({ loopRegion: null });
        render(<TimeRuler {...defaultProps} />);

        expect(screen.queryByTestId('loop-region-overlay')).toBeNull();
    });

    it('supports pointer capture scrubbing across the ruler', () => {
        render(<TimeRuler {...defaultProps} trackHeaderOffset={0} />);
        const slider = screen.getByRole('slider');

        // Mock pointer capture methods
        slider.setPointerCapture = vi.fn();
        slider.releasePointerCapture = vi.fn();

        // Pointer down at x = 100 (at pxPerFrame = 2, frame = 50)
        fireEvent.pointerDown(slider, { button: 0, clientX: 100, pointerId: 1 });
        expect(slider.setPointerCapture).toHaveBeenCalledWith(1);
        expect(mockOnSeek).toHaveBeenCalledWith(50);

        // Pointer move to x = 200 (frame = 100)
        fireEvent.pointerMove(slider, { clientX: 200, pointerId: 1 });
        expect(mockOnSeek).toHaveBeenCalledWith(100);

        // Pointer up at x = 250 (frame = 125)
        fireEvent.pointerUp(slider, { clientX: 250, pointerId: 1 });
        expect(slider.releasePointerCapture).toHaveBeenCalledWith(1);
        expect(mockOnSeek).toHaveBeenCalledWith(125);
    });

    it('clamps scrubbing to duration bounds', () => {
        render(<TimeRuler {...defaultProps} trackHeaderOffset={0} />);
        const slider = screen.getByRole('slider');

        // Drag past left bound (negative clientX)
        fireEvent.pointerDown(slider, { button: 0, clientX: -50 });
        expect(mockOnSeek).toHaveBeenCalledWith(0);

        // Drag past right bound (x > 300 * 2 = 600)
        fireEvent.pointerMove(slider, { clientX: 900 });
        expect(mockOnSeek).toHaveBeenCalledWith(300);
    });

    it('handles click-to-seek', () => {
        render(<TimeRuler {...defaultProps} trackHeaderOffset={0} />);
        const slider = screen.getByRole('slider');

        fireEvent.click(slider, { clientX: 120 });
        // 120 / 2 = 60
        expect(mockOnSeek).toHaveBeenCalledWith(60);
    });
});
