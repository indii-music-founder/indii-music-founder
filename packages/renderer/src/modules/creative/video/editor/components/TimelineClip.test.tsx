import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { TimelineClip, TimelineClipProps } from './TimelineClip';
import { VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';

vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: Object.assign(vi.fn(), {
        getState: vi.fn(),
    }),
}));

describe('TimelineClip — Feature 22: Keyframe Diamond Dragging', () => {
    const mockToggleExpand = vi.fn();
    const mockRemove = vi.fn();
    const mockDragStart = vi.fn();
    const mockAddKeyframe = vi.fn();
    const mockKeyframeClick = vi.fn();
    const mockMoveKeyframe = vi.fn();

    const mockClip: VideoClip = {
        id: 'clip-test-1',
        trackId: 'track-1',
        type: 'video',
        name: 'Keyframe Clip',
        startFrame: 0,
        durationInFrames: 100,
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        keyframes: {
            opacity: [
                { frame: 10, value: 0.5, easing: 'easeIn' },
                { frame: 50, value: 1.0, easing: 'easeInOut' },
            ],
            scale: [
                { frame: 20, value: 1.2, easing: 'easeOut' },
                { frame: 80, value: 2.0, easing: 'linear' },
            ],
        },
    };

    const defaultProps: TimelineClipProps = {
        clip: mockClip,
        isSelected: true,
        isExpanded: true,
        isLocked: false,
        onToggleExpand: mockToggleExpand,
        onRemove: mockRemove,
        onDragStart: mockDragStart,
        onAddKeyframe: mockAddKeyframe,
        onKeyframeClick: mockKeyframeClick,
        onMoveKeyframe: mockMoveKeyframe,
    };

    const mockSplitClip = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        const mockStoreState = {
            timelineZoom: 1,
            project: { fps: 30 },
            activeTool: 'select',
            moveKeyframe: mockMoveKeyframe,
            splitClip: mockSplitClip,
        };
        (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });
        (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue(mockStoreState);
    });

    it('renders keyframe diamonds with data-testid and grab cursor classes', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond1 = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');
        const diamond2 = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-50');
        const diamond3 = screen.getByTestId('keyframe-diamond-clip-test-1-scale-20');
        const diamond4 = screen.getByTestId('keyframe-diamond-clip-test-1-scale-80');

        expect(diamond1).toBeInTheDocument();
        expect(diamond2).toBeInTheDocument();
        expect(diamond3).toBeInTheDocument();
        expect(diamond4).toBeInTheDocument();

        expect(diamond1.className).toContain('cursor-grab');
        expect(diamond1.className).toContain('active:cursor-grabbing');
        expect(diamond1.className).toContain('bg-blue-400'); // easeIn
        expect(diamond2.className).toContain('bg-purple-400'); // easeInOut
        expect(diamond3.className).toContain('bg-green-400'); // easeOut
        expect(diamond4.className).toContain('bg-yellow-400'); // linear
    });

    it('stops event propagation on diamond mousedown so clip dragging is not triggered', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');
        fireEvent.pointerDown(diamond, { clientX: 100 });

        // Clip-level dragStart should NOT be called
        expect(mockDragStart).not.toHaveBeenCalled();
    });

    it('treats a click without dragging (< 3px) as keyframe selection/popup trigger', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');

        // Mousedown, slight jitter < 3px, mouseup, click
        fireEvent.pointerDown(diamond, { clientX: 100 });
        fireEvent.pointerMove(window, { clientX: 101 });
        fireEvent.pointerUp(window, { clientX: 101 });
        fireEvent.click(diamond);

        expect(mockMoveKeyframe).not.toHaveBeenCalled();
        expect(mockKeyframeClick).toHaveBeenCalledTimes(1);
        expect(mockKeyframeClick).toHaveBeenCalledWith(
            expect.anything(),
            'clip-test-1',
            'opacity',
            10,
            'easeIn'
        );
    });

    it('drags keyframe to a new frame and calls moveKeyframe on drop', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');

        // Initial frame is 10. PIXELS_PER_FRAME = 2, zoom = 1 -> pxPerFrame = 2.
        // Dragging right by +40px: deltaFrames = 40 / 2 = +20 frames. New frame = 30.
        fireEvent.pointerDown(diamond, { clientX: 100 });
        act(() => {
            fireEvent.pointerMove(window, { clientX: 140 });
        });

        // While dragging, cursor changes to active grabbing
        expect(diamond.className).toContain('cursor-grabbing');

        act(() => {
            fireEvent.pointerUp(window, { clientX: 140 });
        });

        expect(mockMoveKeyframe).toHaveBeenCalledTimes(1);
        expect(mockMoveKeyframe).toHaveBeenCalledWith('clip-test-1', 'opacity', 10, 30);

        // Clicking right after drag should NOT trigger keyframe edit dialog
        fireEvent.click(diamond);
        expect(mockKeyframeClick).not.toHaveBeenCalled();
    });

    it('clamps dragged keyframe within [0, clip.durationInFrames] range', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');

        // Drag far left: startFrame 10, clientX from 100 to -500 (deltaX = -600 -> deltaFrames = -300)
        fireEvent.pointerDown(diamond, { clientX: 100 });
        act(() => {
            fireEvent.pointerMove(window, { clientX: -500 });
        });
        act(() => {
            fireEvent.pointerUp(window, { clientX: -500 });
        });

        // Clamped to 0
        expect(mockMoveKeyframe).toHaveBeenCalledWith('clip-test-1', 'opacity', 10, 0);

        // Drag far right: startFrame 10, clientX from 100 to 1000 (deltaX = 900 -> deltaFrames = 450)
        fireEvent.pointerDown(diamond, { clientX: 100 });
        act(() => {
            fireEvent.pointerMove(window, { clientX: 1000 });
        });
        act(() => {
            fireEvent.pointerUp(window, { clientX: 1000 });
        });

        // Clamped to clip.durationInFrames (100)
        expect(mockMoveKeyframe).toHaveBeenCalledWith('clip-test-1', 'opacity', 10, 100);
    });

    it('falls back to useVideoEditorStore.getState().moveKeyframe if onMoveKeyframe prop is omitted', () => {
        const propsWithoutCallback: TimelineClipProps = {
            ...defaultProps,
            onMoveKeyframe: undefined,
        };
        render(<TimelineClip {...propsWithoutCallback} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-50');

        // Drag from 50: startX = 200, move to 220 -> deltaX = +20px -> deltaFrames = +10 -> frame = 60
        fireEvent.pointerDown(diamond, { clientX: 200 });
        act(() => {
            fireEvent.pointerMove(window, { clientX: 220 });
        });
        act(() => {
            fireEvent.pointerUp(window, { clientX: 220 });
        });

        expect(mockMoveKeyframe).toHaveBeenCalledWith('clip-test-1', 'opacity', 50, 60);
    });

    it('cancels drag without moving keyframe when Escape key is pressed', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');

        fireEvent.pointerDown(diamond, { clientX: 100 });
        act(() => {
            fireEvent.pointerMove(window, { clientX: 160 });
        });

        // Press Escape
        act(() => {
            fireEvent.keyDown(window, { key: 'Escape' });
        });

        act(() => {
            fireEvent.pointerUp(window, { clientX: 160 });
        });

        expect(mockMoveKeyframe).not.toHaveBeenCalled();
    });

    it('does not allow dragging keyframes when isLocked is true', () => {
        render(<TimelineClip {...defaultProps} isLocked={true} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-opacity-10');

        fireEvent.pointerDown(diamond, { clientX: 100 });
        act(() => {
            fireEvent.pointerMove(window, { clientX: 160 });
        });
        act(() => {
            fireEvent.pointerUp(window, { clientX: 160 });
        });

        expect(mockMoveKeyframe).not.toHaveBeenCalled();
    });

    it('handles right click contextmenu with stopPropagation and preventDefault', () => {
        render(<TimelineClip {...defaultProps} />);

        const diamond = screen.getByTestId('keyframe-diamond-clip-test-1-scale-20');
        fireEvent.contextMenu(diamond);

        expect(mockKeyframeClick).toHaveBeenCalledTimes(1);
        expect(mockKeyframeClick).toHaveBeenCalledWith(
            expect.anything(),
            'clip-test-1',
            'scale',
            20,
            'easeOut'
        );
    });

    describe('NLE Interactive Timeline Tools', () => {
        it('renders razor cutline and badge on hover when activeTool is razor', () => {
            const mockState = {
                timelineZoom: 1,
                project: { fps: 30 },
                activeTool: 'razor',
                moveKeyframe: mockMoveKeyframe,
                splitClip: mockSplitClip,
            };
            (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => selector(mockState));
            (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue(mockState);

            const { container } = render(<TimelineClip {...defaultProps} />);
            const clipEl = container.querySelector('.group\\/clip') as HTMLElement;
            expect(clipEl).toBeTruthy();
            expect(clipEl.className).toContain('cursor-crosshair');

            // Mock getBoundingClientRect
            vi.spyOn(clipEl, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0,
                right: 300,
                bottom: 64,
                width: 200,
                height: 64,
                x: 100,
                y: 0,
                toJSON: () => {},
            });

            // Hover over middle of clip: clientX = 150 (offset = 50px, pxPerFrame = 2 -> frame = 25)
            fireEvent.pointerMove(clipEl, { clientX: 150 });

            const cutline = screen.getByTestId('razor-cutline-clip-test-1');
            const badge = screen.getByTestId('razor-cut-badge-clip-test-1');
            expect(cutline).toBeInTheDocument();
            expect(badge).toBeInTheDocument();
            expect(badge.textContent).toContain('f25');
        });

        it('splits clip at hover frame when clicked with razor tool active', () => {
            const mockState = {
                timelineZoom: 1,
                project: { fps: 30 },
                activeTool: 'razor',
                moveKeyframe: mockMoveKeyframe,
                splitClip: mockSplitClip,
            };
            (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => selector(mockState));
            (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue(mockState);

            const { container } = render(<TimelineClip {...defaultProps} />);
            const clipEl = container.querySelector('.group\\/clip') as HTMLElement;

            vi.spyOn(clipEl, 'getBoundingClientRect').mockReturnValue({
                left: 100,
                top: 0,
                right: 300,
                bottom: 64,
                width: 200,
                height: 64,
                x: 100,
                y: 0,
                toJSON: () => {},
            });

            // Move to frame 25
            fireEvent.pointerMove(clipEl, { clientX: 150 });
            // Click to split
            fireEvent.pointerDown(clipEl, { clientX: 150 });

            expect(mockSplitClip).toHaveBeenCalledWith('clip-test-1', 25);
            expect(mockDragStart).not.toHaveBeenCalled();
        });

        it('initiates slip drag when dragging clip body with slip tool active', () => {
            const mockState = {
                timelineZoom: 1,
                project: { fps: 30 },
                activeTool: 'slip',
                moveKeyframe: mockMoveKeyframe,
                splitClip: mockSplitClip,
            };
            (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => selector(mockState));
            (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue(mockState);

            const { container } = render(<TimelineClip {...defaultProps} />);
            const clipEl = container.querySelector('.group\\/clip') as HTMLElement;
            expect(clipEl.className).toContain('cursor-ew-resize');

            fireEvent.pointerDown(clipEl, { clientX: 120 });
            expect(mockDragStart).toHaveBeenCalledWith(expect.anything(), mockClip, 'slip');
        });

        it('initiates ripple trim drags when activeTool is ripple', () => {
            const mockState = {
                timelineZoom: 1,
                project: { fps: 30 },
                activeTool: 'ripple',
                moveKeyframe: mockMoveKeyframe,
                splitClip: mockSplitClip,
            };
            (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => selector(mockState));
            (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue(mockState);

            render(<TimelineClip {...defaultProps} />);

            const leftTrim = screen.getByTestId('clip-trim-left-clip-test-1');
            const rightTrim = screen.getByTestId('clip-trim-right-clip-test-1');

            expect(leftTrim.className).toContain('bg-amber-400');
            expect(rightTrim.className).toContain('bg-amber-400');

            fireEvent.pointerDown(leftTrim, { clientX: 0 });
            expect(mockDragStart).toHaveBeenCalledWith(expect.anything(), mockClip, 'ripple-left');

            fireEvent.pointerDown(rightTrim, { clientX: 200 });
            expect(mockDragStart).toHaveBeenCalledWith(expect.anything(), mockClip, 'ripple-right');
        });
    });
});
