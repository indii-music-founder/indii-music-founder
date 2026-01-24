import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DirectGenerationTab from './DirectGenerationTab';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast
}));

const mockGenerateImages = vi.fn();
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: (...args: any[]) => mockGenerateImages(...args)
    }
}));

const mockGenerateVideo = vi.fn();
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args)
    }
}));

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        synthesizeWhiskPrompt: (prompt: string) => prompt,
        synthesizeVideoPrompt: (prompt: string) => prompt
    }
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Loader2: ({ className }: { className: string }) => <div data-testid="loader" className={className}>Loading...</div>,
    Image: () => <div data-testid="icon-image">Image</div>,
    Video: () => <div data-testid="icon-video">Video</div>,
    Send: () => <div data-testid="icon-send">Send</div>,
    Settings2: () => <div>Settings</div>,
    Download: () => <div>Download</div>
}));

describe('DirectGenerationTab', () => {
    const mockStore = {
        studioControls: {
            aspectRatio: '1:1',
            resolution: '1024x1024',
            model: 'fast',
            mediaResolution: 'medium',
            thinking: false
        },
        setPrompt: vi.fn(),
        addToHistory: vi.fn(),
        currentProjectId: 'test-project',
        whiskState: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(mockStore);
    });

    it('displays loading state while generating image', async () => {
        let resolveGeneration: (value: any) => void;
        const generationPromise = new Promise((resolve) => {
            resolveGeneration = resolve;
        });

        mockGenerateImages.mockReturnValue(generationPromise);

        render(<DirectGenerationTab />);

        // Type prompt
        const input = screen.getByPlaceholderText('Describe your image...');
        fireEvent.change(input, { target: { value: 'A cute cat' } });

        // Click generate
        const sendButton = screen.getByTestId('icon-send').parentElement as HTMLButtonElement;
        fireEvent.click(sendButton);

        // Assert loading state
        expect(screen.getByTestId('loader')).toBeInTheDocument();
        expect(sendButton).toBeDisabled();

        // Resolve generation
        await act(async () => {
            resolveGeneration!([{
                id: 'img-1',
                url: 'https://example.com/cat.jpg',
                prompt: 'A cute cat',
                timestamp: Date.now()
            }]);
        });

        // Assert success state
        await waitFor(() => {
            expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        });

        expect(screen.getByAltText('A cute cat')).toBeInTheDocument();
        expect(mockToast.success).toHaveBeenCalledWith('Image generated successfully');
    });

    it('handles generation error correctly', async () => {
        mockGenerateImages.mockRejectedValue(new Error('API Error'));

        render(<DirectGenerationTab />);

        const input = screen.getByPlaceholderText('Describe your image...');
        fireEvent.change(input, { target: { value: 'A crash test' } });

        const sendButton = screen.getByTestId('icon-send').parentElement as HTMLButtonElement;
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Generation failed: API Error'));
        });

        expect(screen.getByTestId('icon-send')).toBeInTheDocument();
        expect(sendButton).not.toBeDisabled();
    });
});
