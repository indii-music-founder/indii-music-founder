import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DirectGenerationTab from '../DirectGenerationTab';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

const { mockUploadReferenceMedia, mockGenerateImages, mockWorkspaceLayout } = vi.hoisted(() => ({
    mockUploadReferenceMedia: vi.fn(),
    mockGenerateImages: vi.fn(),
    mockWorkspaceLayout: { mode: 'wide' as 'wide' | 'standard' | 'focused', width: 1440 },
}));
vi.mock('@/components/layout/AdaptiveWorkspaceContext', () => ({
    useOptionalAdaptiveWorkspace: () => mockWorkspaceLayout,
}));
vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: { uploadReferenceMedia: mockUploadReferenceMedia },
}));
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: mockGenerateImages },
}));

// Mock dependencies
const mockToastObject = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => mockToastObject)
}));

const mockHttpsCallable = vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } });
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: () => mockHttpsCallable
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        doc: vi.fn(),
        onSnapshot: vi.fn((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    data: () => ({
                        status: 'completed',
                        progress: 100,
                        resultUri: 'https://test.com/video.mp4'
                    })
                });
            }, 10);
            return () => {};
        })
    };
});

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(),
    ref: vi.fn(),
    getDownloadURL: vi.fn().mockResolvedValue('https://test.com/video.mp4')
}));

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        synthesizeWhiskPrompt: vi.fn((p) => p),
        synthesizeVideoPrompt: vi.fn((p) => p),
        getSourceMedia: vi.fn(() => [])
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn().mockResolvedValue([{ id: 'mock-job-id', url: '', prompt: 'A cinematic drone shot' }]),
        subscribeToJob: vi.fn((jobId, callback) => {
            setTimeout(() => {
                callback({
                    id: jobId,
                    status: 'completed',
                    progress: 100,
                    videoUrl: 'https://test.com/video.mp4',
                    output: {
                        url: 'https://test.com/video.mp4',
                        metadata: { mime_type: 'video/mp4', quality: 'pro' }
                    }
                });
            }, 10);
            return () => {};
        })
    }
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((uri: string) => Promise.resolve(uri)),
}));

import { create } from 'zustand';

const useMockStore = create<any>((set) => ({
    studioControls: { model: 'fast', aspectRatio: '16:9', resolution: '1080p', duration: 6, personGeneration: 'allow_adult', negativePrompt: '', seed: '' },
    setStudioControls: (patch: Record<string, unknown>) => set((state: any) => ({ studioControls: { ...state.studioControls, ...patch } })),
    creativePrompt: '',
    setCreativePrompt: (val: string) => set({ creativePrompt: val }),
    addToHistory: vi.fn((item) => set((state: any) => ({ generatedHistory: [...(state.generatedHistory || []), item] }))),
    currentProjectId: 'test-project',
    whiskState: {},
    setSelectedItem: vi.fn(),
    setViewMode: vi.fn(),
    videoInputs: { ingredients: [] },
    setVideoInputs: vi.fn(),
    generationMode: 'image',
    setGenerationMode: (val: string) => set({ generationMode: val }),
    isPromptBuilderOpen: false,
    togglePromptBuilder: () => set((state: any) => ({ isPromptBuilderOpen: !state.isPromptBuilderOpen })),
    characterReferences: [],
    addCharacterReference: vi.fn(),
    removeCharacterReference: vi.fn(),
    updateCharacterReference: vi.fn(),
    addUploadedImage: vi.fn().mockResolvedValue(true),
    generatedHistory: []
}));

// Use a simplified store mock
vi.mock('@/core/store', () => ({
    useStore: (selector: any) => useMockStore(selector),
    logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}));

// Mock dynamic import for DirectImageGenerator
vi.mock('@/services/intelligence/generators/DirectImageGenerator', () => ({
    generateImageDirectly: vi.fn()
}));

