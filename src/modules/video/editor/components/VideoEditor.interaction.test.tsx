import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { VideoEditor } from '../VideoEditor';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { useToast } from '@/core/context/ToastContext';
import { httpsCallable } from 'firebase/functions';

// Mock dependencies
vi.mock('../store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
    VideoProject: {},
    VideoClip: {}
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
    getFunctions: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

// Mock complex sub-components to focus on integration logic
vi.mock('../components/VideoPreview', () => ({
    VideoPreview: () => <div data-testid="video-preview" />
}));

vi.mock('../components/VideoPropertiesPanel', () => ({
    VideoPropertiesPanel: () => <div data-testid="video-properties-panel" />
}));

// We keep VideoTimeline and Sidebar real if possible, or mock them if they are too complex.
// For now, let's mock them but make them interactive enough for our test.
// Actually, let's mock them to ensure we are testing the orchestrator (VideoEditor + useVideoEditor),
// and trust unit tests for the leaf components.
vi.mock('../components/VideoTimeline', () => ({
    VideoTimeline: ({ handlePlayPause, handleAddTrack, handleAddSampleClip }: any) => (
        <div data-testid="video-timeline">
            <button data-testid="play-pause-btn" onClick={handlePlayPause}>Play/Pause</button>
            <button data-testid="add-track-btn" onClick={handleAddTrack}>Add Track</button>
            <button data-testid="add-sample-btn" onClick={() => handleAddSampleClip('t1', 'text')}>Add Sample</button>
        </div>
    )
}));

vi.mock('../components/VideoEditorSidebar', () => ({
    VideoEditorSidebar: ({ onLibraryDragStart }: any) => (
        <div data-testid="video-editor-sidebar">
            <div
                data-testid="draggable-asset"
                draggable
                onDragStart={(e) => onLibraryDragStart(e, { id: 'asset1', type: 'video', url: 'vid.mp4' })}
            >
                Asset 1
            </div>
        </div>
    )
}));

describe('VideoEditor Integration', () => {
    const mockSetProject = vi.fn();
    const mockUpdateClip = vi.fn();
    const mockAddClip = vi.fn();
    const mockRemoveClip = vi.fn();
    const mockAddTrack = vi.fn();
    const mockRemoveTrack = vi.fn();
    const mockSetIsPlaying = vi.fn();
    const mockSetCurrentTime = vi.fn();
    const mockSetSelectedClipId = vi.fn();

    const mockToast = {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn()
    };

    const mockProject = {
        id: 'proj1',
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 300,
        tracks: [{ id: 't1', name: 'Track 1' }],
        clips: []
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue(mockToast);

        (useVideoEditorStore as any).mockReturnValue({
            project: mockProject,
            setProject: mockSetProject,
            updateClip: mockUpdateClip,
            addClip: mockAddClip,
            removeClip: mockRemoveClip,
            addTrack: mockAddTrack,
            removeTrack: mockRemoveTrack,
            setIsPlaying: mockSetIsPlaying,
            setCurrentTime: mockSetCurrentTime,
            setSelectedClipId: mockSetSelectedClipId,
            isPlaying: false,
            currentTime: 0
        });

        (httpsCallable as any).mockReturnValue(vi.fn().mockResolvedValue({
            data: { success: true, renderId: 'r1' }
        }));
    });

    it('manages playback state', () => {
        render(<VideoEditor />);

        const playBtn = screen.getByTestId('play-pause-btn');
        fireEvent.click(playBtn);

        expect(mockSetIsPlaying).toHaveBeenCalledWith(true);
    });

    it('adds a track', () => {
        render(<VideoEditor />);

        const addTrackBtn = screen.getByTestId('add-track-btn');
        fireEvent.click(addTrackBtn);

        expect(mockAddTrack).toHaveBeenCalledWith('video');
    });

    it('adds a sample clip', () => {
        render(<VideoEditor />);

        const addSampleBtn = screen.getByTestId('add-sample-btn');
        fireEvent.click(addSampleBtn);

        expect(mockAddClip).toHaveBeenCalledWith(expect.objectContaining({ type: 'text' }));
    });

    it('handles export flow', async () => {
        render(<VideoEditor />);

        const exportBtn = screen.getByTestId('video-export-btn');
        fireEvent.click(exportBtn);

        expect(mockToast.info).toHaveBeenCalledWith(expect.stringContaining('Starting cloud export'));

        await waitFor(() => {
            expect(httpsCallable).toHaveBeenCalled();
            expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Cloud render started'));
        });
    });

    it('handles drag and drop from library', () => {
        render(<VideoEditor />);

        // 1. Start Drag on Sidebar Item
        const asset = screen.getByTestId('draggable-asset');
        const dataTransfer = { setData: vi.fn(), getData: vi.fn(), dropEffect: 'none' };

        // Mock getData to return what setData set (simplified)
        dataTransfer.getData.mockReturnValue(JSON.stringify({ id: 'asset1', type: 'video', url: 'vid.mp4' }));

        fireEvent.dragStart(asset, { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith('application/json', expect.stringContaining('asset1'));

        // 2. Drop on Timeline Container (VideoEditor has the drop handler on the bottom div)
        // We need to target the container that has onDrop.
        // In VideoEditor.tsx, it's the div wrapping VideoTimeline.
        // We can find it by its class or structure, or add a testid to it in the source if needed.
        // For now, let's try to find it by generic queries or structure.
        // It's the parent of video-timeline.
        const timelineWrapper = screen.getByTestId('video-timeline').parentElement;

        fireEvent.drop(timelineWrapper!, {
            dataTransfer,
            clientX: 100, // Simulate drop at x=100
            currentTarget: { getBoundingClientRect: () => ({ left: 0 }) }
        });

        expect(mockAddClip).toHaveBeenCalledWith(expect.objectContaining({
            src: 'vid.mp4',
            type: 'video'
        }));
        expect(mockToast.success).toHaveBeenCalledWith('Asset added to timeline');
    });
});
