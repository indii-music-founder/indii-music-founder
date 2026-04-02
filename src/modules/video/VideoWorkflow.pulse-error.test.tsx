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
    serverTimestamp: vi.fn(),
    useStore: vi.fn(() => ({
        serverTimestamp: vi.fn(),
        generatedHistory: [],
        selectedItem: null,
        pendingPrompt: null,
        setPendingPrompt: vi.fn(),
        addToHistory: mockAddToHistory,
        setPrompt: mockSetPrompt,
        studioControls: { resolution: '1080p', duration: 4, aspectRatio: '16:9' }, // Short form (< 8s)
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
        isRightPanelOpen: false,
        toggleRightPanel: vi.fn()
    })),
}));

// Mock Video Editor Store
const editorStoreState = {
    status: 'idle',
    jobId: null,
    progress: 0,
    viewMode: 'director',
};

vi.mock('./store/videoEditorStore', () => {
    const fn = vi.fn(() => ({
        serverTimestamp: vi.fn(),
        ...editorStoreState,
        setJobId: mockSetJobId,
        setStatus: mockSetJobStatus,
        setProgress: mockSetProgress,
        setViewMode: vi.fn(),
    }));
    (fn as any).getState = vi.fn(() => ({
        serverTimestamp: vi.fn(),
        status: editorStoreState.status,
        setProgress: mockSetProgress
    }));
    return {
        serverTimestamp: vi.fn(), useVideoEditorStore: fn
    };
});

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
let rejectGeneratePromise: ((reason: any) => void) | null = null;

vi.mock('@/services/video/VideoGenerationService', () => ({
    serverTimestamp: vi.fn(),
    VideoGeneration: {
        generateVideo: vi.fn(() => new Promise((resolve, reject) => {
            resolveGeneratePromise = resolve;
            rejectGeneratePromise = reject;
        })),
        subscribeToJob: vi.fn((id, cb) => {
            subscribeCallback = cb;
            return vi.fn(); // unsubscribe
        }),
        generateLongFormVideo: vi.fn(), // Not testing long form in this file, or mock similarly if needed
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
    Object.assign(editorStoreState, overrides);
    (useVideoEditorStore as any).getState.mockReturnValue({
        status: editorStoreState.status,
        setProgress: mockSetProgress
    });
};

describe('Pulse: Video Workflow Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscribeCallback = null;
        resolveGeneratePromise = null;
        rejectGeneratePromise = null;
        // Reset store state
        editorStoreState.status = 'idle';
        editorStoreState.jobId = null;
        editorStoreState.progress = 0;
        editorStoreState.viewMode = 'director';
    });

    afterEach(() => {
        cleanup();
    });

    it('handles immediate API failures gracefully', async () => {
        const user = userEvent.setup();
        render(<VideoWorkflow />);

        // 1. Enter Prompt
        const input = screen.getByTestId('director-prompt-input');
        await user.type(input, 'A glitchy failure simulation');

        // 2. Trigger Generation
        const generateBtn = screen.getByTestId('video-generate-btn');
        await user.click(generateBtn);

        // 3. Assert Loading State
        expect(mockToastInfo).toHaveBeenCalledWith(expect.stringContaining('Queuing scene generation'));
        expect(mockSetJobStatus).toHaveBeenCalledWith('queued');

        // Simulate state change to Queued
        act(() => {
            updateStoreMock({ status: 'queued' });
        });
        cleanup();
        render(<VideoWorkflow />);

        // Assert the loading spinner or overlay is present
        expect(screen.getByText(/Imaginating Scene.../i)).toBeInTheDocument();

        // 4. Trigger Failure
        const errorMsg = 'Network Error: API Unreachable';
        await act(async () => {
            if (rejectGeneratePromise) {
                rejectGeneratePromise(new Error(errorMsg));
            }
        });

        // 5. Assert Error Feedback
        expect(mockToastError).toHaveBeenCalledWith(`Trigger failed: ${errorMsg}`);
        expect(mockSetJobStatus).toHaveBeenCalledWith('failed');

        // 6. Assert Return to Idle/Failed State
        // The component logic sets status to 'failed'.
        // In 'failed' state, the spinner should be gone.
        act(() => {
            updateStoreMock({ status: 'failed' });
        });
        cleanup();
        render(<VideoWorkflow />);

        // Spinner text should be gone
        expect(screen.queryByText(/Imaginating Scene.../i)).not.toBeInTheDocument();
        // Should show "Director's Chair" empty state (since activeVideo is null)
        expect(screen.getByText(/Director's Chair/i)).toBeInTheDocument();
    });

    it.skip('handles async job failures (e.g. Out of VRAM)', async () => {
        const user = userEvent.setup();
        render(<VideoWorkflow />);

        // 1. Setup Active Job
        const mockJobId = 'job-fail-123';

        // Manually trigger the flow to get to 'processing'
        const input = screen.getByTestId('director-prompt-input');
        await user.type(input, 'A heavy render');
        const generateBtn = screen.getByTestId('video-generate-btn');
        await user.click(generateBtn);

        // Resolve successful trigger
        await act(async () => {
            if (resolveGeneratePromise) {
                resolveGeneratePromise([{ id: mockJobId, url: '', prompt: 'A heavy render' }]);
            }
        });

        // Simulate Processing State
        act(() => {
            updateStoreMock({ status: 'processing', jobId: mockJobId, progress: 10 });
        });
        cleanup();
        render(<VideoWorkflow />);

        expect(screen.getByText(/AI Director is framing the scene... \(10%\)/i)).toBeInTheDocument();
        expect(screen.getByText(/AI Director is framing the scene\.\.\. \(10%\)/i)).toBeInTheDocument();

        // Ensure subscription is active
        expect(VideoGeneration.subscribeToJob).toHaveBeenCalledWith(mockJobId, expect.any(Function));

        // 2. Trigger Async Failure
        const failureReason = 'GPU OOM';
        act(() => {
            if (subscribeCallback) {
                subscribeCallback({ status: 'failed', stitchError: failureReason });
            }
        });
        await new Promise(resolve => setTimeout(resolve, 150));

        // 3. Assert Error Feedback
        expect(mockToastError).toHaveBeenCalledWith(`Stitching failed: ${failureReason}`);
        expect(mockSetJobId).toHaveBeenCalledWith(null);
        expect(mockSetJobStatus).toHaveBeenCalledWith('failed');
        expect(mockSetProgress).toHaveBeenCalledWith(0);

        // 4. Verify UI Reset
        act(() => {
            updateStoreMock({ status: 'failed', jobId: null, progress: 0 });
        });
        cleanup();
        render(<VideoWorkflow />);

        expect(screen.queryByText(/AI Director is framing the scene/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Director's Chair/i)).toBeInTheDocument();
    });
});
