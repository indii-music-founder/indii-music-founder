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

// The component uses httpsCallable.
const mockHttpsCallableFn = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockHttpsCallableFn,
    getFunctions: vi.fn()
}));

// Mock the INTELLIGENCE_MODELS config that the component also imports dynamically.
vi.mock('@/core/config/intelligence-models', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/core/config/intelligence-models')>();
    return {
        ...actual,
        INTELLIGENCE_MODELS: {
            ...actual.INTELLIGENCE_MODELS,
            IMAGE: {
                DIRECT_PRO: 'gemini-3-pro-image-preview',
                DIRECT_FAST: 'gemini-3-flash-preview'
            }
        }
    };
});

const mockGenerateVideo = vi.fn();
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        subscribeToJob: vi.fn(() => () => {})
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
        prompt: '',
        setPrompt: vi.fn(),
        creativePrompt: '',
        setCreativePrompt: vi.fn(),
        isPromptBuilderOpen: false,
        togglePromptBuilder: vi.fn(),
        addToHistory: vi.fn(),
        currentProjectId: 'test-project',
        whiskState: {},
        setSelectedItem: vi.fn(),
        setViewMode: vi.fn(),
        generationMode: 'image',
        setGenerationMode: vi.fn()
    };

    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        (useStore as unknown as import("vitest").Mock).mockReturnValue(mockStore);
    });

    it('displays loading state while generating image', async () => {
        let resolveGeneration: (value: any) => void;
        const generationPromise = new Promise((resolve) => {
            resolveGeneration = resolve;
        });

        mockHttpsCallableFn.mockReturnValue(generationPromise);

        (useStore as unknown as import("vitest").Mock).mockReturnValue({
            ...mockStore,
            creativePrompt: 'A cute cat'
        });

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

        // Resolve generation — component expects { data: { jobId: ... } }
        await act(async () => {
            resolveGeneration!({ data: { jobId: 'mock-job' } });
        });

        // Assert success state
        await waitFor(() => {
            expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(mockToast.info).toHaveBeenCalledWith('Image job queued. Check gallery for progress.');
        });
    });

    it('handles generation error correctly', async () => {
        mockHttpsCallableFn.mockRejectedValue(new Error('API Error'));

        (useStore as unknown as import("vitest").Mock).mockReturnValue({
            ...mockStore,
            creativePrompt: 'A crash test'
        });

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
