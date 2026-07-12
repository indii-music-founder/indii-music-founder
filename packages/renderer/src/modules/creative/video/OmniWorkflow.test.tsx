import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OmniWorkflow from './OmniWorkflow';

const mockGenerateOmniRemixFn = vi.fn();
const mockUploadReferenceMedia = vi.fn(
    async (..._args: unknown[]): Promise<string> =>
        'gs://mock-bucket.appspot.com/creative/user-123/omni/reference.mp4'
);
const mockCostCheckAndReserve = vi.fn();

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
            pendingStageHandoff: { omni: null },
            consumeStageHandoff: vi.fn(),
            sendToStage: vi.fn(),
            ...overrides,
        };

        (store as any).setStudioControls = vi.fn((patch: Record<string, unknown>) => {
            Object.assign((store as any).studioControls, patch);
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
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreRef.current = createStoreState();
        mockGenerateOmniRemixFn.mockResolvedValue({
            data: {
                jobId: 'job-omni-1',
                resultUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/result.mp4',
            },
        });
        mockCostCheckAndReserve.mockResolvedValue({
            allowed: true,
            operationId: 'op-omni-1',
            remainingBudget: 10,
            dailyUsed: 0,
            monthlyUsed: 0,
        });
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:preview-url'),
            revokeObjectURL: vi.fn(),
        } as unknown as typeof URL);
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

        const remixButton = screen.getByRole('button', { name: /synthesize omni remix/i });
        await waitFor(() => expect(remixButton).not.toBeDisabled());
        fireEvent.click(remixButton);

        await waitFor(() => expect(mockCostCheckAndReserve).toHaveBeenCalled());
        expect(mockCostCheckAndReserve).toHaveBeenCalledWith(expect.objectContaining({
            operationType: 'video',
            estimatedCost: expect.any(Number),
            userId: 'user-123',
            metadata: expect.objectContaining({
                durationSeconds: 8,
                pipelineMode: 'pure-omni',
                referenceCount: 0,
            }),
        }));

        await waitFor(() => expect(mockGenerateOmniRemixFn).toHaveBeenCalled());
        expect(mockGenerateOmniRemixFn).toHaveBeenCalledWith(expect.objectContaining({
            costEstimate: expect.any(Number),
            costReservationId: 'op-omni-1',
            pipelineMode: 'pure-omni',
            referenceVideoUri: 'gs://mock-bucket.appspot.com/creative/user-123/omni/reference.mp4',
        }));

        // ISSUE-775: the server never requests a provider-side watermark or
        // reads back verified provenance — the overlay must say "Requested",
        // never "Protected", since that would claim verified provenance.
        await waitFor(() => expect(screen.getByText('SynthID Requested')).toBeInTheDocument());
        expect(screen.queryByText('SynthID Protected')).not.toBeInTheDocument();
    });
});
