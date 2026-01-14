
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '../../services/video/VideoGenerationService';
import userEvent from '@testing-library/user-event';

// --- Mocks ---

// Mock Store
const mockAddToHistory = vi.fn();
const mockSetJobId = vi.fn();
const mockSetJobStatus = vi.fn();
const mockSetProgress = vi.fn();
const mockSetPrompt = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        generatedHistory: [],
        selectedItem: null,
        pendingPrompt: null,
        setPendingPrompt: vi.fn(),
        addToHistory: mockAddToHistory,
        setPrompt: mockSetPrompt,
        studioControls: { resolution: '1080p', duration: 10, aspectRatio: '16:9' }, // Duration > 8 triggers Long Form
        videoInputs: {},
        currentOrganizationId: 'org-123',
        currentProjectId: 'proj-123',
        setVideoInputs: vi.fn(),
    })),
}));

// Mock Video Editor Store
let editorStoreState = {
    status: 'idle',
    jobId: null,
    progress: 0,
    viewMode: 'director',
};

vi.mock('./store/videoEditorStore', () => {
    const fn = vi.fn(() => ({
        ...editorStoreState,
        setJobId: mockSetJobId,
        setStatus: mockSetJobStatus,
        setProgress: mockSetProgress,
        setViewMode: vi.fn(),
    }));
    (fn as any).getState = vi.fn(() => ({
        status: editorStoreState.status,
        setProgress: mockSetProgress
    }));
    return { useVideoEditorStore: fn };
});

// Mock Toast
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
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

vi.mock('../../utils/video', () => ({ extractVideoFrame: vi.fn() }));
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    collection: vi.fn(),
}));
vi.mock('@/services/firebase', () => ({ db: {} }));

// Helper to update store mock during test execution
const updateStoreMock = (overrides: any) => {
    Object.assign(editorStoreState, overrides);
    (useVideoEditorStore as any).getState.mockReturnValue({
        status: editorStoreState.status,
        setProgress: mockSetProgress
    });
};

describe('Pulse: Video Workflow Long Form Generation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscribeCallback = null;
        resolveGeneratePromise = null;
        // Reset store state
        editorStoreState.status = 'idle';
        editorStoreState.jobId = null;
        editorStoreState.progress = 0;
        editorStoreState.viewMode = 'director';
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
        expect(mockSetJobStatus).toHaveBeenCalledWith('queued');

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

        expect(mockSetJobId).toHaveBeenCalledWith(mockJobId);
        expect(mockSetJobStatus).toHaveBeenCalledWith('processing');

        // Simulate state change to Processing
        act(() => {
            updateStoreMock({ status: 'processing', jobId: mockJobId, progress: 0 });
        });

        cleanup();
        render(<VideoWorkflow />);

        expect(screen.getByText(/AI Director is rendering your vision \(0%\)/i)).toBeInTheDocument();
        expect(VideoGeneration.subscribeToJob).toHaveBeenCalledWith(mockJobId, expect.any(Function));

        // 5. PROGRESS UPDATES
        act(() => {
            updateStoreMock({ progress: 45 });
            if (subscribeCallback) {
                subscribeCallback({ status: 'processing', progress: 45 });
            }
        });

        cleanup();
        render(<VideoWorkflow />);

        expect(screen.getByText(/AI Director is rendering your vision \(45%\)/i)).toBeInTheDocument();
        expect(mockSetProgress).toHaveBeenCalledWith(45);

        // 6. SUCCESS STATE
        const videoUrl = 'https://example.com/long.mp4';
        act(() => {
             if (subscribeCallback) {
                 subscribeCallback({ status: 'completed', videoUrl, prompt: 'A long cinematic journey' });
             }
        });

        expect(mockToastSuccess).toHaveBeenCalledWith('Scene generated!');
        expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: mockJobId,
            url: videoUrl
        }));
        expect(mockSetJobStatus).toHaveBeenCalledWith('idle');
    });
});
