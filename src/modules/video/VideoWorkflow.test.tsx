
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';
import { extractVideoFrame } from '../../utils/video';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '@/services/image/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

vi.mock('./store/videoEditorStore', () => {
    const fn = vi.fn();
    (fn as any).getState = vi.fn(() => ({ status: 'idle' }));
    return { useVideoEditorStore: fn };
});

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
}));

// Mock extractVideoFrame
vi.mock('../../utils/video', () => ({
    extractVideoFrame: vi.fn()
}));

// Mock FrameSelectionModal
vi.mock('./components/FrameSelectionModal', () => ({
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
vi.mock('@/services/image/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        subscribeToJob: (...args: any[]) => mockSubscribeToJob(...args),
    },
}));

// Mock Firestore
const mockOnSnapshot = vi.fn();
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn(),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
    collection: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {}
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
        (extractVideoFrame as any).mockResolvedValue('data:image/jpeg;base64,extracted-frame');

        (useStore as any).mockReturnValue({
            generatedHistory: [],
            selectedItem: null,
            pendingPrompt: null,
            setPendingPrompt: vi.fn(),
            addToHistory: mockAddToHistory,
            setPrompt: vi.fn(),
            studioControls: { resolution: '1080p' },
            videoInputs: {},
            setVideoInput: vi.fn(),
            currentOrganizationId: 'org-123',
        });

        // Mock functional update capability for setJobStatus
        mockSetJobStatus.mockImplementation((arg) => {
            // Basic mock
        });

        (useVideoEditorStore as any).mockReturnValue({
            jobId: null,
            status: 'idle',
            setJobId: mockSetJobId,
            setStatus: mockSetJobStatus,
        });

        // Ensure getState Returns correctly
        (useVideoEditorStore as any).getState.mockReturnValue({ status: 'idle' });

        (useToast as any).mockReturnValue(mockToast);
    });

    it('triggers video generation and sets jobId', async () => {
        mockGenerateVideo.mockResolvedValue([{ id: 'job-123', url: '', prompt: 'test' }]);

        render(<VideoWorkflow />);

        // Set prompt first
        const input = screen.getByPlaceholderText(/describe your scene/i);
        fireEvent.change(input, { target: { value: 'Cyberpunk city' } });

        const generateBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockGenerateVideo).toHaveBeenCalled();
            expect(mockSetJobStatus).toHaveBeenCalledWith('queued');
        });
    });

    it('listens to job updates via VideoGeneration service', async () => {
        // Setup store with a jobId
        (useVideoEditorStore as any).mockReturnValue({
            jobId: 'job-123',
            status: 'queued',
            setJobId: mockSetJobId,
            setStatus: mockSetJobStatus,
        });

        (useVideoEditorStore as any).getState.mockReturnValue({ status: 'queued' });

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

        render(<VideoWorkflow />);

        await waitFor(() => {
            expect(mockSubscribeToJob).toHaveBeenCalledWith('job-123', expect.any(Function));
        });

        expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: 'job-123',
            url: 'http://video.url',
            type: 'video'
        }));
    });
});
