import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import CreativeCanvas from '../CreativeCanvas';
import React from 'react';
import { canvasOps } from '../../services/CanvasOperationsService';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { saveAssetToStorage } from '@/services/storage/repository';
import { Editing } from '@/services/image/EditingService';

const { mockStoreStateRef, createStoreState, canvasOnChangeRef } = vi.hoisted(() => {
    const createStoreState = (overrides: Record<string, unknown> = {}) => ({
        updateHistoryItem: vi.fn(),
        addToHistory: vi.fn(),
        setActiveReferenceImage: vi.fn(),
        uploadedImages: [],
        addUploadedImage: vi.fn(),
        currentProjectId: 'test-project',
        generatedHistory: [],
        canvasImages: [],
        addCanvasImage: vi.fn(),
        setViewMode: vi.fn(),
        studioControls: {
            aspectRatio: '1:1',
            imageSize: '1k',
            model: 'fast',
            resolution: '1k',
            useGrounding: false,
        },
        initializeDesignHistory: vi.fn().mockResolvedValue(undefined),
        userProfile: undefined,
        ...overrides,
    });

    return {
        mockStoreStateRef: { current: createStoreState() },
        createStoreState,
        // Captures the onChange callback the hook registers with
        // canvasOps.initialize — tests fire it to simulate a real canvas
        // mutation (draw / add shape), which is the only thing that marks
        // the editor as dirty for the send-to-canvas flow.
        canvasOnChangeRef: { current: null as (() => void) | null },
    };
});

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        () => mockStoreStateRef.current,
        { getState: () => mockStoreStateRef.current }
    )
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    })
}));

vi.mock('@/services/firebase', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/firebase')>()),
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

// Mock Fabric.js
vi.mock('fabric', () => {
    const CanvasMock = vi.fn().mockImplementation(function (this: any) {
        return {
            on: vi.fn(),
            off: vi.fn(),
            dispose: vi.fn(),
            add: vi.fn(),
            renderAll: vi.fn(),
            getObjects: vi.fn().mockReturnValue([]),
            remove: vi.fn(),
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
            set: vi.fn(),
            toJSON: vi.fn().mockReturnValue({}),
            isDrawingMode: false,
            freeDrawingBrush: {},
        };
    });

    return {
        Canvas: CanvasMock,
        Image: { fromURL: vi.fn().mockResolvedValue({ scale: vi.fn(), set: vi.fn(), width: 100, height: 100 }) },
        Rect: vi.fn(),
        Circle: vi.fn(),
        IText: vi.fn(),
        PencilBrush: vi.fn(),
    };
});

vi.mock('@/services/storage/repository', () => ({
    saveAssetToStorage: vi.fn().mockResolvedValue('asset-123'),
    saveCanvasStateToStorage: vi.fn(),
    getCanvasStateFromStorage: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/storage/storageUri', () => ({
    buildAssetStorageUri: vi.fn(() => 'gs://mock-bucket/users/test-user-id/assets/asset-123'),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((url: string) => Promise.resolve(url)),
}));

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        dataURItoBlob: vi.fn().mockResolvedValue(new Blob(['mock-image'], { type: 'image/png' })),
    }
}));

vi.mock('@/services/creative/CreativeSessionService', () => ({
    creativeSessionService: {
        loadSession: vi.fn().mockResolvedValue(null),
        upsertFromManifest: vi.fn().mockResolvedValue(undefined),
        updateSession: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: vi.fn().mockResolvedValue('https://example.com/reference.png'),
    }
}));

vi.mock('../../services/CanvasOperationsService', () => ({
    canvasOps: {
        addRectangle: vi.fn(),
        addCircle: vi.fn(),
        addText: vi.fn(),
        addBlankSketchLayer: vi.fn(),
        prepareMasksForEdit: vi.fn(),
        extractSemanticMask: vi.fn().mockReturnValue('semantic-mask'),
        extractGeminiMask: vi.fn().mockReturnValue('gemini-mask'),
        initialize: vi.fn((_el: unknown, _url: unknown, _onReady: unknown, onChange?: () => void) => {
            canvasOnChangeRef.current = onChange ?? null;
        }),
        dispose: vi.fn(),
        updateBrushColor: vi.fn(),
        setMagicFillMode: vi.fn(),
        canUndo: vi.fn().mockReturnValue(false),
        canRedo: vi.fn().mockReturnValue(false),
        hasContent: vi.fn().mockReturnValue(true),
        saveCanvas: vi.fn().mockReturnValue('data:image/png;base64,mock'),
        getBlob: vi.fn().mockResolvedValue(new Blob(['mock'], { type: 'image/png' })),
        toJSON: vi.fn().mockResolvedValue({}),
        ensureBaseImage: vi.fn().mockResolvedValue(false),
        getLayers: vi.fn().mockReturnValue([]),
        selectLayer: vi.fn(),
        toggleLayerVisibility: vi.fn(),
        toggleLayerLock: vi.fn(),
        deleteLayer: vi.fn(),
        reorderLayer: vi.fn(),
    }
}));

