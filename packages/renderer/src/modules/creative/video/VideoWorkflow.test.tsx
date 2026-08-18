import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { extractVideoFrame } from '../../../utils/video';
import { materializeVideoFrameForHandoff } from '@/services/creative/CreativeMediaHandoffService';
import { useToast, ToastProvider } from '@/core/context/ToastContext';
import { CREATIVE_ASSET_MIME } from '@/services/creative/CreativeAssetDragService';

function droppedAssetDataTransfer(asset: Record<string, unknown>): DataTransfer {
    const serialized = JSON.stringify({ version: 1, kind: 'creative-asset', source: 'project-assets', asset });
    return {
        dropEffect: 'none',
        getData: (format: string) => format === CREATIVE_ASSET_MIME ? serialized : '',
    } as DataTransfer;
}

// --- Mocks ---

const { mockStoreState, mockVideoEditorState, mockUseStore, mockUseVideoEditorStore, mockWorkspaceLayout } = vi.hoisted(() => {
    const store = {
        generatedHistory: [],
        selectedItem: null,
        pendingPrompt: null,
        setPendingPrompt: vi.fn(),
        addToHistory: vi.fn(),
        updateHistoryItem: vi.fn(),
        creativePrompt: '',
        setCreativePrompt: vi.fn(),
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
        currentProjectId: 'project-1',
        pendingStageHandoff: { image: null, veo: null, omni: null, editor: null },
        consumeStageHandoff: vi.fn(),
        addCharacterReference: vi.fn(),
        sendToStage: vi.fn(),
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
        mockUseVideoEditorStore: useVideoEditorStore,
        mockWorkspaceLayout: { mode: 'wide' as 'wide' | 'standard' | 'focused', width: 1440 },
    };
});

vi.mock('@/components/layout/AdaptiveWorkspaceContext', () => ({
    useOptionalAdaptiveWorkspace: () => mockWorkspaceLayout,
}));

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
vi.mock('../../../utils/video', () => ({
    serverTimestamp: vi.fn(),
    extractVideoFrame: vi.fn()
}));

