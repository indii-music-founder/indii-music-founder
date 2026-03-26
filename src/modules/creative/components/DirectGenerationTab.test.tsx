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

// The component dynamically imports DirectImageGenerator — mock it so the
// dynamic import resolves to our spy.
const mockGenerateImageDirectly = vi.fn();
vi.mock('@/services/ai/generators/DirectImageGenerator', () => ({
    generateImageDirectly: (...args: any[]) => mockGenerateImageDirectly(...args)
}));

// Mock the AI_MODELS config that the component also imports dynamically.
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        IMAGE: {
            DIRECT_PRO: 'gemini-3-pro-image-preview',
            DIRECT_FAST: 'gemini-3-flash-preview'
        }
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
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
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
        whiskState: {},
        setSelectedItem: vi.fn()
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

        // generateImageDirectly returns an array of URL strings (data URIs in production)
        mockGenerateImageDirectly.mockReturnValue(generationPromise);

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

        // Resolve generation — component expects an array of URL strings
        await act(async () => {
            resolveGeneration!(['https://example.com/cat.jpg']);
        });

        // Assert success state
        await waitFor(() => {
            expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        });

        expect(screen.getByAltText('A cute cat')).toBeInTheDocument();
        expect(mockToast.success).toHaveBeenCalledWith('Image generated directly successfully');
    });

    it('handles generation error correctly', async () => {
        mockGenerateImageDirectly.mockRejectedValue(new Error('API Error'));

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