vi.mock('../services/VideoDirector', () => ({
    VideoDirector: { triggerAnimation: vi.fn().mockResolvedValue({ success: true }) }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        magicFill: vi.fn(),
        editImage: vi.fn().mockResolvedValue({ id: 'edit-1', url: 'https://example.com/edit.png' })
    }
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        remixImage: vi.fn().mockResolvedValue({ url: 'data:image/png;base64,remix-result' }),
    }
}));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        checkAndReserve: vi.fn().mockResolvedValue({ allowed: true })
    }
}));

describe('CreativeCanvas', () => {
    const mockItem = {
        id: '1',
        url: 'http://test.com/image.png',
        prompt: 'test prompt',
        type: 'image' as const,
        timestamp: Date.now(),
        projectId: 'test-project'
    };

    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        canvasOnChangeRef.current = null;
        mockStoreStateRef.current = createStoreState();
        vi.mocked(resolveStorageUrl).mockImplementation((url: string) => Promise.resolve(url));
        vi.mocked(canvasOps.prepareMasksForEdit).mockReturnValue({
            baseImage: { mimeType: 'image/png', data: 'base-image' },
            masks: [{
                mimeType: 'image/png',
                data: 'mask-image',
                prompt: 'purple edit',
                colorId: 'purple',
                referenceImage: { mimeType: 'image/png', data: 'ref-image' }
            }]
        } as any);
    });

    it('should render nothing if item is null', () => {
        const { container } = render(<CreativeCanvas item={null} onClose={mockOnClose} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('should render canvas container when item is provided', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('creative-canvas-container')).toBeInTheDocument();
    });

    it('loads the thumbnail when the canonical image URL cannot resolve for editing', async () => {
        vi.mocked(resolveStorageUrl).mockImplementation((url: string) => {
            if (url === 'gs://mock-bucket/missing-full.png') {
                return Promise.resolve('gs://mock-bucket/missing-full.png');
            }
            return Promise.resolve(url);
        });

        render(
            <CreativeCanvas
                item={{
                    ...mockItem,
                    url: 'gs://mock-bucket/missing-full.png',
                    thumbnailUrl: 'https://cdn.example.com/thumb.png',
                }}
                onClose={mockOnClose}
            />
        );

        await waitFor(() => {
            expect(canvasOps.initialize).toHaveBeenCalledWith(
                expect.any(HTMLCanvasElement),
                'https://cdn.example.com/thumb.png',
                // ISSUE-1395: the fresh-path onReady resets the dirty baseline
                // after the base image is placed — no longer undefined.
                expect.any(Function),
                expect.any(Function)
            );
        });
    });

    it('should render the magic fill input', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('magic-fill-input')).toBeInTheDocument();
    });

    it('should show Animate button for images', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('animate-btn')).toBeInTheDocument();
    });

    it('should show close button', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        expect(screen.getByTestId('canvas-close-btn')).toBeInTheDocument();
    });

    // ISSUE-1395: the header "Canvas" button is the primary path for moving
    // the edited asset onto the canvas — it must run the send-to-canvas flow
    // (stage + canvas view), not close the editor into the Creative Hub. An
    // untouched canvas is staged as-is: no gallery export is created.
    it('stages the asset on the canvas when the header "Canvas" button is clicked', async () => {
        // jsdom's Image never fires load/error, so readNaturalDimensions would
        // sit on its 4s timeout while waitFor times out at 1s. Stub Image to
        // resolve dimensions immediately.
        const FakeImage = class {
            naturalWidth = 800;
            naturalHeight = 600;
            onload: (() => void) | null = null;
            set src(_v: string) {
                queueMicrotask(() => this.onload?.());
            }
        };
        const originalImage = globalThis.Image;
        (globalThis as { Image: unknown }).Image = FakeImage;
        try {
            render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
            fireEvent.click(screen.getByTestId('canvas-header-back'));

            await waitFor(() => {
                expect(mockStoreStateRef.current.addCanvasImage).toHaveBeenCalledWith(expect.objectContaining({
                    parentId: mockItem.id,
                    base64: mockItem.url,
                    width: 800,
                    height: 600,
                    prompt: expect.stringContaining('Canvas edit of'),
                }));
                expect(mockStoreStateRef.current.setViewMode).toHaveBeenCalledWith('canvas');
            });
            expect(mockOnClose).toHaveBeenCalled();
            // ISSUE-1395: no edits → no duplicate gallery export.
            expect(saveAssetToStorage).not.toHaveBeenCalled();
            expect(mockStoreStateRef.current.addToHistory).not.toHaveBeenCalled();
        } finally {
            (globalThis as { Image: unknown }).Image = originalImage;
        }
    });

    it('calls onClose when Escape is pressed', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('does not call onClose for other keys', () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    // ISSUE-1391: the editor must offer a direct path to move the edited
    // asset onto the canvas — one click, then the canvas view opens with the
    // asset staged on it.
    it('stages the edited asset on the canvas and switches view via Send to Canvas', async () => {
        // jsdom's Image never fires load/error, so readNaturalDimensions would
        // sit on its 4s timeout while waitFor times out at 1s. Stub Image to
        // resolve dimensions immediately.
        const FakeImage = class {
            naturalWidth = 800;
            naturalHeight = 600;
            onload: (() => void) | null = null;
            set src(_v: string) {
                queueMicrotask(() => this.onload?.());
            }
        };
        const originalImage = globalThis.Image;
        (globalThis as { Image: unknown }).Image = FakeImage;
        try {
            render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);
            fireEvent.click(screen.getByTestId('send-to-canvas-btn'));

            await waitFor(() => {
                expect(mockStoreStateRef.current.addCanvasImage).toHaveBeenCalledWith(expect.objectContaining({
                    parentId: mockItem.id,
                    width: 800,
                    height: 600,
                    prompt: expect.stringContaining('Canvas edit of'),
                }));
                expect(mockStoreStateRef.current.setViewMode).toHaveBeenCalledWith('canvas');
            });
            expect(mockOnClose).toHaveBeenCalled();
            // ISSUE-1395: no edits → no duplicate gallery export.
            expect(saveAssetToStorage).not.toHaveBeenCalled();
            expect(mockStoreStateRef.current.addToHistory).not.toHaveBeenCalled();
        } finally {
            (globalThis as { Image: unknown }).Image = originalImage;
        }
    });

    // ISSUE-1395: only a canvas the user actually changed gets persisted —
    // and in that case the EDITED output (not the original) lands on the board.
    it('persists and stages the edited output when the canvas was changed', async () => {
        const FakeImage = class {
            naturalWidth = 800;
            naturalHeight = 600;
            onload: (() => void) | null = null;
            set src(_v: string) {
                queueMicrotask(() => this.onload?.());
            }
        };
        const originalImage = globalThis.Image;
        (globalThis as { Image: unknown }).Image = FakeImage;
        try {
            render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);

            // Wait for setup to register the mutation callback, then simulate
            // a real canvas change (draw / add shape) — the only signal that
            // marks the editor as dirty for the send flow.
            await waitFor(() => expect(canvasOnChangeRef.current).toBeTruthy());
            act(() => canvasOnChangeRef.current!());
            fireEvent.click(screen.getByTestId('send-to-canvas-btn'));

            await waitFor(() => {
                expect(saveAssetToStorage).toHaveBeenCalledOnce();
                expect(mockStoreStateRef.current.addToHistory).toHaveBeenCalledOnce();
                expect(mockStoreStateRef.current.addCanvasImage).toHaveBeenCalledWith(expect.objectContaining({
                    parentId: mockItem.id,
                    // The EDITED export (persisted storage URI), not the
                    // original item URL.
                    base64: 'gs://mock-bucket/users/test-user-id/assets/asset-123',
                    width: 800,
                    height: 600,
                }));
                expect(mockStoreStateRef.current.setViewMode).toHaveBeenCalledWith('canvas');
            });
            expect(mockOnClose).toHaveBeenCalled();
        } finally {
            (globalThis as { Image: unknown }).Image = originalImage;
        }
    });

    // ISSUE-1395: the canvas board is image-only — video items must not be
    // offered a send-to-canvas action (the URL cannot render on the board).
    it('does not offer send-to-canvas for video items', () => {
        render(<CreativeCanvas item={{ ...mockItem, type: 'video' }} onClose={mockOnClose} />);
        expect(screen.queryByTestId('send-to-canvas-btn')).not.toBeInTheDocument();
        // The header "Canvas" control falls back to a plain close affordance.
        expect(screen.getByTestId('canvas-header-back')).toBeInTheDocument();
    });

    it('threads reference roles into the edit prompt', async () => {
        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);

        fireEvent.click(screen.getByLabelText('Edit Definitions'));

        const purpleDefinition = screen.getByLabelText('Edit definition for Purple');
        fireEvent.change(purpleDefinition, { target: { value: 'Use my actual hair and image please' } });
        await waitFor(() => expect(purpleDefinition).toHaveValue('Use my actual hair and image please'));

        const purpleCard = purpleDefinition.closest('div');
        expect(purpleCard).toBeTruthy();
        const characterButton = within(purpleCard as HTMLElement).getByRole('button', { name: /^Character$/i });
        fireEvent.click(characterButton);

        fireEvent.change(screen.getByTestId('magic-fill-input'), { target: { value: 'Apply the edit.' } });
        await waitFor(() => expect(screen.getByTestId('magic-fill-input')).toHaveValue('Apply the edit.'));
        fireEvent.click(screen.getByTestId('magic-generate-btn'));

        await waitFor(() => {
            expect(Editing.editImage).toHaveBeenCalledOnce();
            const args = vi.mocked(Editing.editImage).mock.calls[0]?.[0];
            expect(args.prompt).toContain('Purple (CHARACTERS)');
            expect(args.prompt).toContain('Use this reference for the character');
        });
    });

    it('passes all semantic-map reference images into the pro edit', async () => {
        mockStoreStateRef.current = createStoreState({
            studioControls: {
                aspectRatio: '1:1',
                imageSize: '1k',
                model: 'pro',
                resolution: '1k',
                useGrounding: false,
            },
        });

        vi.mocked(canvasOps.prepareMasksForEdit).mockReturnValue({
            baseImage: { mimeType: 'image/png', data: 'base-image' },
            masks: [{
                mimeType: 'image/png',
                data: 'mask-image',
                prompt: 'purple edit',
                colorId: 'purple',
                referenceImage: { mimeType: 'image/png', data: 'ref-image' }
            }]
        } as any);

        render(<CreativeCanvas item={mockItem} onClose={mockOnClose} />);

        fireEvent.click(screen.getByLabelText('Edit Definitions'));

        const purpleDefinition = screen.getByLabelText('Edit definition for Purple');
        fireEvent.change(purpleDefinition, { target: { value: 'Use my actual hair and image please' } });
        await waitFor(() => expect(purpleDefinition).toHaveValue('Use my actual hair and image please'));

        const redDefinition = screen.getByLabelText('Edit definition for Red');
        fireEvent.change(redDefinition, { target: { value: 'Add a little fly' } });
        await waitFor(() => expect(redDefinition).toHaveValue('Add a little fly'));

        const purpleInput = purpleDefinition.parentElement?.querySelector('input[type="file"]') as HTMLInputElement | null;
        const redInput = redDefinition.parentElement?.querySelector('input[type="file"]') as HTMLInputElement | null;
        expect(purpleInput).toBeTruthy();
        expect(redInput).toBeTruthy();

        fireEvent.change(purpleInput!, {
            target: {
                files: [new File(['purple-ref'], 'purple-ref.png', { type: 'image/png' })],
            },
        });
        fireEvent.change(redInput!, {
            target: {
                files: [new File(['red-ref'], 'red-ref.png', { type: 'image/png' })],
            },
        });

        await waitFor(() => {
            expect(screen.getByLabelText('Remove reference image for Purple')).toBeInTheDocument();
            expect(screen.getByLabelText('Remove reference image for Red')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Model quality: High Speed' }));
        fireEvent.change(screen.getByTestId('magic-fill-input'), { target: { value: 'Apply the edit.' } });
        await waitFor(() => expect(screen.getByTestId('magic-fill-input')).toHaveValue('Apply the edit.'));
        fireEvent.click(screen.getByTestId('magic-generate-btn'));

        await waitFor(() => {
            expect(Editing.editImage).toHaveBeenCalledOnce();
        });

        const args = vi.mocked(Editing.editImage).mock.calls[0]?.[0];
        expect(args.referenceImages).toHaveLength(2);
        expect(args.prompt).toContain('PURPLE REGION uses reference image 1');
        expect(args.prompt).toContain('RED REGION uses reference image 2');
        expect(args.useSemanticMap).toBe(true);
    });

    it('uses data-URI blobs for remix edits without fetching', async () => {
        const { CloudStorageService } = await import('@/services/CloudStorageService');
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

        vi.mocked(canvasOps.prepareMasksForEdit).mockReturnValue({
            baseImage: { mimeType: 'image/png', data: 'base-image' },
            masks: [],
        } as any);

        render(
            <CreativeCanvas
                item={{
                    ...mockItem,
                    url: 'data:image/png;base64,source-image',
                }}
                onClose={mockOnClose}
            />
        );

        fireEvent.change(screen.getByTestId('magic-fill-input'), { target: { value: 'Remix this image' } });
        await waitFor(() => expect(screen.getByTestId('magic-fill-input')).toHaveValue('Remix this image'));
        fireEvent.click(screen.getByTestId('magic-generate-btn'));

        await waitFor(() => {
            expect(CloudStorageService.dataURItoBlob).toHaveBeenCalledWith('data:image/png;base64,source-image');
            expect(ImageGeneration.remixImage).toHaveBeenCalledOnce();
        }, { timeout: 3000 });
    });
});
