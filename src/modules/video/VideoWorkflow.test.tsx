import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';
import { extractVideoFrame } from '../../utils/video';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from '@/services/image/VideoGenerationService';

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

// Mock VideoEditorStore
vi.mock('./store/videoEditorStore', () => ({
    useVideoEditorStore: vi.fn(),
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

// Mock extractVideoFrame
vi.mock('../../utils/video', () => ({
    extractVideoFrame: vi.fn()
}));

// Mock FrameSelectionModal to easily trigger selection
vi.mock('./components/FrameSelectionModal', () => ({
    default: ({ isOpen, onSelect, target }: any) => isOpen ? (
        <div data-testid="frame-modal">
            <button onClick={() => onSelect({ id: 'vid1', type: 'video', url: 'http://video.mp4' })}>
                Select Video
            </button>
            <button onClick={() => onSelect({ id: 'img1', type: 'image', url: 'http://image.png' })}>
                Select Image
            </button>
            <div data-testid="modal-target">{target}</div>
        </div>
    ) : null
}));

// Mock VideoGenerationService
vi.mock('@/services/image/VideoGenerationService', () => ({
    VideoGeneration: {
        triggerVideoGeneration: vi.fn()
    }
}));

// Mock Firestore
const mockOnSnapshot = vi.fn();
vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    onSnapshot: (...args: any[]) => mockOnSnapshot(...args)
}));

// Mock Firebase Functions
vi.mock('@/services/firebase', () => ({
    functions: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: () => vi.fn().mockResolvedValue({
        data: {
            result: {
                success: true,
                data: {
                    url: 'https://example.com/video.mp4'
                }
            }
        }
    }),
}));

// Mock CreativeGallery component since we are testing VideoWorkflow logic
vi.mock('../creative/components/CreativeGallery', () => ({
    default: () => <div data-testid="creative-gallery">Gallery</div>
}));

describe('VideoWorkflow', () => {
    const mockSetPendingPrompt = vi.fn();
    const mockAddToHistory = vi.fn();
    const mockSetVideoInput = vi.fn();
    const mockSetJobId = vi.fn();
    const mockSetStatus = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (extractVideoFrame as any).mockResolvedValue('data:image/jpeg;base64,extracted-frame');

        (useStore as any).mockReturnValue({
            generatedHistory: [],
            selectedItem: null,
            uploadedImages: [],
            pendingPrompt: 'Test Prompt', // Set pending prompt to show ReviewStep
            setPendingPrompt: mockSetPendingPrompt,
            addToHistory: mockAddToHistory,
            setPrompt: vi.fn(),
            studioControls: {
                aspectRatio: '16:9',
                resolution: '1080p',
                duration: 5,
                fps: 24,
                motionStrength: 5,
            },
            videoInputs: {
                firstFrame: null,
                lastFrame: null,
                ingredients: []
            },
            setVideoInput: mockSetVideoInput,
            currentOrganizationId: 'org-123'
        });

        (useVideoEditorStore as any).mockReturnValue({
            jobId: null,
            status: 'idle',
            setJobId: mockSetJobId,
            setStatus: mockSetStatus,
        });

        (VideoGeneration.triggerVideoGeneration as any).mockResolvedValue({ jobId: 'test-job-id' });
        mockOnSnapshot.mockReturnValue(() => { }); // Unsubscribe function
    });

    it('renders the empty state initially', () => {
        (useStore as any).mockReturnValue({
            ...useStore(),
            pendingPrompt: null,
            currentOrganizationId: 'org-123'
        });
        render(<VideoWorkflow />);
        expect(screen.getByText('Describe your video idea')).toBeInTheDocument();
    });

    it('switches to review when pendingPrompt is set', async () => {
        render(<VideoWorkflow />);
        expect(await screen.findByRole('button', { name: /Generate Video/ })).toBeInTheDocument();
    });

    it('triggers video generation job with orgId', async () => {
        render(<VideoWorkflow />);

        // Wait for ReviewStep
        await waitFor(() => screen.getByText('Final Production Brief'));

        const generateBtn = screen.getByRole('button', { name: /Generate Video/ });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(VideoGeneration.triggerVideoGeneration).toHaveBeenCalledWith(expect.objectContaining({
                prompt: 'Test Prompt',
                resolution: '1080p',
                aspectRatio: '16:9',
                orgId: 'org-123'
            }));
            expect(mockSetJobId).toHaveBeenCalledWith('test-job-id');
        });
    });

    it('listens for job completion and updates history with orgId', async () => {
        // Simulate active job
        (useVideoEditorStore as any).mockReturnValue({
            jobId: 'test-job-id',
            status: 'queued',
            setJobId: mockSetJobId,
            setStatus: mockSetStatus,
        });

        render(<VideoWorkflow />);

        // Simulate Firestore update
        const mockSnapshot = {
            exists: () => true,
            data: () => ({
                status: 'completed',
                videoUrl: 'http://new-video.mp4',
                prompt: 'Test Prompt'
            })
        };

        // Get the callback passed to onSnapshot and call it
        await waitFor(() => {
            expect(mockOnSnapshot).toHaveBeenCalled();
        });

        const onSnapshotCallback = mockOnSnapshot.mock.calls[0][1];

        act(() => {
            onSnapshotCallback(mockSnapshot);
        });

        await waitFor(() => {
            expect(mockSetStatus).toHaveBeenCalledWith('completed');
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                url: 'http://new-video.mp4',
                type: 'video',
                orgId: 'org-123'
            }));
            expect(mockSetJobId).toHaveBeenCalledWith(null);
        });
    });

    it('extracts frame when video is selected for firstFrame', async () => {
        render(<VideoWorkflow />);

        // Wait for ReviewStep to render
        await waitFor(() => screen.getByText('Final Production Brief'));

        // Click on "Add Start Frame" placeholder/button
        const startFrameBtn = screen.getByText('Add Start Frame').closest('button');
        fireEvent.click(startFrameBtn!);

        // Modal should be open
        expect(screen.getByTestId('frame-modal')).toBeInTheDocument();
        expect(screen.getByTestId('modal-target')).toHaveTextContent('firstFrame');

        // Select Video
        fireEvent.click(screen.getByText('Select Video'));

        // Check if extractVideoFrame was called and setVideoInput was called
        await waitFor(() => {
            expect(extractVideoFrame).toHaveBeenCalledWith('http://video.mp4', -1);

            expect(mockSetVideoInput).toHaveBeenCalledWith('firstFrame', expect.objectContaining({
                url: 'data:image/jpeg;base64,extracted-frame',
                type: 'image'
            }));
        });
    });

    // Skipped: Requires component refactor to support auto-navigation to 'result' step
    it.skip('displays active video when selected', () => {
        const mockVideo = {
            id: '1',
            type: 'video' as const,
            url: 'https://example.com/test.mp4',
            prompt: 'Test Video'
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            generatedHistory: [mockVideo],
            selectedItem: mockVideo,
            uploadedImages: [],
            pendingPrompt: null,
            setPendingPrompt: mockSetPendingPrompt,
            addToHistory: mockAddToHistory,
            setPrompt: vi.fn(),
            studioControls: { aspectRatio: '16:9' },
            videoInputs: { firstFrame: null, lastFrame: null },
            setVideoInput: vi.fn(),
        });

        render(<VideoWorkflow />);
        expect(screen.getByText('"Test Video"')).toBeInTheDocument();
    });
});
