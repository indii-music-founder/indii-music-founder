import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import OmniWorkflow from './OmniWorkflow';
import { CREATIVE_ASSET_MIME } from '@/services/creative/CreativeAssetDragService';

function droppedAssetDataTransfer(asset: Record<string, unknown>): DataTransfer {
    const serialized = JSON.stringify({ version: 1, kind: 'creative-asset', source: 'gallery', asset });
    return {
        dropEffect: 'none',
        getData: (format: string) => format === CREATIVE_ASSET_MIME ? serialized : '',
    } as DataTransfer;
}

const mockGenerateOmniRemixFn = vi.fn();
const mockUploadReferenceMedia = vi.fn(
    async (..._args: unknown[]): Promise<string> =>
        'gs://mock-bucket.appspot.com/creative/user-123/omni/reference.mp4'
);
const mockCostCheckAndReserve = vi.fn();
const mockMaterializeVideoFrame = vi.fn();

const { mockStoreRef, createStoreState } = vi.hoisted(() => {
    const createStoreState = (overrides: Record<string, unknown> = {}) => {
        const store: Record<string, unknown> = {
            currentProjectId: 'proj-omni',
            currentOrganizationId: 'org-omni',
            addToHistory: vi.fn(),
            updateHistoryItem: vi.fn(),
            studioControls: {
                omniReferenceVideo: null,
                omniPipelineMode: 'pure-omni',
                aspectRatio: '16:9',
                duration: 8,
                posePreservation: 0.5,
                beatPulse: 0.5,
                characterXRay: false,
                synthIdEnabled: true,
                selectedLanguage: 'es',
                activePosePreset: 'guitar_solo',
                typographyStyle: undefined,
                visualizerColor: '#10B981',
            },
            pendingStageHandoff: { image: null, veo: null, omni: null, editor: null },
            consumeStageHandoff: vi.fn(),
            sendToStage: vi.fn(),
            ...overrides,
        };

        (store as any).setStudioControls = vi.fn((patch: Record<string, unknown>) => {
            Object.assign((store as any).studioControls, patch);
        });
        (store as any).consumeStageHandoff = vi.fn((stage: 'image' | 'veo' | 'omni' | 'editor') => {
            (store as any).pendingStageHandoff[stage] = null;
        });
        return store;
    };

    return {
        mockStoreRef: { current: createStoreState() },
        createStoreState,
    };
});

vi.mock('@/core/store', () => ({
    useStore: (selector?: any) => (selector ? selector(mockStoreRef.current) : mockStoreRef.current),
}));

vi.mock('framer-motion', async () => {
    const ReactModule = await import('react');
    const componentCache = new Map<string, React.ComponentType<Record<string, unknown>>>();
    const motion = new Proxy({}, {
        get: (_target, tag: string) => {
            if (!componentCache.has(tag)) {
                componentCache.set(tag, ReactModule.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
                    const {
                        children,
                        initial: _initial,
                        animate: _animate,
                        exit: _exit,
                        transition: _transition,
                        whileHover: _whileHover,
                        whileTap: _whileTap,
                        layout: _layout,
                        layoutId: _layoutId,
                        ...domProps
                    } = props;
                    return ReactModule.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
                }));
            }
            return componentCache.get(tag);
        },
    });
    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    };
});

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-123' } },
    functions: {},
    storage: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockGenerateOmniRemixFn,
}));

vi.mock('firebase/storage', () => ({
    getDownloadURL: vi.fn(async () => 'https://mock-bucket.appspot.com/download/omni/reference.mp4'),
    ref: vi.fn(),
}));

vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: (...args: unknown[]) => mockUploadReferenceMedia(...args),
    },
}));

vi.mock('@/services/creative/CreativeMediaHandoffService', () => ({
    materializeVideoFrameForHandoff: (...args: unknown[]) => mockMaterializeVideoFrame(...args),
}));

vi.mock('@/services/storage/resolveStorageUri', () => ({
    resolveStorageUri: (uri: string) => (uri.startsWith('gs://') ? uri : undefined),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn(async (uri: string) => uri.replace('gs://mock-bucket.appspot.com/', 'https://mock-bucket.appspot.com/download/')),
}));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        checkAndReserve: (...args: unknown[]) => mockCostCheckAndReserve(...args),
    },
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        estimateVideoCost: vi.fn((duration: number) => duration * 0.1),
    },
}));

vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    Video: () => <div />,
    Film: () => <div />,
    Music: () => <div />,
    Shield: () => <div />,
    Sliders: () => <div />,
    Play: () => <div />,
    Sparkles: () => <div />,
    RefreshCw: () => <div />,
    Upload: () => <div />,
    Languages: () => <div />,
    Eye: () => <div />,
    Sparkle: () => <div />,
    Info: () => <div />,
    Download: () => <div />,
    CheckCircle: () => <div />,
    Volume2: () => <div />,
    Plus: () => <div />,
    Trash2: () => <div />,
    X: () => <div />,
}));

