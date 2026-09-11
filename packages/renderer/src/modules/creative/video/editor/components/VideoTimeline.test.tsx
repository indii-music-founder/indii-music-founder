import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTimeline } from './VideoTimeline';
import { useVideoEditorStore } from '../../store/videoEditorStore';

// Mock store
vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

describe('VideoTimeline', () => {
    const mockAddKeyframe = vi.fn();
    const mockRemoveKeyframe = vi.fn();
    const mockUpdateKeyframe = vi.fn();

    const mockProject = {
        id: 'p1',
        name: 'Test Project',
        fps: 30,
        durationInFrames: 300,
        width: 1920,
        height: 1080,
        tracks: [
            { id: 't1', name: 'Track 1', type: 'video' as const }
        ],
        clips: [
            {
                id: 'c1',
                type: 'video' as const,
                startFrame: 0,
                durationInFrames: 100,
                trackId: 't1',
                name: 'Clip 1',
                keyframes: {}
            }
        ]
    };

    const defaultProps = {
        project: mockProject,
        isPlaying: false,
        selectedClipId: null,
        handlePlayPause: vi.fn(),
        handleSeek: vi.fn(),
        handleAddTrack: vi.fn(),
        handleAddSampleClip: vi.fn(),
        removeTrack: vi.fn(),
        removeClip: vi.fn(),
        handleDragStart: vi.fn(),
        formatTime: (f: number) => `${f}`,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        const mockState = {
            addKeyframe: mockAddKeyframe,
            removeKeyframe: mockRemoveKeyframe,
            updateKeyframe: mockUpdateKeyframe,
            currentTime: 0,
            timelineZoom: 1,
        };

        // Mock implementation to handle both direct access and selector access
        (useVideoEditorStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
            if (selector && typeof selector === 'function') {
                try {
                    return selector(mockState);
                } catch (_e: unknown) {
                    return undefined;
                }
            }
            return mockState;
        });
        (useVideoEditorStore as unknown as import("vitest").Mock & { getState: () => typeof mockState }).getState = () => mockState;
    });

    it('renders clips', () => {
        render(<VideoTimeline {...defaultProps} />);
        expect(screen.getByText('Clip 1')).toBeInTheDocument();
    });

    it('expands clip to show keyframe editor', () => {
        render(<VideoTimeline {...defaultProps} />);

        // Find expand button (chevron)
        // It's the first button inside the clip content
        const expandBtn = screen.getByText('Clip 1').parentElement?.querySelector('button');
        fireEvent.click(expandBtn!);

        // Check if property rows are visible
        expect(screen.getByText('Scale')).toBeInTheDocument();
        expect(screen.getByText('Opacity')).toBeInTheDocument();
    });

    it('adds keyframe when clicking on property row', () => {
        render(<VideoTimeline {...defaultProps} />);

        // Expand clip
        const expandBtn = screen.getByText('Clip 1').parentElement?.querySelector('button');
        fireEvent.click(expandBtn!);

        // Find Scale row track area
        // It's the sibling of the label "Scale"
        const scaleLabel = screen.getByText('Scale');
        const trackArea = scaleLabel.nextElementSibling;

        // Click on track area
        fireEvent.click(trackArea!);

        expect(mockAddKeyframe).toHaveBeenCalledWith('c1', 'scale', expect.any(Number), 1);
    });

    it('removes keyframe when right-clicking on diamond', () => {
        const projectWithKeyframe = {
            ...mockProject,
            clips: [{
                ...mockProject.clips[0]!,
                keyframes: {
                    scale: [{ frame: 10, value: 1.5, easing: 'linear' as const }]
                }
            }]
        };

        render(<VideoTimeline {...defaultProps} project={projectWithKeyframe} />);

        // Expand clip
        const expandBtn = screen.getByText('Clip 1').parentElement?.querySelector('button');
        fireEvent.click(expandBtn!);

        // Find keyframe diamond
        const keyframe = screen.getByTitle('Scale: 1.5 @ f10 (linear)');
        fireEvent.contextMenu(keyframe);

        expect(mockRemoveKeyframe).toHaveBeenCalledWith('c1', 'scale', 10);
    });

    it('cycles easing when clicking on diamond', () => {
        const projectWithKeyframe = {
            ...mockProject,
            clips: [{
                ...mockProject.clips[0]!,
                keyframes: {
                    scale: [{ frame: 10, value: 1.5, easing: 'linear' as const }]
                }
            }]
        };

        render(<VideoTimeline {...defaultProps} project={projectWithKeyframe} />);

        // Expand clip
        const expandBtn = screen.getByText('Clip 1').parentElement?.querySelector('button');
        fireEvent.click(expandBtn!);

        // Find keyframe diamond
        const keyframe = screen.getByTitle('Scale: 1.5 @ f10 (linear)');

        // Click to cycle to easeIn
        fireEvent.click(keyframe);
        expect(mockUpdateKeyframe).toHaveBeenCalledWith('c1', 'scale', 10, { easing: 'easeIn' });
    });

    it('renders dynamic frame-accurate timecode in transport bar', () => {
        render(<VideoTimeline {...defaultProps} />);
        const timecode = screen.getByTestId('timeline-timecode');
        expect(timecode).toBeInTheDocument();
        expect(timecode).toHaveTextContent('00:00:00');
    });

    describe('magnetic snapping visual guide (Feature 16)', () => {
        it('does not render snap-guide when snapIndicatorFrame is null or undefined', () => {
            render(<VideoTimeline {...defaultProps} snapIndicatorFrame={null} />);
            expect(screen.queryByTestId('snap-guide')).toBeNull();
        });

        it('renders snap-guide at accurate horizontal position when snapIndicatorFrame is active', () => {
            // TOTAL_TRACK_HEADER_OFFSET (200px) + (frame 50 * 2 px/frame * zoom 1) = 300px
            render(<VideoTimeline {...defaultProps} snapIndicatorFrame={50} />);
            const guide = screen.getByTestId('snap-guide');
            expect(guide).toBeInTheDocument();
            expect(guide).toHaveStyle({ left: '300px' });
            expect(guide).toHaveClass('bg-yellow-400');
        });

        it('renders snap-guide accounting for timelineZoom multiplier', () => {
            const mockStateWithZoom = {
                addKeyframe: mockAddKeyframe,
                removeKeyframe: mockRemoveKeyframe,
                updateKeyframe: mockUpdateKeyframe,
                currentTime: 0,
                timelineZoom: 2, // 2x zoom -> 4px per frame
            };
            (useVideoEditorStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
                if (selector && typeof selector === 'function') {
                    try {
                        return selector(mockStateWithZoom);
                    } catch (_e: unknown) {
                        return undefined;
                    }
                }
                return mockStateWithZoom;
            });

            // 200px + (frame 25 * 2 px/frame * zoom 2) = 300px
            render(<VideoTimeline {...defaultProps} snapIndicatorFrame={25} />);
            const guide = screen.getByTestId('snap-guide');
            expect(guide).toBeInTheDocument();
            expect(guide).toHaveStyle({ left: '300px' });
        });
    });
});
