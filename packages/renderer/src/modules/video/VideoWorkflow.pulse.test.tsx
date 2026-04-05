
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '../../services/video/VideoGenerationService';
import userEvent from '@testing-library/user-event';

// --- Mocks ---

const { mockStoreState, mockVideoEditorState, mockUseStore, mockUseVideoEditorStore } = vi.hoisted(() => {
    const store = {
        generatedHistory: [],
        selectedItem: null,
        pendingPrompt: null,
        setPendingPrompt: vi.fn(),
        addToHistory: vi.fn(),
        updateHistoryItem: vi.fn(),
        setPrompt: vi.fn(),
        studioControls: { resolution: '1080p', duration: 10, aspectRatio: '16:9' },
        videoInputs: {},
        currentOrganizationId: 'org-123',
        currentProjectId: 'proj-123',
        setVideoInputs: vi.fn(),
        whiskState: {
            subjects: [],
            scenes: [],
            styles: [],
            motion: [],
            preciseReference: false,
            targetMedia: 'video'
        },
        characterReferences: [],
        setStudioControls: vi.fn(),
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
        mockStoreState: store,
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
const mockToastInfo = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    serverTimestamp: vi.fn(),
    useToast: vi.fn(() => ({
        serverTimestamp: vi.fn(),
        success: mockToastSuccess,
        error: mockToastError,
        info: mockToastInfo,
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock VideoGenerationService
let subscribeCallback: ((data: any) => void) | null = null;
let resolveGeneratePromise: ((value: any) => void) | null = null;

vi.mock('@/services/video/VideoGenerationService', () => ({
    serverTimestamp: vi.fn(),
    VideoGeneration: {
        generateVideo: vi.fn(),
        subscribeToJob: vi.fn((id, cb) => {
            subscribeCallback = cb;
            return vi.fn(); // unsubscribe
        }),
        generateLongFormVideo: vi.fn(() => new Promise((resolve) => {
            resolveGeneratePromise = resolve;
        })),
    },
}));

vi.mock('../../utils/video', () => ({
    serverTimestamp: vi.fn(), extractVideoFrame: vi.fn()
}));
vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    collection: vi.fn(),
}));
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
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

// Helper to update store mock during test execution
const updateStoreMock = (overrides: any) => {
    Object.assign(mockVideoEditorState, overrides);
};

describe('Pulse: Video Workflow Long Form Generation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscribeCallback = null;
        resolveGeneratePromise = null;
        // Reset store state
        Object.assign(mockVideoEditorState, {
            status: 'idle',
            jobId: null,
            progress: 0,
            viewMode: 'director'
        });
        Object.assign(mockStoreState, {
            studioControls: { resolution: '1080p', duration: 10, aspectRatio: '16:9' }
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('manages the "Queuing -> Processing -> Success" feedback loop', async () => {
        const user = userEvent.setup();
        render(<VideoWorkflow />);

        // 1. IDLE STATE
        expect(screen.getByText(/Director's Chair/i)).toBeInTheDocument();

        const input = screen.getByTestId('director-prompt-input');
        await user.type(input, 'A long cinematic journey');

        // 2. TRIGGER GENERATION
        const generateBtn = screen.getByTestId('video-generate-btn');
        await user.click(generateBtn);

        // 3. QUEUED STATE
        expect(mockToastInfo).toHaveBeenCalledWith(expect.stringContaining('Queuing scene generation'));
        expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('queued');

        // Simulate state change to Queued
        act(() => {
            updateStoreMock({ status: 'queued' });
        });

        // Re-render to reflect new state (clean up first to avoid duplicates)
        cleanup();
        render(<VideoWorkflow />);

        expect(screen.getByText(/Imaginating Scene.../i)).toBeInTheDocument();

        // 4. PROCESSING STATE
        const mockJobId = 'job-long-123';
        expect(VideoGeneration.generateLongFormVideo).toHaveBeenCalled();

        // Resolve the API call
        await act(async () => {
            if (resolveGeneratePromise) {
                resolveGeneratePromise([{ id: mockJobId, url: '', prompt: 'A long cinematic journey' }]);
            }
        });

        expect(mockVideoEditorState.setJobId).toHaveBeenCalledWith(mockJobId);
        expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('processing');

        // Simulate state change to Processing
        act(() => {
            updateStoreMock({ status: 'processing', jobId: mockJobId, progress: 0 });
        });

        cleanup();
        render(<VideoWorkflow />);

        expect(screen.getByText(/AI Director is framing the scene/i)).toBeInTheDocument();
        expect(VideoGeneration.subscribeToJob).toHaveBeenCalledWith(mockJobId, expect.any(Function));

        // 5. PROGRESS UPDATES
        act(() => {
            updateStoreMock({ progress: 45 });
            if (subscribeCallback) {
                subscribeCallback({ status: 'processing', progress: 45 });
            }
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        cleanup();
        render(<VideoWorkflow />);

        expect(screen.getByText(/AI Director is framing the scene/i)).toBeInTheDocument();
        expect(screen.getByText(/\(45%\)/i)).toBeInTheDocument();
        expect(mockVideoEditorState.setProgress).toHaveBeenCalledWith(45);

        // 6. SUCCESS STATE
        const videoUrl = 'https://example.com/long.mp4';
        act(() => {
            if (subscribeCallback) {
                subscribeCallback({ status: 'completed', videoUrl, prompt: 'A long cinematic journey' });
            }
        });
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(mockToastSuccess).toHaveBeenCalledWith('Scene generated!');
        expect(mockStoreState.addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: mockJobId,
            url: videoUrl
        }));
        expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('idle');
    });
});
