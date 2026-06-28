import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from './store/videoEditorStore';
import { ToastProvider } from '@/core/context/ToastContext';
import { processJobUpdate } from './VideoWorkflow';

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn(async (uri: string) => {
        if (uri.startsWith('gs://mock-bucket.appspot.com/')) {
            return uri.replace(
                'gs://mock-bucket.appspot.com/',
                'https://mock-bucket.appspot.com/download/'
            );
        }
        return uri;
    })
}));

// Mock Store
vi.mock('@/core/store', () => {
    const mockState: Record<string, any> = {
        updateJobProgress: vi.fn(),
        updateJobStatus: vi.fn(),
        addJob: vi.fn(),
        setHasUnsavedChanges: vi.fn(),
        isRightPanelOpen: false,
        toggleRightPanel: vi.fn(),
    };
    const useStoreMock: any = vi.fn((selector?: any) => selector ? selector(mockState) : mockState);
    useStoreMock.getState = vi.fn(() => mockState);
    useStoreMock.setState = vi.fn((patch: any) => Object.assign(mockState, typeof patch === 'function' ? patch(mockState) : patch));
    useStoreMock.subscribe = vi.fn(() => () => { });
    useStoreMock._mockState = mockState; // Expose for test setup
    return { useStore: useStoreMock };
});

// Mock Editor Store
vi.mock('./store/videoEditorStore', () => {
    const mockState = { 
        status: 'idle', 
        viewMode: 'director',
        setProgress: vi.fn(),
        setStatus: vi.fn(),
        setJobId: vi.fn(),
        setViewMode: vi.fn()
    };
    const fn = vi.fn((selector) => selector ? selector(mockState) : mockState);
    (fn as any).getState = vi.fn(() => mockState);
    (fn as any).setState = vi.fn((patch: any) => Object.assign(mockState, typeof patch === 'function' ? patch(mockState) : patch));
    return { useVideoEditorStore: fn };
});

// Mock Toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: mockToastSuccess,
        error: mockToastError,
        info: mockToastInfo,
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Lucide React
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    Loader2: () => <div />,
    Layout: () => <div />,
    Maximize2: () => <div />,
    Settings: () => <div />,
    Sparkles: () => <div />,
    Video: () => <div />,
}));

// Mock ErrorBoundary
vi.mock('@/core/components/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: any) => <div>{children}</div>
}));

// Mock FrameSelectionModal
vi.mock('./components/FrameSelectionModal', () => ({
    default: () => null
}));

// Mock VideoStage
vi.mock('./components/VideoStage', () => ({
    VideoStage: ({ jobStatus }: any) => <div data-testid="video-stage">Status: {jobStatus}</div>
}));

// Mock SceneBuilder (3D Visualizer) as it uses @react-three/fiber which fails in JSDOM
vi.mock('./visualizer/SceneBuilder', () => ({
    SceneBuilder: () => <div data-testid="scene-builder">3D Stage</div>
}));

// Mock WhiskService
vi.mock('../../services/WhiskService', () => ({
    WhiskService: {
        synthesizeVideoPrompt: vi.fn((p) => p)
    }
}));

// Mock Editor
vi.mock('./editor/VideoEditor', () => ({
    VideoEditor: () => <div>Editor</div>
}));

// Mock DirectorPromptBar
vi.mock('./components/DirectorPromptBar', () => ({
    DirectorPromptBar: ({ onGenerate, onPromptChange }: any) => (
        <div>
            <input placeholder="Describe your scene" onChange={(e) => onPromptChange(e.target.value)} />
            <button onClick={() => onGenerate()}>Generate</button>
        </div>
    )
}));

// Mock DailiesStrip
vi.mock('./components/DailiesStrip', () => ({
    DailiesStrip: () => <div data-testid="dailies-strip" />
}));

// Mock VideoGenerationService
const mockGenerateVideo = vi.fn();
const mockSubscribeToJob = vi.fn();
vi.mock('../../../services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        subscribeToJob: (...args: any[]) => mockSubscribeToJob(...args),
        generateLongFormVideo: vi.fn(),
        estimateVideoCost: vi.fn((duration) => duration * 0.1),
    },
}));

