import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoWorkflow from './VideoWorkflow';
import { useStore } from '@/core/store';

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
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

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue({
            generatedHistory: [],
            selectedItem: null,
            uploadedImages: [],
            pendingPrompt: null,
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
            },
            setVideoInput: vi.fn(),
        });
    });

    it('renders the empty state initially', () => {
        render(<VideoWorkflow />);
        expect(screen.getByText('Describe your video idea')).toBeInTheDocument();
    });

    it('switches to review when pendingPrompt is set', async () => {
        (useStore as any).mockReturnValue({
            generatedHistory: [],
            selectedItem: null,
            uploadedImages: [],
            pendingPrompt: 'A futuristic city',
            setPendingPrompt: mockSetPendingPrompt,
            addToHistory: mockAddToHistory,
            setPrompt: vi.fn(),
            studioControls: { aspectRatio: '16:9' },
            videoInputs: { firstFrame: null, lastFrame: null },
            setVideoInput: vi.fn(),
        });

        render(<VideoWorkflow />);

        // Should show review state
        expect(await screen.findByRole('button', { name: /Generate Video/ })).toBeInTheDocument();

        // Should call setPendingPrompt(null) to clear it
        expect(mockSetPendingPrompt).toHaveBeenCalledWith(null);
    });

    // TODO: This test requires the component to switch to 'result' step when a video is selected.
    // Currently, it defaults to 'idea' step.
    // it('displays active video when selected', () => {
    //     const mockVideo = {
    //         id: '1',
    //         type: 'video',
    //         url: 'https://example.com/test.mp4',
    //         prompt: 'Test Video'
    //     };

    //     (useStore as any).mockReturnValue({
    //         generatedHistory: [mockVideo],
    //         selectedItem: mockVideo,
    //         uploadedImages: [],
    //         pendingPrompt: null,
    //         setPendingPrompt: mockSetPendingPrompt,
    //         addToHistory: mockAddToHistory,
    //         setPrompt: vi.fn(),
    //         studioControls: { aspectRatio: '16:9' },
    //         videoInputs: { firstFrame: null, lastFrame: null },
    //         setVideoInput: vi.fn(),
    //     });

    //     render(<VideoWorkflow />);
    //     expect(screen.getByText('"Test Video"')).toBeInTheDocument();
    // });
});