vi.mock('@/services/creative/CreativeMediaHandoffService', () => ({
    materializeVideoFrameForHandoff: vi.fn(),
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

vi.mock('./components/VideoStage', () => ({
    VideoStage: ({ activeVideo }: { activeVideo?: { id?: string } | null }) => (
        <div data-testid="video-stage">{activeVideo?.id || 'empty-stage'}</div>
    ),
}));

// Mock VideoGenerationService
const mockGenerateVideo = vi.fn();
const mockSubscribeToJob = vi.fn();
vi.mock('@/services/video/VideoGenerationService', () => ({
    serverTimestamp: vi.fn(),
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        subscribeToJob: (...args: any[]) => mockSubscribeToJob(...args),
        estimateVideoCost: vi.fn((duration) => duration * 0.1),
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
    const _mockAddToHistory = vi.fn();
    const _mockSetJobId = vi.fn();
    const _mockSetJobStatus = vi.fn();

    // Setup mock toast instance for expectations
    const mockToast = {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockWorkspaceLayout.mode = 'wide';
        mockWorkspaceLayout.width = 1440;
        (extractVideoFrame as import("vitest").Mock).mockResolvedValue('data:image/jpeg;base64,extracted-frame');

        // Reset mock states
        Object.assign(mockStoreState, {
            generatedHistory: [],
            selectedItem: null,
            pendingPrompt: null,
            videoInputs: {},
            pendingStageHandoff: { image: null, veo: null, omni: null, editor: null },
            studioControls: { resolution: '1080p' }
        });

        Object.assign(mockVideoEditorState, {
            jobId: null,
            status: 'idle',
            progress: 0
        });

        (useToast as unknown as import("vitest").Mock).mockReturnValue(mockToast);
        vi.mocked(materializeVideoFrameForHandoff).mockResolvedValue({
            id: 'omni-last-frame',
            type: 'image',
            url: 'https://storage.example/omni-last.jpg',
            storageUri: 'gs://bucket/omni-last.jpg',
            prompt: 'Last frame from Omni output',
            timestamp: 2,
            projectId: 'project-1',
            parentId: 'omni-video-1',
        });
    });

    it('triggers video generation and sets jobId', async () => {
        mockGenerateVideo.mockResolvedValue([{ id: 'job-123', url: '', prompt: 'test' }]);

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        // Set prompt first
        const input = screen.getByPlaceholderText(/describe your video/i);
        fireEvent.change(input, { target: { value: 'Cyberpunk city' } });

        const generateBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockGenerateVideo).toHaveBeenCalled();
            expect(mockVideoEditorState.setStatus).toHaveBeenCalledWith('queued');
        });
    });

    it('never forwards a NaN seed to the gateway (ISSUE-1360)', async () => {
        mockGenerateVideo.mockResolvedValue([{ id: 'job-456', url: '', prompt: 'test' }]);

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        const input = screen.getByPlaceholderText(/describe your video/i);
        fireEvent.change(input, { target: { value: 'Turntable close-up' } });

        // Open the technical settings panel to reach the seed control.
        const settingsToggle = screen.getByTestId('toggle-settings-btn');
        fireEvent.click(settingsToggle);

        const seedInput = await screen.findByTestId('seed-input');
        fireEvent.change(seedInput, { target: { value: 'not-a-number' } });

        const generateBtn = screen.getByTestId('video-generate-btn');
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockGenerateVideo).toHaveBeenCalled();
        });
        const payload = mockGenerateVideo.mock.calls[0][0];
        expect(Number.isNaN(payload.seed)).toBe(false);
        expect(payload.seed).toBeUndefined();
        if (payload.directorSettings) {
            expect(Number.isNaN(payload.directorSettings.seed)).toBe(false);
            expect(payload.directorSettings.seed).toBeUndefined();
        }
    });

    it('protects the primary stage when the measured workspace is focused', () => {
        mockWorkspaceLayout.mode = 'focused';
        mockWorkspaceLayout.width = 720;

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        expect(screen.getByTestId('video-workflow-workspace')).toHaveAttribute('data-workspace-mode', 'focused');
        expect(screen.getByTestId('video-primary-stage')).toHaveClass('px-3', 'pb-44');
        expect(screen.getByTestId('video-mode-actions')).toHaveClass('flex-row', 'top-3');
        expect(screen.getByTestId('video-technical-settings')).toHaveClass('top-3');
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

    it('turns an Omni source video into a durable Veo continuity frame', async () => {
        const omniVideo = {
            id: 'omni-video-1',
            type: 'video' as const,
            url: 'https://storage.example/omni.mp4',
            storageUri: 'gs://bucket/omni.mp4',
            prompt: 'Omni performance',
            timestamp: 1,
            projectId: 'project-1',
        };
        mockStoreState.pendingStageHandoff.veo = {
            item: omniVideo,
            role: 'source-video',
            originStage: 'omni',
            timestamp: Date.now(),
        };

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        await waitFor(() => expect(materializeVideoFrameForHandoff).toHaveBeenCalledWith(
            omniVideo,
            'last',
            { userId: 'test-user', projectId: 'project-1' },
        ));
        await waitFor(() => expect(mockStoreState.setVideoInputs).toHaveBeenCalledWith({
            firstFrame: expect.objectContaining({
                type: 'image',
                storageUri: 'gs://bucket/omni-last.jpg',
            }),
            lastFrame: null,
        }));
        expect(mockStoreState.consumeStageHandoff).toHaveBeenCalledWith('veo');
    });

    it('opens a routed Omni video directly in the timeline editor', async () => {
        const omniVideo = {
            id: 'omni-video-editor',
            type: 'video' as const,
            url: 'https://storage.example/omni-editor.mp4',
            storageUri: 'gs://bucket/omni-editor.mp4',
            prompt: 'Omni editor source',
            timestamp: 1,
            projectId: 'project-1',
        };
        mockStoreState.pendingStageHandoff.editor = {
            item: omniVideo,
            role: 'source-video',
            originStage: 'omni',
            timestamp: Date.now(),
        };

        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        await waitFor(() => expect(mockVideoEditorState.setViewMode).toHaveBeenCalledWith('editor'));
        expect(mockStoreState.consumeStageHandoff).toHaveBeenCalledWith('editor');
    });

    it('accepts a dragged project image as the first available Veo frame', async () => {
        render(
            <ToastProvider>
                <VideoWorkflow />
            </ToastProvider>
        );

        fireEvent.drop(screen.getByTestId('veo-asset-drop-zone'), {
            dataTransfer: droppedAssetDataTransfer({
                id: 'dragged-image-1',
                type: 'image',
                url: 'https://storage.example/dragged-image.jpg',
                storageUri: 'gs://bucket/dragged-image.jpg',
                name: 'Dragged image',
                prompt: 'Dragged image',
                projectId: 'project-1',
            }),
        });

        await waitFor(() => expect(mockStoreState.setVideoInputs).toHaveBeenCalledWith({
            firstFrame: expect.objectContaining({
                id: 'dragged-image-1',
                type: 'image',
                storageUri: 'gs://bucket/dragged-image.jpg',
            }),
        }));
    });
});