describe('Lens: Veo 3.1 Generation Pipeline', () => {
    const mockAddToHistory = vi.fn();
    const mockSetJobId = vi.fn();
    const mockSetJobStatus = vi.fn();
    const mockSetPrompt = vi.fn();
    const mockSetProgress = vi.fn();
    const mockSetVideoInputs = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // NO fake timers

        // Setup User Store
        (useStore as unknown as import("vitest").Mock).mockReturnValue({
            generatedHistory: [],
            selectedItem: null,
            pendingPrompt: null,
            setPendingPrompt: vi.fn(),
            addToHistory: mockAddToHistory,
            creativePrompt: '',
            setCreativePrompt: mockSetPrompt,
            studioControls: { resolution: '1080p', duration: 5, fps: 24 },
            videoInputs: {},
            setVideoInput: vi.fn(),
            setVideoInputs: mockSetVideoInputs,
            currentOrganizationId: 'org-lens',
            currentProjectId: 'proj-veo',
            isRightPanelOpen: false,
            toggleRightPanel: vi.fn(),
        });
    });

    it('Scenario 1: Veo 3.1 Pro Flow - Enforces Metadata Contract', async () => {
        const jobId = 'job-veo-pro';
        const expectedMetadata = {
            mime_type: 'video/mp4',
            duration_seconds: 5,
            fps: 24,
            resolution: '1080p'
        };

        // Initialize Store with Job ID
        (useVideoEditorStore as unknown as import("vitest").Mock).mockReturnValue({
            jobId: jobId,
            status: 'queued',
            setJobId: mockSetJobId,
            setStatus: mockSetJobStatus,
            setProgress: mockSetProgress,
            progress: 0,
        });
        (useVideoEditorStore as any).getState.mockReturnValue({ status: 'queued', setProgress: mockSetProgress });

        // Setup subscription mock with fast real-time delays
        mockSubscribeToJob.mockImplementation((id, callback) => {
            if (id !== jobId) return () => { };

            // Processing after 50ms
            setTimeout(() => {
                callback({ status: 'processing', progress: 50, id: jobId });
            }, 50);

            // Completed after 100ms
            setTimeout(() => {
                callback({
                    status: 'completed',
                    id: jobId,
                    videoUrl: 'https://mock-veo.com/video.mp4',
                    prompt: 'Cinematic shot',
                    output: {
                        metadata: expectedMetadata
                    }
                });
            }, 100);

            return () => { };
        });

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        // Assert
        await waitFor(() => {
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                id: jobId,
                url: 'https://mock-veo.com/video.mp4',
                meta: JSON.stringify(expectedMetadata)
            }));
        }, { timeout: 2000 });
    });

    it('Scenario 2: Veo 3.1 Resilience - Handles Safety Filter & Flash Speed', async () => {
        // --- Test Part 1: Flash Speed ---
        const flashJobId = 'job-veo-flash';
        const flashMetadata = {
            duration_seconds: 2,
            fps: 24,
            mime_type: 'video/mp4'
        };

        // Setup Store for Flash Job
        // Note: The component calls `generateVideo` then `setJobId`.
        // We need to mock `useVideoEditorStore` to update its state when `setJobId` is called?
        // Actually, `useVideoEditorStore` mock returns static values here unless we change them.
        // But `VideoWorkflow` reads `jobId` from the hook.
        // We need to simulate the state transition.

        // However, `VideoWorkflow` is a functional component. If we want to test the full flow from "Generate" click,
        // we rely on the component calling `setJobId`. But the component re-renders with the *new* `jobId`
        // only if `useVideoEditorStore` returns it.
        // Since we mocked `useVideoEditorStore` to return values, we need to allow them to be updated or mock the re-render cycle.

        // Simpler approach: We can just render the component with a specific `jobId` in the store mock to test the *subscription* logic,
        // similar to Scenario 1.

        // Let's test "Flash" logic by manually triggering the subscription flow via store mock.

        (useVideoEditorStore as unknown as import("vitest").Mock).mockReturnValue({
            jobId: flashJobId,
            status: 'processing', // Already processing
            setJobId: mockSetJobId,
            setStatus: mockSetJobStatus,
            setProgress: mockSetProgress,
            progress: 0,
        });
        (useVideoEditorStore as any).getState.mockReturnValue({ status: 'processing', setProgress: mockSetProgress });

        mockSubscribeToJob.mockImplementation((id, callback) => {
            if (id !== flashJobId) return () => { };
            // Flash: Immediate return (< 50ms)
            setTimeout(() => {
                callback({
                    status: 'completed',
                    id: flashJobId,
                    videoUrl: 'https://mock.veo/flash.mp4',
                    prompt: 'Flash shot',
                    metadata: flashMetadata
                });
            }, 20);
            return () => { };
        });

        const { unmount } = render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        // Verify Flash Completion
        await waitFor(() => {
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                id: flashJobId,
                meta: JSON.stringify(flashMetadata)
            }));
        }, { timeout: 1000 }); // Should be fast

        unmount();
        vi.clearAllMocks();

        // --- Test Part 2: Safety Violation ---
        const safetyJobId = 'job-veo-safety';

        (useVideoEditorStore as unknown as import("vitest").Mock).mockReturnValue({
            jobId: safetyJobId,
            status: 'processing',
            setJobId: mockSetJobId,
            setStatus: mockSetJobStatus,
            setProgress: mockSetProgress,
            progress: 0,
        });

        mockSubscribeToJob.mockImplementation((id, callback) => {
            if (id !== safetyJobId) return () => { };
            setTimeout(() => {
                callback({
                    status: 'failed',
                    id: safetyJobId,
                    stitchError: 'SAFETY_VIOLATION: Harmful content detected',
                    metadata: { safety_ratings: ['BLOCK_MEDIUM_AND_ABOVE'] }
                });
            }, 50);
            return () => { };
        });

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        // Verify Safety Error Handling
        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('SAFETY_VIOLATION'));
            expect(mockSetJobStatus).toHaveBeenCalledWith('failed');
        });
    });
});

