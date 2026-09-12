import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { TimelineTrack, TimelineTrackProps } from './TimelineTrack';
import { VideoTrack, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';

vi.mock('../../store/videoEditorStore', () => ({
    useVideoEditorStore: Object.assign(vi.fn(), {
        getState: vi.fn(),
    }),
}));

describe('TimelineTrack', () => {
    const mockToggleMuteTrack = vi.fn();
    const mockToggleSoloTrack = vi.fn();
    const mockToggleHideTrack = vi.fn();
    const mockToggleLockTrack = vi.fn();
    const mockMoveTrack = vi.fn();
    const mockRemoveTrack = vi.fn();
    const mockAddSampleClip = vi.fn();
    const mockToggleExpand = vi.fn();
    const mockRemoveClip = vi.fn();
    const mockDragStart = vi.fn();
    const mockAddKeyframe = vi.fn();
    const mockKeyframeClick = vi.fn();

    const mockTrack: VideoTrack = {
        id: 'track-1',
        name: 'Video Track 1',
        type: 'video',
        isMuted: false,
        isSolo: false,
        isHidden: false,
        isLocked: false,
    };

    const mockClip: VideoClip = {
        id: 'clip-1',
        trackId: 'track-1',
        type: 'video',
        name: 'Test Clip',
        startFrame: 0,
        durationInFrames: 60,
        opacity: 1,
        scale: 1,
        x: 0,
        y: 0,
        keyframes: {},
    };

    const defaultProps: TimelineTrackProps = {
        track: mockTrack,
        clips: [mockClip],
        selectedClipId: null,
        expandedClipIds: new Set<string>(),
        onRemoveTrack: mockRemoveTrack,
        onAddSampleClip: mockAddSampleClip,
        onToggleMuteTrack: mockToggleMuteTrack,
        onToggleSoloTrack: mockToggleSoloTrack,
        onToggleHideTrack: mockToggleHideTrack,
        onToggleLockTrack: mockToggleLockTrack,
        onToggleExpand: mockToggleExpand,
        onRemoveClip: mockRemoveClip,
        onDragStart: mockDragStart,
        onAddKeyframe: mockAddKeyframe,
        onKeyframeClick: mockKeyframeClick,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        const mockStoreState = {
            timelineZoom: 1,
            project: { fps: 30 },
            toggleMuteTrack: mockToggleMuteTrack,
            toggleSoloTrack: mockToggleSoloTrack,
            toggleLockTrack: mockToggleLockTrack,
            addClip: vi.fn(),
        };
        (useVideoEditorStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });
        (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue(mockStoreState);
    });

    describe('Feature 19: Interactive Track Headers', () => {
        it('renders Mute, Solo, and Lock buttons with data-testid attributes', () => {
            render(<TimelineTrack {...defaultProps} />);

            expect(screen.getByTestId(`track-mute-${mockTrack.id}`)).toBeInTheDocument();
            expect(screen.getByTestId(`track-solo-${mockTrack.id}`)).toBeInTheDocument();
            expect(screen.getByTestId(`track-hide-${mockTrack.id}`)).toBeInTheDocument();
            expect(screen.getByTestId(`track-lock-${mockTrack.id}`)).toBeInTheDocument();
        });

        it('triggers onToggleHideTrack when Hide button is clicked', () => {
            render(<TimelineTrack {...defaultProps} />);

            const hideBtn = screen.getByTestId(`track-hide-${mockTrack.id}`);
            fireEvent.click(hideBtn);

            expect(mockToggleHideTrack).toHaveBeenCalledWith('track-1');
        });

        it('reflects hidden state with active styling', () => {
            const hiddenTrack = { ...mockTrack, isHidden: true };
            render(<TimelineTrack {...defaultProps} track={hiddenTrack} />);

            const hideBtn = screen.getByTestId(`track-hide-${mockTrack.id}`);
            expect(hideBtn).toHaveAttribute('aria-pressed', 'true');
        });

        it('triggers onToggleMuteTrack when Mute button is clicked', () => {
            render(<TimelineTrack {...defaultProps} />);

            const muteBtn = screen.getByTestId(`track-mute-${mockTrack.id}`);
            fireEvent.click(muteBtn);

            expect(mockToggleMuteTrack).toHaveBeenCalledWith('track-1');
        });

        it('reflects muted state with active styling and dimmed track lane', () => {
            const mutedTrack = { ...mockTrack, isMuted: true };
            render(<TimelineTrack {...defaultProps} track={mutedTrack} />);

            const muteBtn = screen.getByTestId(`track-mute-${mockTrack.id}`);
            expect(muteBtn.className).toContain('text-red-400');
            expect(muteBtn).toHaveAttribute('aria-pressed', 'true');

            const dropZone = screen.getByTestId(`track-drop-zone-${mockTrack.id}`);
            expect(dropZone.className).toContain('opacity-60');
        });

        it('triggers onToggleSoloTrack when Solo button is clicked', () => {
            render(<TimelineTrack {...defaultProps} />);

            const soloBtn = screen.getByTestId(`track-solo-${mockTrack.id}`);
            fireEvent.click(soloBtn);

            expect(mockToggleSoloTrack).toHaveBeenCalledWith('track-1');
        });

        it('reflects solo state with active styling', () => {
            const soloTrack = { ...mockTrack, isSolo: true };
            render(<TimelineTrack {...defaultProps} track={soloTrack} />);

            const soloBtn = screen.getByTestId(`track-solo-${mockTrack.id}`);
            expect(soloBtn.className).toContain('text-yellow-400');
            expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
        });

        it('triggers onToggleLockTrack when Lock button is clicked', () => {
            render(<TimelineTrack {...defaultProps} />);

            const lockBtn = screen.getByTestId(`track-lock-${mockTrack.id}`);
            fireEvent.click(lockBtn);

            expect(mockToggleLockTrack).toHaveBeenCalledWith('track-1');
        });

        it('reflects locked state with visual indicator, disabled sample buttons, and disabled pointer on clips', () => {
            const lockedTrack = { ...mockTrack, isLocked: true };
            render(<TimelineTrack {...defaultProps} track={lockedTrack} />);

            const lockBtn = screen.getByTestId(`track-lock-${mockTrack.id}`);
            expect(lockBtn.className).toContain('text-amber-400');
            expect(lockBtn).toHaveAttribute('aria-pressed', 'true');

            // Locked indicator should be visible
            expect(screen.getByTestId(`track-locked-indicator-${mockTrack.id}`)).toBeInTheDocument();

            // Sample clip buttons must be disabled
            const addTxtBtn = screen.getByTestId(`track-add-text-${mockTrack.id}`);
            const addVidBtn = screen.getByTestId(`track-add-video-${mockTrack.id}`);
            const addAudBtn = screen.getByTestId(`track-add-audio-${mockTrack.id}`);
            const deleteBtn = screen.getByTestId(`track-delete-${mockTrack.id}`);

            expect(addTxtBtn).toBeDisabled();
            expect(addVidBtn).toBeDisabled();
            expect(addAudBtn).toBeDisabled();
            expect(deleteBtn).toBeDisabled();

            // Clicking disabled sample buttons should not invoke onAddSampleClip
            fireEvent.click(addTxtBtn);
            expect(mockAddSampleClip).not.toHaveBeenCalled();

            // Clip element inside locked track should have pointer-events disabled
            const clipEl = screen.getByText('Test Clip').closest('[class*="pointer-events-none"]');
            expect(clipEl).toBeInTheDocument();
        });

        it('falls back to useVideoEditorStore actions when callbacks are not provided', () => {
            const storeMute = vi.fn();
            const storeSolo = vi.fn();
            const storeLock = vi.fn();

            (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue({
                timelineZoom: 1,
                project: { fps: 30 },
                toggleMuteTrack: storeMute,
                toggleSoloTrack: storeSolo,
                toggleLockTrack: storeLock,
            });

            const propsWithoutCallbacks = {
                ...defaultProps,
                onToggleMuteTrack: undefined,
                onToggleSoloTrack: undefined,
                onToggleLockTrack: undefined,
            };

            render(<TimelineTrack {...propsWithoutCallbacks} />);

            fireEvent.click(screen.getByTestId(`track-mute-${mockTrack.id}`));
            expect(storeMute).toHaveBeenCalledWith('track-1');

            fireEvent.click(screen.getByTestId(`track-solo-${mockTrack.id}`));
            expect(storeSolo).toHaveBeenCalledWith('track-1');

            fireEvent.click(screen.getByTestId(`track-lock-${mockTrack.id}`));
            expect(storeLock).toHaveBeenCalledWith('track-1');
        });
    });

    describe('Feature 20: Dynamic Track Height for Keyframes', () => {
        it('uses fixed h-16 and overflow-hidden when no clips are expanded', () => {
            render(<TimelineTrack {...defaultProps} expandedClipIds={new Set()} />);

            const dropZone = screen.getByTestId(`track-drop-zone-${mockTrack.id}`);
            expect(dropZone.className).toContain('overflow-hidden');
            expect(dropZone.className).not.toContain('overflow-visible');
        });

        it('removes h-16 and enables dynamic height with overflow-visible when a clip is expanded', () => {
            const expandedSet = new Set(['clip-1']);
            render(<TimelineTrack {...defaultProps} expandedClipIds={expandedSet} />);

            const dropZone = screen.getByTestId(`track-drop-zone-${mockTrack.id}`);
            expect(dropZone.className).toContain('overflow-visible');
            expect(dropZone.className).toContain('h-auto');
            expect(dropZone.className).toContain('min-h-');
            expect(dropZone.className).not.toContain('overflow-hidden');
        });
    });

    describe('Track Reorder Controls', () => {
        it('calls onMoveTrack with the adjacent index when reorder buttons are clicked', () => {
            render(<TimelineTrack {...defaultProps} trackIndex={1} trackCount={3} onMoveTrack={mockMoveTrack} />);

            fireEvent.click(screen.getByTestId(`track-move-up-${mockTrack.id}`));
            expect(mockMoveTrack).toHaveBeenCalledWith('track-1', 0);

            fireEvent.click(screen.getByTestId(`track-move-down-${mockTrack.id}`));
            expect(mockMoveTrack).toHaveBeenCalledWith('track-1', 2);
        });

        it('disables move-up on the first track and move-down on the last track', () => {
            const { rerender } = render(<TimelineTrack {...defaultProps} trackIndex={0} trackCount={3} onMoveTrack={mockMoveTrack} />);
            expect(screen.getByTestId(`track-move-up-${mockTrack.id}`)).toBeDisabled();
            expect(screen.getByTestId(`track-move-down-${mockTrack.id}`)).not.toBeDisabled();

            rerender(<TimelineTrack {...defaultProps} trackIndex={2} trackCount={3} onMoveTrack={mockMoveTrack} />);
            expect(screen.getByTestId(`track-move-up-${mockTrack.id}`)).not.toBeDisabled();
            expect(screen.getByTestId(`track-move-down-${mockTrack.id}`)).toBeDisabled();
        });

        it('disables reorder controls on locked tracks', () => {
            const lockedTrack = { ...mockTrack, isLocked: true };
            render(<TimelineTrack {...defaultProps} track={lockedTrack} trackIndex={1} trackCount={3} onMoveTrack={mockMoveTrack} />);

            expect(screen.getByTestId(`track-move-up-${mockTrack.id}`)).toBeDisabled();
            expect(screen.getByTestId(`track-move-down-${mockTrack.id}`)).toBeDisabled();
            fireEvent.click(screen.getByTestId(`track-move-up-${mockTrack.id}`));
            expect(mockMoveTrack).not.toHaveBeenCalled();
        });

        it('falls back to the store moveTrack action when no callback is provided', () => {
            const storeMove = vi.fn();
            (useVideoEditorStore.getState as unknown as import('vitest').Mock).mockReturnValue({
                timelineZoom: 1,
                project: { fps: 30 },
                moveTrack: storeMove,
            });

            render(<TimelineTrack {...defaultProps} trackIndex={2} trackCount={3} onMoveTrack={undefined} />);
            fireEvent.click(screen.getByTestId(`track-move-up-${mockTrack.id}`));
            expect(storeMove).toHaveBeenCalledWith('track-1', 1);
        });
    });
});
