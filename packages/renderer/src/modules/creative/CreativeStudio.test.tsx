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
vi.mock('./components/DirectGenerationTab', () => ({ default: () => <div data-testid="direct-generation-tab" /> }));
vi.mock('../../core/components/AgentWindow', () => ({ default: () => <div data-testid="agent-window" /> }));
vi.mock('./components/InfiniteCanvas', () => ({ default: () => <div data-testid="infinite-canvas" /> }));
vi.mock('./components/Showroom', () => ({ default: () => <div data-testid="showroom" /> }));
vi.mock('../video/VideoWorkflow', () => ({ default: () => <div data-testid="video-workflow" /> }));

let capturedOnSendToWorkflow: any = null;
vi.mock('./components/CreativeCanvas', () => ({
    default: (props: any) => {
        capturedOnSendToWorkflow = props.onSendToWorkflow;
        return <div data-testid="creative-canvas" />;
    }
}));

const mockConfirmCall = vi.fn();
vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: {
        call: (...args: any[]) => mockConfirmCall(...args)
    }
}));

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
        capturedOnSendToWorkflow = null;
        // Reset all mocks to initial state
        mockSetPrompt.mockClear();
        mockSetPendingPrompt.mockClear();
        mockAddToHistory.mockClear();
        mockToastInfo.mockClear();
        mockToastSuccess.mockClear();
        mockToastError.mockClear();
        mockConfirmCall.mockClear();
        mockGenerateImages.mockClear();

        (useToast as unknown as import("vitest").Mock).mockReturnValue({
            info: mockToastInfo,
            success: mockToastSuccess,
            error: mockToastError
        });

        const storeState = {
            viewMode: 'direct',
            setViewMode: vi.fn(),
            selectedItem: null,
            setSelectedItem: vi.fn(),
            generationMode: 'image',
            setGenerationMode: vi.fn(),
            setVideoInput: vi.fn(),
            pendingPrompt: null,
            setPendingPrompt: mockSetPendingPrompt,
            setPrompt: mockSetPrompt,
            setCreativePrompt: mockSetPrompt,
            creativePrompt: '',
            setIsGenerating: vi.fn(),
            isGenerating: false,
            studioControls: {
                resolution: '1024x1024',
                aspectRatio: '1:1',
                negativePrompt: '',
                personGeneration: 'allow_adult',
                model: 'fast',
                seed: ''
            },
            prompt: '',
            addToHistory: mockAddToHistory,
            currentProjectId: 'test-project',
            userProfile: null,
            characterReferences: [],
            chatImportContext: null,
            clearChatImportContext: vi.fn(),
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
            setPreciseReference: vi.fn(),
            setHasUnsavedChanges: vi.fn(),
            initializeDesignHistory: vi.fn().mockResolvedValue(undefined)
        };

        (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
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
        expect(screen.getByTestId('direct-generation-tab')).toBeInTheDocument();
    });

    it('triggers image generation when pendingPrompt is set', async () => {
        const currentStore = (useStore as any).getState();
        const updatedStore = {
            ...currentStore,
            pendingPrompt: 'test prompt',
            generationMode: 'image'
        };

        (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
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
            expect(mockGenerateImages).toHaveBeenCalledWith(expect.objectContaining({
                prompt: 'test prompt',
                count: 1,
                resolution: '1024x1024',
                aspectRatio: '1:1',
                negativePrompt: '',
                personGeneration: 'ALLOW_ADULT'
            }));
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

        (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
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
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Image generation failed'));
        });
    });

    it('shows confirmation dialog when sending image to video workflow', async () => {
        const setVideoInput = vi.fn();
        const setGenerationMode = vi.fn();
        const setViewMode = vi.fn();
        const setSelectedItem = vi.fn();

        const currentStore = (useStore as any).getState();
        const updatedStore = {
            ...currentStore,
            viewMode: 'editor',
            selectedItem: {
                id: 'img-123',
                url: 'http://test.com/img.png',
                type: 'image' as const,
                prompt: 'test image',
                timestamp: Date.now(),
                projectId: 'proj-123'
            },
            setVideoInput,
            setGenerationMode,
            setViewMode,
            setSelectedItem
        };

        (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
            if (selector && typeof selector === 'function') {
                return selector(updatedStore);
            }
            return updatedStore;
        });
        (useStore as any).getState.mockReturnValue(updatedStore);

        render(<CreativeStudio />);
        expect(screen.getByTestId('creative-canvas')).toBeInTheDocument();
        expect(capturedOnSendToWorkflow).toBeTypeOf('function');

        // Test Scenario 1: Cancel
        mockConfirmCall.mockResolvedValueOnce(false);
        await capturedOnSendToWorkflow('firstFrame', updatedStore.selectedItem);

        expect(mockConfirmCall).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Send to Video Editor?',
            confirmText: 'Yes, Send to Video'
        }));
        expect(setVideoInput).not.toHaveBeenCalled();

        // Test Scenario 2: Confirm
        mockConfirmCall.mockResolvedValueOnce(true);
        await capturedOnSendToWorkflow('firstFrame', updatedStore.selectedItem);

        expect(setVideoInput).toHaveBeenCalledWith('firstFrame', updatedStore.selectedItem);
        expect(setGenerationMode).toHaveBeenCalledWith('video');
        expect(setViewMode).toHaveBeenCalledWith('video_production');
        expect(setSelectedItem).toHaveBeenCalledWith(null);
        expect(mockToastSuccess).toHaveBeenCalledWith('Set as Start Frame');
    });
});
