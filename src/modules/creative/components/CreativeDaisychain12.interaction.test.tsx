import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import CreativeGallery from './CreativeGallery';
import CreativeNavbar from './CreativeNavbar';
import CreativeCanvas from './CreativeCanvas';
import Showroom from './Showroom';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// Mock the store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

// Mock the toast context
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

// Mock complex sub-components
vi.mock('./CandidatesCarousel', () => ({
    CandidatesCarousel: () => <div data-testid="candidates-carousel" />
}));

vi.mock('./EndFrameSelector', () => ({
    EndFrameSelector: () => <div data-testid="end-frame-selector" />
}));

vi.mock('./AnnotationPalette', () => ({
    default: () => <div data-testid="annotation-palette" />
}));

vi.mock('./CanvasToolbar', () => ({
    CanvasToolbar: () => <div data-testid="canvas-toolbar" />
}));

vi.mock('./EditDefinitionsPanel', () => ({
    default: () => <div data-testid="edit-definitions-panel" />
}));

// Mock Canvas operations
vi.mock('../services/CanvasOperationsService', () => ({
    canvasOps: {
        isInitialized: vi.fn().mockReturnValue(true),
        initialize: vi.fn(),
        dispose: vi.fn(),
        updateBrushColor: vi.fn(),
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn().mockResolvedValue([{ id: 'mock-vid', url: 'mock-video-url' }])
    }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        generateComposite: vi.fn().mockResolvedValue({ id: 'mock-img', url: 'mock-image-url' })
    }
}));

