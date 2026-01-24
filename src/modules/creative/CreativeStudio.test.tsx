import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CreativeStudio from './CreativeStudio';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('./components/CreativeNavbar', () => ({ default: () => <div data-testid="creative-navbar" /> }));
vi.mock('./components/CreativeGallery', () => ({ default: () => <div data-testid="creative-gallery" /> }));
vi.mock('../../core/components/AgentWindow', () => ({ default: () => <div data-testid="agent-window" /> }));
vi.mock('./components/InfiniteCanvas', () => ({ default: () => <div data-testid="infinite-canvas" /> }));
vi.mock('./components/Showroom', () => ({ default: () => <div data-testid="showroom" /> }));
vi.mock('../video/VideoWorkflow', () => ({ default: () => <div data-testid="video-workflow" /> }));
vi.mock('./components/CreativeCanvas', () => ({ default: () => <div data-testid="creative-canvas" /> }));

// Mock ImageGenerationService
const mockGenerateImages = vi.fn();
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: (...args: any[]) => mockGenerateImages(...args)
    }
}));

describe('CreativeStudio', () => {
    const mockSetPrompt = vi.fn();
    const mockSetPendingPrompt = vi.fn();
    const mockAddToHistory = vi.fn();
    const mockToastInfo = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            info: mockToastInfo,
            success: mockToastSuccess,
            error: mockToastError
        });

        const storeState = {
            viewMode: 'gallery',
            setViewMode: vi.fn(),
            selectedItem: null,
            setSelectedItem: vi.fn(),
            generationMode: 'image',
            setGenerationMode: vi.fn(),
            pendingPrompt: null,
            setPendingPrompt: mockSetPendingPrompt,
            setPrompt: mockSetPrompt,
            setIsGenerating: vi.fn(), // Added missing property
            isGenerating: false,
            studioControls: {
                resolution: '1024x1024',
                aspectRatio: '1:1',
                negativePrompt: '',
                seed: ''
            },
            prompt: '',
            addToHistory: mockAddToHistory,
            currentProjectId: 'test-project',
            // Whisk Mocks
            whiskState: {
                subjects: [],
                scenes: [],
                styles: [],
                preciseReference: false
            },
            addWhiskItem: vi.fn(),
            removeWhiskItem: vi.fn(),
            toggleWhiskItem: vi.fn(),
            updateWhiskItem: vi.fn(),
            setPreciseReference: vi.fn()
        };

        (useStore as any).mockImplementation((selector: any) => {
            if (selector && typeof selector === 'function') {
                return selector(storeState);
            }
            return storeState;
        });
        (useStore as any).getState = vi.fn().mockReturnValue(storeState);
        (useStore as any).setState = vi.fn();
    });

    it('renders correctly', () => {
        render(<CreativeStudio />);
        expect(screen.getByTestId('creative-navbar')).toBeInTheDocument();
        expect(screen.getByTestId('creative-gallery')).toBeInTheDocument();
    });

    it('triggers image generation when pendingPrompt is set', async () => {
        const currentStore = (useStore as any).getState();
        const updatedStore = {
            ...currentStore,
            pendingPrompt: 'test prompt',
            generationMode: 'image'
        };

        (useStore as any).mockImplementation((selector: any) => {
            if (selector && typeof selector === 'function') {
                return selector(updatedStore);
            }
            return updatedStore;
        });
        (useStore as any).getState.mockReturnValue(updatedStore);

        mockGenerateImages.mockResolvedValue([{
            id: 'img-1',
            url: 'http://test.com/img.png',
            prompt: 'test prompt'
        }]);

        render(<CreativeStudio />);

        await waitFor(() => {
            expect(mockToastInfo).toHaveBeenCalledWith('Generating image...');
        });

        await waitFor(() => {
            expect(mockGenerateImages).toHaveBeenCalledWith({
                prompt: 'test prompt',
                count: 1,
                resolution: '1024x1024',
                aspectRatio: '1:1',
                negativePrompt: '',
                seed: undefined
            });
        });

        await waitFor(() => {
            expect(mockAddToHistory).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Image generated!');
            expect(mockSetPendingPrompt).toHaveBeenCalledWith(null);
        });
    });

    it('handles generation errors gracefully', async () => {
        const currentStore = (useStore as any).getState();
        const updatedStore = {
            ...currentStore,
            pendingPrompt: 'fail prompt',
            generationMode: 'image'
        };

        (useStore as any).mockImplementation((selector: any) => {
            if (selector && typeof selector === 'function') {
                return selector(updatedStore);
            }
            return updatedStore;
        });
        (useStore as any).getState.mockReturnValue(updatedStore);

        mockGenerateImages.mockRejectedValue(new Error('Generation failed'));

        render(<CreativeStudio />);

        await waitFor(() => {
            expect(mockToastInfo).toHaveBeenCalledWith('Generating image...');
        });

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith('Image generation failed.');
        });
    });
});
