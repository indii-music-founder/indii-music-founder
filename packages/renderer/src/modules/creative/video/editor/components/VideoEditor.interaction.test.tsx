import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { VideoEditor } from '../VideoEditor';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { useToast } from '@/core/context/ToastContext';
import { httpsCallable } from 'firebase/functions';

// Mock dependencies
vi.mock('../../store/videoEditorStore', () => {
    const mockStore = vi.fn();
    (mockStore as any).subscribe = vi.fn(() => () => { });
    (mockStore as any).getState = vi.fn(() => ({ isPlaying: false, currentTime: 0 }));
    return {
        useVideoEditorStore: mockStore,
        VideoProject: {},
        VideoClip: {}
    };
});

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
    getFunctions: vi.fn()
}));

vi.mock('../utils/mediaMetadata', () => ({
    resolveMediaDurationSeconds: vi.fn().mockResolvedValue(10),
    getMediaDurationFromFile: vi.fn().mockResolvedValue(0),
    durationSecondsToFrames: (durationSeconds: number, fps: number, fallback = 150) =>
        durationSeconds > 0 ? Math.round(durationSeconds * fps) : fallback,
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
    functionsWest1: {},
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' }, onAuthStateChanged: vi.fn(), signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn() },
    storage: {},
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock complex sub-components to focus on integration logic
vi.mock('./VideoPreview', () => ({
    VideoPreview: () => <div data-testid="video-preview" />
}));

vi.mock('./VideoPropertiesPanel', () => ({
    VideoPropertiesPanel: () => <div data-testid="video-properties-panel" />
}));

// We keep VideoTimeline and Sidebar real if possible, or mock them if they are too complex.
// For now, let's mock them but make them interactive enough for our test.
vi.mock('./VideoTimeline', () => ({
    VideoTimeline: ({ handlePlayPause, handleAddTrack, handleAddSampleClip }: any) => (
        <div data-testid="video-timeline">
            <button data-testid="play-pause-btn" onClick={handlePlayPause}>Play/Pause</button>
            <button data-testid="add-track-btn" onClick={handleAddTrack}>Add Track</button>
            <button data-testid="add-sample-btn" onClick={() => handleAddSampleClip('t1', 'text')}>Add Sample</button>
        </div>
    )
}));

vi.mock('./VideoEditorSidebar', () => ({
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

        (useToast as unknown as import("vitest").Mock).mockReturnValue(mockToast);

        (useVideoEditorStore as unknown as import("vitest").Mock).mockReturnValue({
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

        (httpsCallable as import("vitest").Mock).mockReturnValue(vi.fn().mockResolvedValue({
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

    it('handles drag and drop from library', async () => {
        render(<VideoEditor />);

        // 1. Start Drag on Sidebar Item
        const asset = screen.getByTestId('draggable-asset');
        const dataTransfer = { setData: vi.fn(), getData: vi.fn(), dropEffect: 'none' };

        fireEvent.dragStart(asset, { dataTransfer });

        // The real handler serializes a typed { type: 'asset', asset: {...} }
        // payload (no raw `id`) so drop targets can validate/route it — see ISSUE-927.
        expect(dataTransfer.setData).toHaveBeenCalledWith(
            'application/json',
            JSON.stringify({ type: 'asset', asset: { type: 'video', name: 'Imported video', url: 'vid.mp4' } })
        );

        // Mock getData to return exactly what setData produced, so the drop
        // handler parses the real serialized contract, not a stale fixture.
        const [, serializedPayload] = dataTransfer.setData.mock.calls[0]!;
        dataTransfer.getData.mockReturnValue(serializedPayload);

        // 2. Drop on Timeline Container (VideoEditor has the drop handler on the bottom div)
        const timelineWrapper = screen.getByTestId('video-timeline').parentElement;

        fireEvent.drop(timelineWrapper!, {
            dataTransfer,
            clientX: 100, // Simulate drop at x=100
            currentTarget: { getBoundingClientRect: () => ({ left: 0 }) }
        });

        // handleDrop resolves duration asynchronously before calling addClip.
        await waitFor(() => {
            expect(mockAddClip).toHaveBeenCalledWith(expect.objectContaining({
                src: 'vid.mp4',
                type: 'video'
            }));
        });
        expect(mockToast.success).toHaveBeenCalledWith('Asset added to timeline');
    });
});