describe('VideoWorkflow - processJobUpdate', () => {
    let mockDeps: any;
    let mockSetVideoInputs: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockSetVideoInputs = vi.fn();
        mockDeps = {
            currentProjectId: 'proj-456',
            currentOrganizationId: 'org-123',
            localPrompt: 'default prompt',
            addToHistory: vi.fn(),
            updateHistoryItem: vi.fn(),
            setActiveVideo: vi.fn(),
            setJobId: vi.fn(),
            setJobStatus: vi.fn(),
            setJobProgress: vi.fn(),
            toast: {
                success: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
            },
            resetEditorProgress: vi.fn(),
            getCurrentStatus: vi.fn(() => 'processing'),
        };
    });

    it('extracts Veo 3.1 metadata and stores it in HistoryItem.meta', async () => {
        const veoMetadata = {
            duration_seconds: 5.0,
            fps: 24,
            mime_type: "video/mp4"
        };
        const directorSettings = {
            fps: 24,
            durationSeconds: 5,
            totalFrames: 120,
            firstFrameUri: 'gs://mock-bucket.appspot.com/anchors/start.png',
            lastFrameUri: 'gs://mock-bucket.appspot.com/anchors/end.png',
        };

        const jobData = {
            status: 'completed',
            videoUrl: 'gs://mock-bucket.appspot.com/video.mp4',
            prompt: 'Hyper-realistic drone shot',
            metadata: veoMetadata,
            directorSettings,
            inputUris: [
                directorSettings.firstFrameUri,
                directorSettings.lastFrameUri
            ],
            progress: 100
        };

        await processJobUpdate(jobData, 'veo-job-123', mockDeps);

        // Verify that addToHistory was called with the correct metadata
        const historyItem = mockDeps.addToHistory.mock.calls[0][0];
        expect(historyItem).toEqual(expect.objectContaining({
            id: 'veo-job-123',
            url: 'https://mock-bucket.appspot.com/download/video.mp4',
            storageUri: 'gs://mock-bucket.appspot.com/video.mp4',
            type: 'video',
            meta: expect.any(String)
        }));

        expect(JSON.parse(historyItem.meta)).toEqual(expect.objectContaining({
            ...veoMetadata,
            directorSettings,
            firstFrameUri: directorSettings.firstFrameUri,
            lastFrameUri: directorSettings.lastFrameUri,
            inputUris: [directorSettings.firstFrameUri, directorSettings.lastFrameUri],
        }));

        expect(mockDeps.setJobStatus).toHaveBeenCalledWith('idle');
        expect(mockDeps.toast.success).toHaveBeenCalledWith('Scene generated!');
    });

    it('rehydrates keyframe anchors when a saved video is reopened', async () => {
        const selectedVideo = {
            id: 'video-reopen-1',
            type: 'video' as const,
            url: 'https://mock-bucket.appspot.com/download/video.mp4',
            prompt: 'Saved scene',
            timestamp: 1700000000000,
            projectId: 'proj-veo',
            meta: JSON.stringify({
                mime_type: 'video/mp4',
                directorSettings: {
                    firstFrameUri: 'gs://mock-bucket.appspot.com/anchors/start.png',
                    lastFrameUri: 'gs://mock-bucket.appspot.com/anchors/end.png',
                },
                hasFirstFrame: true,
                hasLastFrame: true,
            }),
        };

        (useStore as unknown as import("vitest").Mock).mockReturnValue({
            generatedHistory: [selectedVideo],
            selectedItem: selectedVideo,
            pendingPrompt: null,
            setPendingPrompt: vi.fn(),
            addToHistory: vi.fn(),
            creativePrompt: '',
            setCreativePrompt: vi.fn(),
            studioControls: { resolution: '1080p', duration: 5, fps: 24 },
            videoInputs: {},
            setVideoInput: vi.fn(),
            setVideoInputs: mockSetVideoInputs,
            currentOrganizationId: 'org-lens',
            currentProjectId: 'proj-veo',
            isRightPanelOpen: false,
            toggleRightPanel: vi.fn(),
        });

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        await waitFor(() => {
            expect(mockSetVideoInputs).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: expect.objectContaining({
                    id: 'video-reopen-1-firstFrame-frame',
                    url: 'https://mock-bucket.appspot.com/download/anchors/start.png',
                    storageUri: 'gs://mock-bucket.appspot.com/anchors/start.png',
                    type: 'image',
                }),
                lastFrame: expect.objectContaining({
                    id: 'video-reopen-1-lastFrame-frame',
                    url: 'https://mock-bucket.appspot.com/download/anchors/end.png',
                    storageUri: 'gs://mock-bucket.appspot.com/anchors/end.png',
                    type: 'image',
                }),
            }));
        });
    });
});
