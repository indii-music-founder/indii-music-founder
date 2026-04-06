
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';
import { extractVideoFrame } from '../../utils/video';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast, ToastProvider } from '@/core/context/ToastContext';

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
        studioControls: { resolution: '1080p' },
        videoInputs: {},
        setVideoInput: vi.fn(),
        setVideoInputs: vi.fn(),
        currentOrganizationId: 'org-123',
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

    const useStore = Object.assign(
        vi.fn((selector) => selector ? selector(store) : store),
        {
            getState: vi.fn(() => store),
            setState: vi.fn((patch: any) => Object.assign(store, typeof patch === 'function' ? patch(store) : patch))
        }
    );

    const useVideoEditorStore = Object.assign(
        vi.fn((selector) => selector ? selector(editorStore) : editorStore),
        {
            getState: vi.fn(() => editorStore),
            setState: vi.fn((patch: any) => Object.assign(editorStore, typeof patch === 'function' ? patch(editorStore) : patch))
        }
    );

    return {
        mockStoreState: store,
        mockVideoEditorState: editorStore,
        mockUseStore: useStore,
        mockUseVideoEditorStore: useVideoEditorStore
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
vi.mock('@/core/context/ToastContext', () => ({
    serverTimestamp: vi.fn(),
    useToast: vi.fn(() => ({
        serverTimestamp: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock extractVideoFrame
vi.mock('../../utils/video', () => ({
    serverTimestamp: vi.fn(),
    extractVideoFrame: vi.fn()
}));

// Mock FrameSelectionModal
vi.mock('./components/FrameSelectionModal', () => ({
    serverTimestamp: vi.fn(),
    default: ({ isOpen, onSelect, target }: any) => isOpen ? (
        <div data-testid="frame-modal">
            <button onClick={() => onSelect({ id: 'vid1', type: 'video', url: 'http://video.mp4' })}>
                Select Video
            </button>
            <div data-testid="modal-target">{target}</div>
        </div>
    ) : null
}));

// Mock VideoGenerationService
const mockGenerateVideo = vi.fn();
const mockSubscribeToJob = vi.fn();
vi.mock('@/services/video/VideoGenerationService', () => ({
    serverTimestamp: vi.fn(),
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        subscribeToJob: (...args: any[]) => mockSubscribeToJob(...args),
    },
}));

// Mock Firestore
const mockOnSnapshot = vi.fn();
vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    getFirestore: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    })),
    doc: vi.fn(),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
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

describe('VideoWorkflow', () => {
    const mockAddToHistory = vi.fn();
    const mockSetJobId = vi.fn();
    const mockSetJobStatus = vi.fn();

    // Setup mock toast instance for expectations
    const mockToast = {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (extractVideoFrame as import("vitest").Mock).mockResolvedValue('data:image/jpeg;base64,extracted-frame');

        // Reset mock states
        Object.assign(mockStoreState, {
            generatedHistory: [],
            selectedItem: null,
            pendingPrompt: null,
            videoInputs: {},
            studioControls: { resolution: '1080p' }
        });

        Object.assign(mockVideoEditorState, {
            jobId: null,
            status: 'idle',
            progress: 0
        });

        (useToast as unknown as import("vitest").Mock).mockReturnValue(mockToast);
    });

    it('triggers video generation and sets jobId', async () => {
        mockGenerateVideo.mockResolvedValue([{ id: 'job-123', url: '', prompt: 'test' }]);

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        // Set prompt first
        const input = screen.getByPlaceholderText(/describe your scene/i);
        fireEvent.change(input, { target: { value: 'Cyberpunk city' } });

        const generateBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockGenerateVideo).toHaveBeenCalled();
            expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('queued');
        });
    });

    it('listens to job updates via VideoGeneration service', async () => {
        // Setup store with a jobId
        (mockVideoEditorState as any).jobId = 'job-123';
        (mockVideoEditorState as any).status = 'queued';

        // Mock subscribeToJob
        mockSubscribeToJob.mockImplementation((id, callback) => {
            // Simulate completion
            callback({
                status: 'completed',
                videoUrl: 'http://video.url',
                prompt: 'test prompt'
            });
            return () => { };
        });

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        await waitFor(() => {
            expect(mockSubscribeToJob).toHaveBeenCalledWith('job-123', expect.any(Function));
        });

        expect(mockStoreState.addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: 'job-123',
            url: 'http://video.url',
            type: 'video'
        }));
    });
});
