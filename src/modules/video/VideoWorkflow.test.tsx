
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';
import { extractVideoFrame } from '../../utils/video';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
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
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
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

        // Assuming there is a generate button or similar trigger
        // Note: The actual trigger in UI might be inside DirectorPromptBar which is child.
        // If DirectorPromptBar needs 'onGenerate', VideoWorkflow passes handleGenerate.
        // We'll simulate finding the Generate button if it exists or trigger the form.

        // Since DirectorPromptBar uses an input and enter or button, lets try to find the button.
        // Assuming DirectorPromptBar has a button with text "Generate" or similar icon.

        // If explicit button not found, we might need to adjust test or mock DirectorPromptBar.
        // But let's assume standard button.
        const generateBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(mockGenerateVideo).toHaveBeenCalled();
            expect(mockSetJobStatus).toHaveBeenCalledWith('queued');
        });
    });

    it('listens to Firestore updates when jobId is present', async () => {
        // Setup store with a jobId
        (useVideoEditorStore as any).mockReturnValue({
            jobId: 'job-123',
            status: 'queued',
            setJobId: mockSetJobId,
            setStatus: mockSetJobStatus,
        });

        (useVideoEditorStore as any).getState.mockReturnValue({ status: 'queued' });

        // Mock onSnapshot
        mockOnSnapshot.mockImplementation((ref, callback) => {
            // Simulate completion
            callback({
                exists: () => true,
                data: () => ({ status: 'completed', videoUrl: 'http://video.url', prompt: 'test prompt' })
            });
            return () => { };
        });

        render(<VideoWorkflow />);

        await waitFor(() => {
            expect(mockOnSnapshot).toHaveBeenCalled();
        });

        expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
            id: 'job-123',
            url: 'http://video.url',
            type: 'video'
        }));
    });
});