describe('DirectGenerationTab', () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        vi.mocked(resolveStorageUrl).mockImplementation((uri: string) => Promise.resolve(uri));
        mockWorkspaceLayout.mode = 'wide';
        mockWorkspaceLayout.width = 1440;
        mockUploadReferenceMedia.mockResolvedValue('gs://test-bucket/creative/test-user/references/selected-project-image.png');
        mockGenerateImages.mockResolvedValue([{
            id: 'mock-job-id',
            url: 'https://test.com/image.png',
            prompt: 'Generated image',
        }]);
        useMockStore.setState({
            studioControls: {
                model: 'fast',
                aspectRatio: '16:9',
                resolution: '1080p',
                duration: 6,
                personGeneration: 'allow_adult',
                negativePrompt: '',
                seed: '',
                imageSize: '2K',
                batchCount: 1,
                thinkingLevel: 'none',
                includeThoughts: false,
                useGrounding: false,
                useImageSearch: false,
                responseFormat: 'image_only',
            },
            creativePrompt: '',
            currentProjectId: 'test-project',
            whiskState: {},
            videoInputs: { ingredients: [] },
            generationMode: 'image',
            isPromptBuilderOpen: false,
            characterReferences: [],
            generatedHistory: []
        });
    });

    it('renders initial state correctly', () => {
        render(<DirectGenerationTab />);
        expect(screen.getByPlaceholderText(/Describe your image/i)).toBeDefined();
        expect(screen.getByTestId('direct-image-mode-btn')).toBeDefined();
        expect(screen.getByTestId('direct-video-mode-btn')).toBeDefined();
    });

    it('uses the measured workspace mode instead of viewport breakpoints', () => {
        mockWorkspaceLayout.mode = 'focused';
        mockWorkspaceLayout.width = 720;

        render(<DirectGenerationTab />);

        expect(screen.getByTestId('direct-generation-workspace')).toHaveAttribute('data-workspace-mode', 'focused');
        expect(screen.getByTestId('direct-generation-workspace')).toHaveClass('flex-col');
        expect(screen.getByTestId('direct-generation-controls')).toHaveClass('w-full');
        expect(screen.getByTestId('direct-generation-results')).toHaveClass('min-w-0');
    });

    it('switches between image and video modes', () => {
        render(<DirectGenerationTab />);
        const videoBtn = screen.getByTestId('direct-video-mode-btn');
        const imageBtn = screen.getByTestId('direct-image-mode-btn');

        fireEvent.click(videoBtn);
        expect(screen.getByPlaceholderText(/Describe your video/i)).toBeDefined();

        fireEvent.click(imageBtn);
        expect(screen.getByPlaceholderText(/Describe your image/i)).toBeDefined();
    });

    it('ISSUE-788: only shows Veo-effective aspect ratios (16:9/9:16) in video mode', () => {
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));

        expect(screen.getByText('Cinema')).toBeInTheDocument(); // 16:9
        expect(screen.getByText('Vertical')).toBeInTheDocument(); // 9:16
        expect(screen.queryByText('Square')).not.toBeInTheDocument(); // 1:1 — coerced to 16:9 server-side
        expect(screen.queryByText('Classic')).not.toBeInTheDocument(); // 4:3
        expect(screen.queryByText('Portrait')).not.toBeInTheDocument(); // 3:4
    });

    /**
     * ISSUE-777: the Advanced Config panel used to render "Engine Resolution
     * Preset" (bound to studioControls.resolution) and "Safety Policy Grade"
     * (bound to personGeneration) in BOTH modes, but handleImageGenerate
     * (useDirectGeneration.ts) only ever sends imageSize/model/aspectRatio —
     * resolution and personGeneration never reach the image payload, and
     * GenerateImageSchema has no personGeneration field at all. These prove
     * each control now only appears where it actually affects the request.
     */
    it('ISSUE-777: image mode shows Image Output Size, hides video-only Resolution/Safety controls', () => {
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-image-mode-btn'));
        fireEvent.click(screen.getByText('Advanced Config'));

        expect(screen.getByText('Image Output Size')).toBeInTheDocument();
        expect(screen.queryByText('Engine Resolution Preset')).not.toBeInTheDocument();
        expect(screen.queryByText('Safety Policy Grade')).not.toBeInTheDocument();
    });

    it('ISSUE-777: video mode shows Resolution/Safety controls, hides image-only Image Output Size', () => {
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));
        fireEvent.click(screen.getByText('Advanced Config'));

        expect(screen.getByText('Engine Resolution Preset')).toBeInTheDocument();
        expect(screen.getByText('Safety Policy Grade')).toBeInTheDocument();
        expect(screen.queryByText('Image Output Size')).not.toBeInTheDocument();
    });

    it('ISSUE-777: visible image controls change the metered outbound generation request', async () => {
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByText('Advanced Config'));
        fireEvent.click(screen.getByText('1K'));
        fireEvent.click(screen.getByTestId('direct-batch-3'));
        fireEvent.click(screen.getByTestId('direct-response-image_and_text'));
        fireEvent.click(screen.getByTestId('direct-thinking-minimal'));
        fireEvent.click(screen.getByTestId('direct-include-thoughts-toggle'));
        fireEvent.click(screen.getByTestId('direct-google-search-toggle'));
        fireEvent.click(await screen.findByTestId('direct-image-search-toggle'));
        fireEvent.change(screen.getByTestId('direct-prompt-input'), {
            target: { value: 'Grounded three-image concept set' },
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockGenerateImages).toHaveBeenCalledWith(expect.objectContaining({
                prompt: 'Grounded three-image concept set',
                count: 3,
                imageSize: '1k',
                thinkingLevel: 'minimal',
                includeThoughts: true,
                useGoogleSearch: true,
                useImageSearch: true,
                responseFormat: 'image_and_text',
            }));
        });
    });

    it('ISSUE-788: shows all aspect ratios again in image mode (no Veo restriction)', () => {
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));
        fireEvent.click(screen.getByTestId('direct-image-mode-btn'));

        expect(screen.getByText('Square')).toBeInTheDocument();
        expect(screen.getByText('Classic')).toBeInTheDocument();
        expect(screen.getByText('Portrait')).toBeInTheDocument();
    });

    it('ISSUE-788: snaps aspectRatio to 16:9 when switching into video mode with an image-only ratio selected', async () => {
        useMockStore.setState({ studioControls: { ...useMockStore.getState().studioControls, aspectRatio: '4:3' } });
        render(<DirectGenerationTab />);

        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));

        await waitFor(() => {
            expect(useMockStore.getState().studioControls.aspectRatio).toBe('16:9');
        });
    });

    it('ISSUE-788: only offers 4/6/8-second durations in video mode, never 10s', () => {
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));

        expect(screen.getByText('4s')).toBeInTheDocument();
        expect(screen.getByText('6s')).toBeInTheDocument();
        expect(screen.getByText('8s')).toBeInTheDocument();
        expect(screen.queryByText('10s')).not.toBeInTheDocument();
    });

    it('handles image generation successfully', async () => {
        vi.useFakeTimers();
        render(<DirectGenerationTab />);
        
        // Ensure image mode is selected
        const imageBtn = screen.getByTestId('direct-image-mode-btn');
        fireEvent.click(imageBtn);
        
        const input = screen.getByTestId('direct-prompt-input');
        const generateBtn = screen.getByTestId('direct-generate-btn');

        fireEvent.change(input, { target: { value: 'A beautiful landscape' } });

        await act(async () => {
            fireEvent.click(generateBtn);
        });

        expect(mockGenerateImages).toHaveBeenCalled();
        const imagePayload = mockGenerateImages.mock.calls[0]?.[0];
        expect(imagePayload).not.toHaveProperty('referenceUri');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3010);
        });

        // Results grid should show the image
        const img = document.querySelector('img');
        expect(img).toBeTruthy();
    });

    it('ISSUE-776: sends the selected image handoff as referenceUris to generateImageV3', async () => {
        useMockStore.setState({
            videoInputs: {
                ingredients: [{
                    id: 'selected-project-image',
                    url: 'https://cdn.example.com/project-a-image.png',
                    type: 'image',
                    prompt: 'Project A reference',
                    timestamp: 1,
                    projectId: 'test-project',
                }],
            },
        });
        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'Use this exact reference' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockUploadReferenceMedia).toHaveBeenCalledWith(
                expect.any(String),
                'https://cdn.example.com/project-a-image.png',
                'image',
                { scope: 'objects' },
            );
            expect(mockGenerateImages).toHaveBeenCalledWith(expect.objectContaining({
                referenceUris: ['gs://test-bucket/creative/test-user/references/selected-project-image.png'],
            }));
        });

        // Drain the rest of the generation chain (resolveStorageUrl -> addToHistory)
        // before the test ends. Without this, the pending promise resolves during
        // the NEXT test instead, injecting a stray 'mock-job-id' entry into that
        // test's generatedHistory assertion — a real cross-test leak, not a fluke.
        await waitFor(() => {
            expect(useMockStore.getState().addToHistory).toHaveBeenCalled();
        });
    });

    it('opens immediately when image generation returns a completed stored result', async () => {
        mockGenerateImages.mockResolvedValueOnce([{
            id: 'completed-image-job',
            url: 'https://cdn.example.com/completed.png',
            prompt: 'A finished image',
        }]);

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), {
            target: { value: 'A finished image' }
        });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(useMockStore.getState().setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({
                id: 'completed-image-job',
                url: 'https://cdn.example.com/completed.png',
                type: 'image',
                prompt: 'A finished image',
            }));
            expect(useMockStore.getState().setViewMode).toHaveBeenCalledWith('editor');
        });
        expect(useMockStore.getState().generatedHistory).toEqual([
            expect.objectContaining({
                id: 'completed-image-job',
                url: 'https://cdn.example.com/completed.png',
            })
        ]);
    });

    it('handles video generation successfully', async () => {
        vi.useFakeTimers();
        render(<DirectGenerationTab />);
        fireEvent.click(screen.getByTestId('direct-video-mode-btn'));

        const input = screen.getByTestId('direct-prompt-input');
        const generateBtn = screen.getByTestId('direct-generate-btn');

        fireEvent.change(input, { target: { value: 'A cinematic drone shot' } });

        await act(async () => {
            fireEvent.click(generateBtn);
        });

        expect(VideoGeneration.generateVideo).toHaveBeenCalled();
        expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'A cinematic drone shot',
            aspectRatio: '16:9',
            model: 'fast',
            resolution: '1080p',
            duration: 6,
            personGeneration: 'allow_adult',
            directorSettings: expect.objectContaining({
                fps: 24,
                totalFrames: 144
            })
        }));

        // Fast-forward all pending timers including the 10ms subscription callback
        // and the 3000ms job cleanup timer.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3010);
        });

        // Results grid should show the video
        const video = document.querySelector('video');
        expect(video).toBeTruthy();
    });

    it('displays error message when generation fails', async () => {
        mockGenerateImages.mockRejectedValueOnce(new Error('API Error'));

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: API Error');
        });
    });

    it('surfaces Firebase callable details when the public message is internal', async () => {
        mockGenerateImages.mockRejectedValueOnce({
            code: 'functions/internal',
            message: 'internal',
            details: { cause: 'Gemini model is not available in this project or region' },
        });

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: Gemini model is not available in this project or region');
        });
    });

    it('surfaces backend connection failures as an unavailable generation service', async () => {
        mockGenerateImages.mockRejectedValueOnce({
            code: 'functions/internal',
            message: 'internal',
            details: { cause: 'connect ECONNREFUSED 127.0.0.1:5001' },
        });

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Generation failed: Image generation backend unavailable. Start the Firebase Functions emulator on port 5001.');
        });
    });

    it('normalizes upstream quota errors without exposing a Developer API control path', async () => {
        mockGenerateImages.mockRejectedValueOnce({
            code: 'functions/resource-exhausted',
            message: 'Image generation failed: {"error":{"code":429,"message":"Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing. Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ","status":"RESOURCE_EXHAUSTED"}}',
            details: {
                cause: 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
            },
        });

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(
                'Generation capacity is temporarily exhausted. Please try again shortly.'
            );
        });
    });

    it('ISSUE-1006: surfaces expired server generation quotas as a cost ledger blocker', async () => {
        mockGenerateImages.mockRejectedValueOnce({
            code: 'functions/resource-exhausted',
            message: 'internal',
            details: {
                cause: 'Insufficient tokens in cost ledger.',
            },
        });

        const mockToast = useToast();

        render(<DirectGenerationTab />);
        fireEvent.change(screen.getByTestId('direct-prompt-input'), { target: { value: 'fail' } });

        await act(async () => {
            fireEvent.click(screen.getByTestId('direct-generate-btn'));
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(
                'Insufficient tokens in cost ledger.'
            );
        });
    });
});