describe('Creative Director 12-Click Daisychain', () => {
    const mockItemA = {
        id: 'item-a',
        url: 'data:image/png;base64,mockA',
        prompt: 'Initial Prompt A',
        type: 'image',
        timestamp: Date.now()
    };

    const mockItemB = {
        id: 'item-b',
        url: 'data:image/png;base64,mockB',
        prompt: 'Initial Prompt B',
        type: 'image',
        timestamp: Date.now()
    };

    const mockToastInfo = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockSetPrompt = vi.fn();
    const mockSetViewMode = vi.fn();
    const mockAddWhiskItem = vi.fn();
    const mockSetPendingPrompt = vi.fn();
    const mockSetGenerationMode = vi.fn();
    const mockSetEntityAnchor = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            info: mockToastInfo,
            success: mockToastSuccess,
            warning: vi.fn(),
            error: vi.fn(),
            loading: vi.fn().mockReturnValue('loading-id'),
            updateProgress: vi.fn(),
            dismiss: vi.fn(),
        });

        // Mock store.getState()
        (useStore as any).getState = () => ({
            addWhiskItem: mockAddWhiskItem,
            setPendingPrompt: mockSetPendingPrompt,
            setViewMode: (val: string) => {
                mockSetViewMode(val);
                // We'll handle internal state logic in our DaisychainApp wrapper
            },
            setGenerationMode: mockSetGenerationMode,
            updateWhiskItem: vi.fn(),
            setEntityAnchor: mockSetEntityAnchor,
        });
    });

    it('completes the 12-click journey: Gallery -> Canvas -> Refine -> Builder -> Tag -> Showroom -> Preset -> Product -> Generate -> Animate -> Gallery -> Anchor', async () => {
        const DaisychainApp = () => {
            const [selectedItem, setSelectedItem] = useState<any>(null);
            const [prompt, setLocalPrompt] = useState('Initial Prompt');
            const [viewMode, setLocalViewMode] = useState('gallery');

            (useStore as any).mockImplementation((selector: any) => {
                const state = {
                    generatedHistory: [mockItemA, mockItemB],
                    selectedItem,
                    setSelectedItem: (item: any) => {
                        setSelectedItem(item);
                    },
                    setViewMode: (mode: string) => {
                        setLocalViewMode(mode);
                        mockSetViewMode(mode);
                    },
                    viewMode,
                    generationMode: 'image',
                    setGenerationMode: mockSetGenerationMode,
                    addWhiskItem: mockAddWhiskItem,
                    setPendingPrompt: mockSetPendingPrompt,
                    prompt,
                    setPrompt: (newPrompt: string) => {
                        setLocalPrompt(newPrompt);
                        mockSetPrompt(newPrompt);
                    },
                    setEntityAnchor: mockSetEntityAnchor,
                    userProfile: {
                        brandKit: {
                            brandDescription: 'Cool Brand',
                            releaseDetails: { mood: 'Dark', themes: 'Synthwave' },
                            colors: ['#FF00FF'],
                            fonts: 'Inter'
                        }
                    },
                    addToHistory: vi.fn()
                };
                return selector ? selector(state) : state;
            });

            return (
                <div>
                    <CreativeNavbar />
                    {viewMode === 'gallery' && <CreativeGallery />}
                    {viewMode === 'showroom' && <Showroom />}
                    {selectedItem && viewMode === 'gallery' && (
                        <CreativeCanvas
                            item={selectedItem}
                            onClose={() => setSelectedItem(null)}
                            onRefine={() => {
                                mockToastInfo("Refining...");
                                setLocalViewMode('gallery');
                                mockSetViewMode('gallery');
                                mockAddWhiskItem('subject', 'image', mockItemA.url, mockItemA.prompt, 'mock-uuid');
                                setSelectedItem(null);
                            }}
                        />
                    )}
                </div>
            );
        };

        render(<DaisychainApp />);

        // --- CLICK 1: Like Item A in Gallery ---
        const likeBtn = screen.getAllByTestId('like-btn')[0];
        fireEvent.click(likeBtn);
        expect(mockToastSuccess).toHaveBeenCalledWith("Feedback recorded: Liked");

        // --- CLICK 2: Maximize Item A ---
        const maximizeButtons = screen.getAllByTestId('view-fullsize-btn');
        fireEvent.click(maximizeButtons[0]); // Item A

        // --- CLICK 3: Refine In Canvas ---
        const refineBtn = await screen.findByTestId('refine-btn');
        fireEvent.click(refineBtn);
        expect(mockAddWhiskItem).toHaveBeenCalled();

        // --- CLICK 4: Open Prompt Builder ---
        const builderBtn = screen.getByTestId('builder-btn');
        fireEvent.click(builderBtn);

        // --- CLICK 5: Open Brand Category ---
        const brandTrigger = await screen.findByTestId('category-Brand-trigger');
        fireEvent.click(brandTrigger);

        // --- CLICK 6: Select Cool Brand Tag ---
        const tagBtn = await screen.findByTestId('tag-Cool Brand-btn');
        fireEvent.click(tagBtn);
        expect(mockSetPrompt).toHaveBeenCalledWith('Initial Prompt, Cool Brand');

        // --- CLICK 7: Switch to Showroom ---
        const showroomBtn = screen.getByTestId('showroom-view-btn');
        fireEvent.click(showroomBtn);
        expect(await screen.findByText('Product Showroom')).toBeInTheDocument();

        // --- CLICK 8: Select Studio Minimal Preset ---
        const presetBtn = screen.getByTestId('showroom-preset-Studio Minimal');
        fireEvent.click(presetBtn);
        // Expect scene prompt textarea to be updated (we could verify value, but click is the focus)

        // --- CLICK 9: Select T-Shirt Product ---
        const tshirtBtn = screen.getByTestId('showroom-product-t-shirt');
        fireEvent.click(tshirtBtn);

        // --- UPLOAD ASSET (Required for generation) ---
        // We simulate file upload to enable generation
        const file = new File(['(⌐□_□)'], 'chucknorris.png', { type: 'image/png' });
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        // In valid React Testing Library usage we'd use getByLabelText or similar, but the input is hidden.
        // We can find it via container query if needed, or by assumption it's the only file input.
        expect(input).toBeInTheDocument();
        await waitFor(() => {
            fireEvent.change(input, { target: { files: [file] } });
        });

        // Wait for FileReader to process and state to update
        await screen.findByText("Change Asset");

        // --- CLICK 10: Generate Mockup (New Step) ---
        // Ensure scene prompt is set (from Preset click)
        const mockupBtn = screen.getByTestId('showroom-generate-mockup-btn');
        expect(mockupBtn).not.toBeDisabled();
        fireEvent.click(mockupBtn);

        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith("Mockup generated successfully!");
        });

        // --- CLICK 11: Animate Scene (New Step) ---
        // Set motion prompt first
        const motionInput = screen.getByTestId('motion-prompt-input');
        fireEvent.change(motionInput, { target: { value: 'Spinning 360' } });

        const animateBtn = screen.getByTestId('showroom-animate-scene-btn');
        expect(animateBtn).not.toBeDisabled();
        fireEvent.click(animateBtn);

        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith("Scene animated successfully!");
        });

        // --- CLICK 12: Switch back to Gallery (Originally 10) ---
        const galleryBtn = screen.getByTestId('gallery-view-btn');
        fireEvent.click(galleryBtn);
        expect(await screen.findByTestId('gallery-item-item-b')).toBeInTheDocument();

        // --- CLICK 13: Select Item B (Originally 11) ---
        const itemB = screen.getByTestId('gallery-item-item-b');
        fireEvent.click(itemB); // In our mock, this just calls setSelectedItem

        // --- CLICK 14: Set Item B as Entity Anchor (Originally 12) ---
        const anchorButtons = screen.getAllByTestId('set-anchor-btn');
        fireEvent.click(anchorButtons[1]); // Anchor for Item B
        expect(mockSetEntityAnchor).toHaveBeenCalledWith(mockItemB);
        expect(mockToastSuccess).toHaveBeenCalledWith("Entity Anchor Set");
    });
});
