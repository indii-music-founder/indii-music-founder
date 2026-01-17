import { render, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from './store/videoEditorStore';
import { ToastProvider } from '@/core/context/ToastContext';

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

// Mock Editor Store
vi.mock('./store/videoEditorStore', () => {
    const fn = vi.fn();
    (fn as any).getState = vi.fn(() => ({ status: 'idle', setProgress: vi.fn() }));
    return { useVideoEditorStore: fn };
});

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Lucide React
vi.mock('lucide-react', () => ({
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

// Mock Editor
vi.mock('./editor/VideoEditor', () => ({
    VideoEditor: () => <div>Editor</div>
}));

// Mock DirectorPromptBar
vi.mock('./components/DirectorPromptBar', () => ({
    DirectorPromptBar: ({ onGenerate, onPromptChange }: any) => (
        <div>
            <input placeholder="Describe your scene" onChange={(e) => onPromptChange(e.target.value)} />
            <button onClick={onGenerate}>Generate</button>
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
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        subscribeToJob: (...args: any[]) => mockSubscribeToJob(...args),
        generateLongFormVideo: vi.fn(),
    },
}));

describe('Lens: Veo 3.1 Generation Pipeline', () => {
    const mockAddToHistory = vi.fn();
    const mockSetJobId = vi.fn();
    const mockSetJobStatus = vi.fn();
    const mockSetPrompt = vi.fn();
    const mockSetProgress = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // NO fake timers

        // Setup User Store
        (useStore as any).mockReturnValue({
            generatedHistory: [],
            selectedItem: null,
            pendingPrompt: null,
            setPendingPrompt: vi.fn(),
            addToHistory: mockAddToHistory,
            setPrompt: mockSetPrompt,
            studioControls: { resolution: '1080p', duration: 5, fps: 24 },
            videoInputs: {},
            setVideoInput: vi.fn(),
            currentOrganizationId: 'org-lens',
            currentProjectId: 'proj-veo',
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
        (useVideoEditorStore as any).mockReturnValue({
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
            if (id !== jobId) return () => {};

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

            return () => {};
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processJobUpdate } from './VideoWorkflow';

describe('VideoWorkflow - processJobUpdate', () => {
    let mockDeps: any;

    beforeEach(() => {
        mockDeps = {
            currentProjectId: 'proj-456',
            currentOrganizationId: 'org-123',
            localPrompt: 'default prompt',
            addToHistory: vi.fn(),
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

    it('extracts Veo 3.1 metadata and stores it in HistoryItem.meta', () => {
        const veoMetadata = {
            duration_seconds: 5.0,
            fps: 24,
            mime_type: "video/mp4"
        };

        const jobData = {
            status: 'completed',
            videoUrl: 'http://veo.generated/video.mp4',
            prompt: 'Hyper-realistic drone shot',
            metadata: veoMetadata,
            progress: 100
        };

        processJobUpdate(jobData, 'veo-job-123', mockDeps);

        // Verify that addToHistory was called with the correct metadata
        expect(mockDeps.addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: 'veo-job-123',
            url: 'http://veo.generated/video.mp4',
            type: 'video',
            meta: JSON.stringify(veoMetadata)
        }));

        expect(mockDeps.setJobStatus).toHaveBeenCalledWith('idle');
        expect(mockDeps.toast.success).toHaveBeenCalledWith('Scene generated!');
    });
});
