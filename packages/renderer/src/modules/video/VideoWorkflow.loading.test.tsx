
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '../../services/video/VideoGenerationService';

// --- Mocks ---

const { mockStoreStateData, mockVideoEditorState, mockUseStore, mockUseVideoEditorStore } = vi.hoisted(() => {
    const store = {
        generatedHistory: [],
        selectedItem: null,
        pendingPrompt: null,
        setPendingPrompt: vi.fn(),
        addToHistory: vi.fn(),
        updateHistoryItem: vi.fn(),
        setPrompt: vi.fn(),
        studioControls: { resolution: '1080p' },
        videoInputs: {},
        currentOrganizationId: 'org-123',
        currentProjectId: 'proj-123',
        isRightPanelOpen: false,
        toggleRightPanel: vi.fn(),
        addJob: vi.fn(),
        updateJobProgress: vi.fn(),
        updateJobStatus: vi.fn()
    };

    const editorStore = {
        viewMode: 'director',
        setViewMode: vi.fn(),
        jobId: null,
        setJobId: vi.fn(),
        status: 'idle' as const,
        setStatus: vi.fn(),
        progress: 0,
        setProgress: vi.fn(),
        inputAudio: null,
        setInputAudio: vi.fn()
    };

    const useStoreMock = Object.assign(
        vi.fn((selector) => selector ? selector(store) : store),
        {
            getState: vi.fn(() => store),
            setState: vi.fn((patch: any) => Object.assign(store, typeof patch === 'function' ? patch(store) : patch))
        }
    );

    const useVideoEditorStoreMock = Object.assign(
        vi.fn((selector) => selector ? selector(editorStore) : editorStore),
        {
            getState: vi.fn(() => editorStore),
            setState: vi.fn((patch: any) => Object.assign(editorStore, typeof patch === 'function' ? patch(editorStore) : patch))
        }
    );

    return {
        mockStoreStateData: store,
        mockVideoEditorState: editorStore,
        mockUseStore: useStoreMock,
        mockUseVideoEditorStore: useVideoEditorStoreMock
    };
});

vi.mock('@/core/store', () => ({
    useStore: mockUseStore,
    serverTimestamp: vi.fn()
}));

vi.mock('./store/videoEditorStore', () => ({
    useVideoEditorStore: mockUseVideoEditorStore
}));

// Mock Toast
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: mockToastSuccess,
        error: mockToastError,
        info: vi.fn(),
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock dependencies to prevent crash
vi.mock('../../utils/video', () => ({
    extractVideoFrame: vi.fn()
}));

// Mock VideoGenerationService
let subscribeCallback: ((data: any) => void) | null = null;
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        subscribeToJob: vi.fn((id, cb) => {
            subscribeCallback = cb;
            return vi.fn(); // unsubscribe
        }),
        generateLongFormVideo: vi.fn(),
    },
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    collection: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    remoteConfig: { defaultConfig: {} },
    functions: {},
    auth: { currentUser: { uid: 'test-user' } },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Helper to set store state for a test
const mockStoreState = (overrides: Record<string, any>) => {
    Object.assign(mockVideoEditorState, overrides);
};

describe('VideoWorkflow UI States', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        subscribeCallback = null;
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('renders the "Director\'s Chair" empty state when idle', () => {
        mockStoreState({ status: 'idle' });
        render(<VideoWorkflow />);

        // Assert empty state text
        expect(screen.getByText(/Director's Chair/i)).toBeInTheDocument();
        expect(screen.getByText(/Compose your vision above to begin/i)).toBeInTheDocument();

        // Assert loading indicators are NOT present
        expect(screen.queryByText(/Imaginating Scene/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Stitching Masterpiece/i)).not.toBeInTheDocument();
    });

    it('renders the Loading Overlay when status is "processing"', () => {
        mockStoreState({ status: 'processing', progress: 45, jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Assert loading text
        expect(screen.getByText(/Imaginating Scene.../i)).toBeInTheDocument();

        // Assert progress text
        expect(screen.getByText(/AI Director is framing the scene... \(45%\)/i)).toBeInTheDocument();
    });

    it('renders the Stitching Overlay when status is "stitching"', () => {
        mockStoreState({ status: 'stitching', progress: 99, jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Assert stitching text
        expect(screen.getByText(/Stitching Masterpiece.../i)).toBeInTheDocument();
        expect(screen.getByText(/Finalizing your unified video/i)).toBeInTheDocument();
    });

    it('renders the Queued Overlay when status is "queued"', () => {
        mockStoreState({ status: 'queued', jobId: 'job-123' });
        render(<VideoWorkflow />);

        expect(screen.getByText(/Imaginating Scene.../i)).toBeInTheDocument();
    });

    // NEW TESTS

    it('displays error toast and stops loading when job fails', () => {
        mockStoreState({ status: 'processing', jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Verify we are listening
        expect(VideoGeneration.subscribeToJob).toHaveBeenCalledWith('job-123', expect.any(Function));
        expect(subscribeCallback).toBeTruthy();

        // Simulate failure
        act(() => {
            subscribeCallback!({ status: 'failed', stitchError: 'Something went wrong' });
            vi.runOnlyPendingTimers();
        });

        // Verify Error Toast
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Stitching failed: Something went wrong'));

        // Verify Loading Reset
        expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('failed');
        expect(mockVideoEditorState.setJobId).toHaveBeenCalledWith(null);
        expect(mockVideoEditorState.setProgress).toHaveBeenCalledWith(0);
    });

    it('displays success toast, adds to history, and stops loading when job completes', () => {
        mockStoreState({ status: 'processing', jobId: 'job-123' });
        render(<VideoWorkflow />);

        // Verify we are listening
        expect(VideoGeneration.subscribeToJob).toHaveBeenCalledWith('job-123', expect.any(Function));
        expect(subscribeCallback).toBeTruthy();

        // Simulate success
        const mockVideoUrl = 'https://example.com/video.mp4';
        act(() => {
            subscribeCallback!({ status: 'completed', videoUrl: mockVideoUrl, prompt: 'Test Prompt' });
            vi.runOnlyPendingTimers();
        });

        // Verify Success Toast
        expect(mockToastSuccess).toHaveBeenCalledWith('Scene generated!');

        // Verify History Update
        expect(mockStoreStateData.addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: 'job-123',
            url: mockVideoUrl,
            prompt: 'Test Prompt',
            type: 'video'
        }));

        // Verify Loading Reset
        expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('idle');
        expect(mockVideoEditorState.setJobId).toHaveBeenCalledWith(null);
        expect(mockVideoEditorState.setProgress).toHaveBeenCalledWith(0);
    });
});