describe('OmniWorkflow', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreRef.current = createStoreState();
        mockGenerateOmniRemixFn.mockResolvedValue({
            data: {
                jobId: 'job-omni-1',
                resultUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/result.mp4',
                interactionId: 'interaction-omni-1',
                task: 'edit',
                synthIdApplied: true,
            },
        });
        mockCostCheckAndReserve.mockResolvedValue({
            allowed: true,
            operationId: 'op-omni-1',
            remainingBudget: 10,
            dailyUsed: 0,
            monthlyUsed: 0,
        });
        mockMaterializeVideoFrame.mockResolvedValue({
            id: 'omni-final-frame',
            type: 'image',
            url: 'https://mock-bucket.appspot.com/download/omni/final-frame.jpg',
            storageUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/final-frame.jpg',
            prompt: 'Last frame from Omni output',
            timestamp: Date.now(),
            projectId: 'proj-omni',
        });
        // Keep jsdom's URL constructor intact; replacing the whole global can
        // strand Framer Motion/media cleanup between sequential tests.
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:preview-url'),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn(),
        });
    });

    it('reserves cost before starting an omni remix and sends the reservation to the callable', async () => {
        render(<OmniWorkflow />);

        const fileInput = screen.getByLabelText('Upload Artist Base Performance Video');
        fireEvent.change(fileInput, {
            target: {
                files: [new File(['video-bytes'], 'reference.mp4', { type: 'video/mp4' })],
            },
        });

        await waitFor(() => expect(mockUploadReferenceMedia).toHaveBeenCalled());

        const remixButton = screen.getByRole('button', { name: /generate omni video/i });
        await waitFor(() => expect(remixButton).not.toBeDisabled());
        fireEvent.click(remixButton);

        await waitFor(() => expect(mockCostCheckAndReserve).toHaveBeenCalled());
        expect(mockCostCheckAndReserve).toHaveBeenCalledWith(expect.objectContaining({
            operationType: 'video',
            estimatedCost: expect.any(Number),
            userId: 'user-123',
            metadata: expect.objectContaining({
                durationSeconds: 8,
                model: 'gemini-omni-flash-preview',
                task: 'edit',
                referenceCount: 0,
            }),
        }));

        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalled());
        expect(mockGenerateOmniRemixFn).toHaveBeenCalledWith(expect.objectContaining({
            costEstimate: expect.any(Number),
            costReservationId: 'op-omni-1',
            task: 'edit',
            referenceVideoUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/reference.mp4',
        }));

        await waitFor(() => expect(screen.getByText('SynthID Applied')).toBeInTheDocument());
        expect(screen.getByText('Automatic SynthID')).toBeInTheDocument();
    });

    it('sends a timecoded storyboard through the validated Omni payload', async () => {
        render(<OmniWorkflow />);

        const fileInput = screen.getByLabelText('Upload Artist Base Performance Video');
        fireEvent.change(fileInput, {
            target: {
                files: [new File(['video-bytes'], 'reference.mp4', { type: 'video/mp4' })],
            },
        });
        await waitFor(() => expect(mockUploadReferenceMedia).toHaveBeenCalled());

        // Build a one-scene timecoded storyboard sequence.
        fireEvent.click(screen.getByText('Add Frame'));
        fireEvent.change(screen.getByPlaceholderText('Describe the styling, action, or camera movement...'), {
            target: { value: 'Slow zoom on the crowd, neon rim light' },
        });
        fireEvent.click(screen.getByText('Add Frame to Sequence'));

        expect(screen.getByText('Omni Timecode Storyboard (sent to generation)')).toBeInTheDocument();
        expect(await screen.findByText('1 Scenes Planned')).toBeInTheDocument();

        const remixButton = screen.getByRole('button', { name: /generate omni video/i });
        await waitFor(() => expect(remixButton).not.toBeDisabled());
        fireEvent.click(remixButton);

        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalled());
        const [sentPayload] = mockGenerateOmniRemixFn.mock.calls[0]!;
        expect(sentPayload).toEqual(expect.objectContaining({
            storyboard: [{ timestamp: 3, prompt: 'Slow zoom on the crowd, neon rim light' }],
        }));
    });

    it('supports text-to-video without requiring a source upload', async () => {
        mockGenerateOmniRemixFn.mockResolvedValueOnce({
            data: {
                jobId: 'job-omni-text',
                resultUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/text-result.mp4',
                interactionId: 'interaction-omni-text',
                task: 'text_to_video',
                synthIdApplied: true,
            },
        });
        render(<OmniWorkflow />);

        fireEvent.change(screen.getByLabelText('Omni generation mode'), {
            target: { value: 'text_to_video' },
        });
        const generateButton = screen.getByRole('button', { name: /generate omni video/i });
        expect(generateButton).not.toBeDisabled();
        fireEvent.click(generateButton);

        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalledWith(expect.objectContaining({
            task: 'text_to_video',
            costEstimate: 0.8,
            costReservationId: 'op-omni-1',
        })));
        const [payload] = mockGenerateOmniRemixFn.mock.calls[0]!;
        expect(payload).not.toHaveProperty('referenceVideoUri');
        expect(payload).not.toHaveProperty('audioUri');
    });

    it('routes a completed Omni output to Veo continuity, the editor, and Image Studio', async () => {
        mockGenerateOmniRemixFn.mockResolvedValueOnce({
            data: {
                jobId: 'job-omni-routes',
                resultUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/routes.mp4',
                interactionId: 'interaction-omni-routes',
                task: 'text_to_video',
                synthIdApplied: true,
            },
        });
        render(<OmniWorkflow />);

        fireEvent.click(screen.getByRole('button', { name: /generate omni video/i }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue Omni video in Veo' })).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Continue Omni video in Veo' }));
        expect(mockStoreRef.current.sendToStage).toHaveBeenCalledWith('veo', expect.objectContaining({
            role: 'source-video',
            originStage: 'omni',
            item: expect.objectContaining({
                storageUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/routes.mp4',
                type: 'video',
            }),
        }));

        fireEvent.click(screen.getByRole('button', { name: 'Open Omni video in timeline editor' }));
        expect(mockStoreRef.current.sendToStage).toHaveBeenCalledWith('editor', expect.objectContaining({
            role: 'source-video',
            originStage: 'omni',
        }));

        fireEvent.click(screen.getByRole('button', { name: 'Send Omni final frame to Image Studio' }));
        await waitFor(() => expect(mockMaterializeVideoFrame).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'video' }),
            'last',
            { userId: 'user-123', projectId: 'proj-omni' },
        ));
        await waitFor(() => expect(mockStoreRef.current.sendToStage).toHaveBeenCalledWith('image', expect.objectContaining({
            role: 'image-input',
            originStage: 'omni',
            item: expect.objectContaining({ type: 'image' }),
        })));
    });

    it('uploads visual references for image-to-video and uses the first image as the starting frame', async () => {
        render(<OmniWorkflow />);
        fireEvent.change(screen.getByLabelText('Omni generation mode'), {
            target: { value: 'image_to_video' },
        });
        fireEvent.change(screen.getByLabelText('Upload Omni reference images'), {
            target: {
                files: [new File(['image-bytes'], 'first-frame.png', { type: 'image/png' })],
            },
        });

        await waitFor(() => expect(mockUploadReferenceMedia).toHaveBeenCalledWith(
            'user-123',
            expect.objectContaining({ name: 'first-frame.png' }),
            'image',
        ));
        const generateButton = screen.getByRole('button', { name: /generate omni video/i });
        await waitFor(() => expect(generateButton).not.toBeDisabled());
        fireEvent.click(generateButton);

        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalledWith(expect.objectContaining({
            task: 'image_to_video',
            firstFrameUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/reference.mp4',
            referenceUris: [],
        })));
    });

    it('treats an image-stage first-frame handoff as Omni image-to-video input', async () => {
        const firstFrameItem = {
            id: 'image-first-frame',
            type: 'image',
            url: 'https://mock-bucket.appspot.com/download/first-frame.jpg',
            storageUri: 'gs://mock-bucket.appspot.com/creative/user-123/first-frame.jpg',
            prompt: 'Artist close-up',
            timestamp: 1,
            projectId: 'proj-omni',
        };
        mockStoreRef.current = createStoreState({
            pendingStageHandoff: {
                image: null,
                veo: null,
                editor: null,
                omni: {
                    item: firstFrameItem,
                    role: 'first-frame',
                    originStage: 'image',
                    timestamp: Date.now(),
                },
            },
        });

        render(<OmniWorkflow />);

        await waitFor(() => expect(screen.getByLabelText('Omni generation mode')).toHaveValue('image_to_video'));
        expect(mockStoreRef.current.consumeStageHandoff).toHaveBeenCalledWith('omni');

        fireEvent.click(screen.getByRole('button', { name: /generate omni video/i }));
        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalledWith(expect.objectContaining({
            task: 'image_to_video',
            firstFrameUri: firstFrameItem.storageUri,
            referenceUris: [],
        })));
    });

    it('accepts a dragged project image as an Omni starting frame without re-uploading it', async () => {
        render(<OmniWorkflow />);
        fireEvent.drop(screen.getByTestId('omni-asset-drop-zone'), {
            dataTransfer: droppedAssetDataTransfer({
                id: 'project-image-1',
                type: 'image',
                url: 'https://mock-bucket.appspot.com/download/project-image.jpg',
                storageUri: 'gs://mock-bucket.appspot.com/projects/proj-omni/project-image.jpg',
                name: 'Project image',
                prompt: 'Project image',
                projectId: 'proj-omni',
            }),
        });

        await waitFor(() => expect(screen.getByLabelText('Omni generation mode')).toHaveValue('image_to_video'));
        expect(mockUploadReferenceMedia).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /generate omni video/i }));
        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalledWith(expect.objectContaining({
            task: 'image_to_video',
            firstFrameUri: 'gs://mock-bucket.appspot.com/projects/proj-omni/project-image.jpg',
        })));
    });
});
