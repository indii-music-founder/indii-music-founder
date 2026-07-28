import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const mockCampaignCall = vi.fn();
vi.mock('@/components/ui/CampaignConfigDialog', () => ({
    CampaignConfigDialog: {
        call: (...args: any[]) => mockCampaignCall(...args)
    }
}));

// Mock ImageGenerationService
const mockGenerateImages = vi.fn();
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: (...args: any[]) => mockGenerateImages(...args)
    }
}));

const mockGenerateVideo = vi.fn();
const mockWaitForJob = vi.fn();
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGenerationService: class {
        generateVideo = (...args: any[]) => mockGenerateVideo(...args);
        waitForJob = (...args: any[]) => mockWaitForJob(...args);
    },
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        waitForJob: (...args: any[]) => mockWaitForJob(...args)
    }
}));

const mockDeployPlpPipeline = vi.fn();
vi.mock('@/services/marketing/AdAutomationService', () => ({
    adAutomationService: {
        deployPLPPipeline: (...args: any[]) => mockDeployPlpPipeline(...args)
    }
}));

describe('CreativeStudio', () => {
    const mockSetPrompt = vi.fn();
    const mockSetPendingPrompt = vi.fn();
    const mockAddToHistory = vi.fn();
    const mockToastInfo = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastError = vi.fn();
    const mockToastWarning = vi.fn();

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
        mockCampaignCall.mockClear();
        mockGenerateImages.mockClear();
        mockGenerateVideo.mockClear();
        mockWaitForJob.mockClear();
        mockDeployPlpPipeline.mockClear();

        (useToast as unknown as import("vitest").Mock).mockReturnValue({
            info: mockToastInfo,
            success: mockToastSuccess,
            error: mockToastError,
            warning: mockToastWarning
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
        expect(screen.getByTestId('creative-mode-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('adaptive-workspace')).toHaveAttribute('data-workspace-mode', 'wide');
    });

    it('does not mount a pointer-enabled mode overlay above Image Studio', () => {
        const currentStore = (useStore as any).getState();
        const canvasStore = {
            ...currentStore,
            viewMode: 'canvas',
            canvasImages: [],
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) =>
            selector ? selector(canvasStore) : canvasStore
        );
        (useStore as any).getState.mockReturnValue(canvasStore);

        render(<CreativeStudio />);

        expect(screen.getByTestId('infinite-canvas')).toBeInTheDocument();
        expect(screen.queryByTestId('creative-mode-overlay')).not.toBeInTheDocument();
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

    it('keeps queued PLP videos visible, retries only the failed slot, and launches only playable results', async () => {
        const currentStore = (useStore as any).getState();
        const updatedStore = {
            ...currentStore,
            pendingPrompt: 'release campaign',
            generationMode: 'image',
            studioControls: { ...currentStore.studioControls, isPLPMode: true }
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) =>
            selector ? selector(updatedStore) : updatedStore
        );
        (useStore as any).getState.mockReturnValue(updatedStore);

        mockGenerateImages.mockImplementation(async ({ prompt }: { prompt: string }) => {
            const iteration = prompt.match(/variant iteration (\d+)/)?.[1] ?? 'unknown';
            return [{ id: `image-${iteration}`, url: `https://cdn.example/image-${iteration}.png`, prompt }];
        });
        mockGenerateVideo.mockImplementation(async ({ prompt }: { prompt: string }) => {
            const attempt = mockGenerateVideo.mock.calls.length;
            return [{ id: `video-job-${attempt}`, url: '', prompt }];
        });

        const pendingJobs: Array<{
            resolve: (job: { output: { url: string } }) => void;
            reject: (error: Error) => void;
        }> = [];
        mockWaitForJob.mockImplementation(() => new Promise((resolve, reject) => {
            pendingJobs.push({ resolve, reject });
        }));

        render(<CreativeStudio />);

        await waitFor(() => expect(mockWaitForJob).toHaveBeenCalledTimes(5));
        expect(screen.getByLabelText('PLP batch status')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('10 completed')).toBeInTheDocument();
            expect(screen.getByText('5 queued')).toBeInTheDocument();
        });
        expect(mockCampaignCall).not.toHaveBeenCalled();

        await act(async () => {
            pendingJobs.slice(0, 4).forEach((job, index) => job!.resolve({
                output: { url: `https://cdn.example/video-${index + 1}.mp4` }
            }));
            pendingJobs[4]!.reject(new Error('Provider render failed.'));
        });

        await waitFor(() => {
            expect(screen.getByText('14 completed')).toBeInTheDocument();
            expect(screen.getByText('1 failed')).toBeInTheDocument();
        });
        expect(mockAddToHistory).toHaveBeenCalledTimes(14);
        expect(mockAddToHistory.mock.calls.every(([item]) => Boolean(item.url))).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Retry Video 5' }));
        await waitFor(() => expect(mockWaitForJob).toHaveBeenCalledTimes(6));
        await act(async () => {
            pendingJobs[5]!.resolve({ output: { url: 'https://cdn.example/video-5-retry.mp4' } });
        });

        await waitFor(() => expect(screen.getByText('15 completed')).toBeInTheDocument());
        expect(mockAddToHistory).toHaveBeenCalledTimes(15);
        expect(new Set(mockAddToHistory.mock.calls.map(([item]) => item.id)).size).toBe(15);
        expect(mockAddToHistory.mock.calls.every(([item]) => item.projectId === 'test-project')).toBe(true);

        mockCampaignCall.mockResolvedValue({
            dailyBudget: 20,
            totalDays: 3,
            targetAgeMin: 18,
            targetAgeMax: 44,
            targetInterests: ['independent music'],
            headline: 'Listen now',
            body: 'New release available',
        });
        mockDeployPlpPipeline.mockResolvedValue({ campaignId: 'campaign-1' });
        fireEvent.click(screen.getByRole('button', { name: 'Review and launch 15 eligible variants' }));

        await waitFor(() => expect(mockDeployPlpPipeline).toHaveBeenCalledTimes(1));
        const [creatives] = mockDeployPlpPipeline.mock.calls[0]!;
        expect(creatives).toHaveLength(15);
        expect(new Set(creatives.map((creative: { creativeId: string }) => creative.creativeId)).size).toBe(15);
        expect(screen.getByRole('button', { name: 'Campaign launched' })).toBeDisabled();
    });

    describe('ISSUE-1007: cover-art distributor compliance', () => {
        class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            naturalWidth = 0;
            naturalHeight = 0;
            private _src = '';
            set src(value: string) {
                this._src = value;
                const [w, h] = value.split('x').map(Number);
                this.naturalWidth = w || 0;
                this.naturalHeight = h || 0;
                queueMicrotask(() => this.onload?.());
            }
            get src() { return this._src; }
        }

        beforeEach(() => {
            vi.stubGlobal('Image', MockImage as unknown as typeof Image);
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                blob: async () => new Blob(['cover-art-bytes'], { type: 'image/png' }),
            }));
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('marks a compliant cover art image as meeting distributor requirements', async () => {
            const currentStore = (useStore as any).getState();
            const updatedStore = {
                ...currentStore,
                pendingPrompt: 'cover art prompt',
                generationMode: 'image',
                userProfile: { id: 'u1', brandKit: {} },
                studioControls: { ...currentStore.studioControls, isCoverArtMode: true }
            };
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) =>
                selector ? selector(updatedStore) : updatedStore
            );
            (useStore as any).getState.mockReturnValue(updatedStore);

            // Encodes real measured dimensions into the mock Image's fake "src" for the test.
            mockGenerateImages.mockResolvedValue([{ id: 'img-1', url: '3000x3000', prompt: 'cover art prompt' }]);

            render(<CreativeStudio />);

            await waitFor(() => {
                expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                    distributorCompliance: expect.objectContaining({
                        valid: true,
                        measuredWidth: 3000,
                        measuredHeight: 3000,
                        mimeType: 'image/png',
                        sizeBytes: 15,
                        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
                    })
                }));
            });
            expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('meets distributor size requirements'));
        });

        it('flags an undersized cover art image instead of declaring it compliant', async () => {
            const currentStore = (useStore as any).getState();
            const updatedStore = {
                ...currentStore,
                pendingPrompt: 'cover art prompt',
                generationMode: 'image',
                userProfile: { id: 'u1', brandKit: {} },
                studioControls: { ...currentStore.studioControls, isCoverArtMode: true }
            };
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) =>
                selector ? selector(updatedStore) : updatedStore
            );
            (useStore as any).getState.mockReturnValue(updatedStore);

            // A 512x512 fallback-compressed preview — well under the 3000x3000 minimum.
            mockGenerateImages.mockResolvedValue([{ id: 'img-1', url: '512x512', prompt: 'cover art prompt' }]);

            render(<CreativeStudio />);

            await waitFor(() => {
                expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                    distributorCompliance: expect.objectContaining({ valid: false })
                }));
            });
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('does not meet distributor requirements'));
            expect(mockToastSuccess).not.toHaveBeenCalledWith(expect.stringContaining('meets distributor'));
        });

        it('fails closed when the generated file cannot be measured', async () => {
            class BrokenImage {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
            }
            vi.stubGlobal('Image', BrokenImage as unknown as typeof Image);

            const currentStore = (useStore as any).getState();
            const updatedStore = {
                ...currentStore,
                pendingPrompt: 'cover art prompt',
                generationMode: 'image',
                userProfile: { id: 'u1', brandKit: {} },
                studioControls: { ...currentStore.studioControls, isCoverArtMode: true }
            };
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) =>
                selector ? selector(updatedStore) : updatedStore
            );
            (useStore as any).getState.mockReturnValue(updatedStore);
            mockGenerateImages.mockResolvedValue([{ id: 'img-1', url: 'unreadable-image', prompt: 'cover art prompt' }]);

            render(<CreativeStudio />);

            await waitFor(() => {
                expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                    distributorCompliance: expect.objectContaining({ valid: false, measuredWidth: 0, measuredHeight: 0 })
                }));
            });
            expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Could not verify'));
            expect(mockToastSuccess).not.toHaveBeenCalledWith(expect.stringContaining('meets distributor'));
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
