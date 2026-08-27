import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { VideoEditor } from '../VideoEditor';
import { useVideoEditorStore } from '../../store/videoEditorStore';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { httpsCallable } from 'firebase/functions';

// Mock dependencies
vi.mock('../../store/videoEditorStore', () => {
    const mockStore = vi.fn();
    (mockStore as any).subscribe = vi.fn(() => () => { });
    // getState() must reflect whatever mockImplementation the test's beforeEach
    // configures (via mockStore() with no selector), not a separate hardcoded
    // stub — otherwise store actions read through getState() (as
    // useVideoProjectPersistence does) throw "not a function" against fields
    // that only exist on the real mockState object.
    (mockStore as any).getState = () => mockStore();
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
                onDragStart={(e) => onLibraryDragStart(e, { id: 'asset1', type: 'video', url: 'https://example.com/vid.mp4' })}
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
    const mockSetPreviewArtifactUrl = vi.fn();
    const mockAddToHistory = vi.fn();

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
        clips: [{
            id: 'server-video-1',
            type: 'video',
            src: 'https://preview.example/clip.mp4',
            canonicalSourceUri: 'gs://indii-music-founder.firebasestorage.app/creative/test-user/outputs/clip.mp4',
            startFrame: 0,
            durationInFrames: 300,
            trackId: 't1',
            name: 'Canonical video',
        }]
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as unknown as import("vitest").Mock).mockReturnValue(mockToast);
        useStore.getState().addToHistory = mockAddToHistory;

        const mockState = {
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
            setPreviewArtifactUrl: mockSetPreviewArtifactUrl,
            isPlaying: false,
            currentTime: 0,
            isPopoutActive: false,
            isLoadingProject: false,
            setIsLoadingProject: vi.fn(),
            resetProjectForId: vi.fn(),
            loadProjectFromDoc: vi.fn(),
            past: [],
            future: [],
            undo: vi.fn(),
            redo: vi.fn(),
            timelineZoom: 1,
            setTimelineZoom: vi.fn(),
        };
        // A selector-based mock (not mockReturnValue) so `useVideoEditorStore(state
        // => state.someField)` actually reads that field, matching real Zustand
        // selector semantics — mockReturnValue would return the whole fixed
        // object regardless of the selector passed in, which broke ISSUE-1147's
        // `isLoadingProject` gate (it was always a truthy object).
        (useVideoEditorStore as unknown as import("vitest").Mock).mockImplementation(
            (selector?: (s: typeof mockState) => unknown) => (selector ? selector(mockState) : mockState)
        );

        // Route by callable name rather than a shared call-order queue: a single
        // FIFO of .mockResolvedValueOnce() entries is consumed by ANY call through
        // httpsCallable, regardless of which endpoint name requested it, so it
        // silently desyncs the moment the two endpoints aren't invoked in the
        // exact order assumed here (e.g. a poll iteration reads receipt.status
        // from the queue endpoint's own payload instead of the receipt endpoint's).
        (httpsCallable as import("vitest").Mock).mockImplementation((_functions: unknown, name: string) => {
            if (name === 'getVideoRenderReceipt') {
                return vi.fn().mockResolvedValue({
                    data: {
                        status: 'completed',
                        renderId: 'r1',
                        projectId: 'proj1',
                        progress: 100,
                        asset: {
                            url: 'https://storage.example/private-render.mp4',
                            expiresAt: Date.now() + 60_000,
                            generation: '1',
                            mimeType: 'video/mp4',
                        },
                    },
                });
            }
            return vi.fn().mockResolvedValue({ data: { success: true, renderId: 'r1' } });
        });
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
            expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Cloud render complete'));
            expect(mockToast.error).not.toHaveBeenCalled();
            expect(mockSetPreviewArtifactUrl).toHaveBeenCalledWith('https://storage.example/private-render.mp4');
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                id: 'export_r1',
                url: 'https://storage.example/private-render.mp4',
                projectId: 'proj1',
            }));
        });
    });

    it('handles drag and drop from library', async () => {
        render(<VideoEditor />);

        // 1. Start Drag on Sidebar Item
        const asset = screen.getByTestId('draggable-asset');
        const dataTransfer = { setData: vi.fn(), getData: vi.fn(), dropEffect: 'none' };

        fireEvent.dragStart(asset, { dataTransfer });

        // The handler uses writeCreativeAssetDrag, which sets multiple formats
        expect(dataTransfer.setData).toHaveBeenCalledWith(
            'application/x-indii-creative-asset+json',
            JSON.stringify({
                version: 1,
                kind: 'creative-asset',
                source: 'editor-library',
                asset: { id: 'asset1', type: 'video', url: 'https://example.com/vid.mp4', name: 'Untitled video', prompt: '' }
            })
        );

        // Mock getData to return exactly what setData produced, so the drop
        // handler parses the real serialized contract, not a stale fixture.
        dataTransfer.getData.mockImplementation((format: string) => {
            if (format === 'application/x-indii-creative-asset+json') {
                return JSON.stringify({
                    version: 1,
                    kind: 'creative-asset',
                    source: 'editor-library',
                    asset: { id: 'asset1', type: 'video', url: 'https://example.com/vid.mp4', name: 'Untitled video', prompt: '' }
                });
            }
            return '';
        });

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
                src: 'https://example.com/vid.mp4',
                type: 'video'
            }));
        });
        expect(mockToast.success).toHaveBeenCalledWith('Asset added to timeline');
    });
});
