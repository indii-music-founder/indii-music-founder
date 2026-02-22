import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import CreativeGallery from './CreativeGallery';
import CreativeNavbar from './CreativeNavbar';
import CreativeCanvas from './CreativeCanvas';
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

vi.mock('@/services/storage/repository', () => ({
    saveAssetToStorage: vi.fn(),
    saveCanvasStateToStorage: vi.fn(),
    getCanvasStateFromStorage: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/VideoDirector', () => ({
    VideoDirector: { triggerAnimation: vi.fn().mockResolvedValue({ success: true }) }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: { magicFill: vi.fn() }
}));

describe('Creative Director Daisychain (6-Click Workflow)', () => {
    const mockItem = {
        id: 'test-123',
        url: 'data:image/png;base64,mock',
        prompt: 'Initial Prompt',
        type: 'image',
        timestamp: Date.now()
    };

    const mockToastInfo = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockSetViewMode = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            info: mockToastInfo,
            success: mockToastSuccess,
            warning: vi.fn(),
            error: vi.fn()
        });
    });

    it('successfully completes gallery selection and canvas opening flow', async () => {
        const DaisychainApp = () => {
            const [selectedItem, setSelectedItem] = useState<any>(null);

            (useStore as any).mockImplementation((selector: any) => {
                const state = {
                    generatedHistory: [mockItem],
                    selectedItem,
                    setSelectedItem: (item: any) => setSelectedItem(item),
                    setViewMode: mockSetViewMode,
                    viewMode: 'gallery',
                    generationMode: 'image',
                    setGenerationMode: vi.fn(),
                    addWhiskItem: vi.fn(),
                    setPendingPrompt: vi.fn(),
                    updateWhiskItem: vi.fn(),
                    prompt: 'Initial Prompt',
                    setPrompt: vi.fn(),
                    currentProjectId: 'test-project',
                    updateHistoryItem: vi.fn(),
                    setActiveReferenceImage: vi.fn(),
                    uploadedImages: [],
                    addUploadedImage: vi.fn(),
                    userProfile: {
                        brandKit: {
                            brandDescription: 'Cool Brand',
                            releaseDetails: { mood: 'Dark', themes: 'Synthwave' },
                            colors: ['#FF00FF'],
                            fonts: 'Inter'
                        }
                    }
                };
                return selector ? selector(state) : state;
            });

            return (
                <div>
                    <CreativeNavbar />
                    <CreativeGallery />
                    {selectedItem && (
                        <CreativeCanvas
                            item={selectedItem}
                            onClose={() => setSelectedItem(null)}
                        />
                    )}
                </div>
            );
        };

        render(<DaisychainApp />);

        // --- CLICK 1: Select Item in Gallery ---
        const galleryItem = screen.getByTestId('gallery-item-test-123');
        fireEvent.click(galleryItem);

        // --- CLICK 2: Open Fullsize Canvas ---
        const maximizeBtn = screen.getByTestId('view-fullsize-btn');
        fireEvent.click(maximizeBtn);

        // Canvas should now be open
        expect(screen.getByTestId('creative-canvas-container')).toBeInTheDocument();

        // --- CLICK 3: Interact with Builder in Navbar ---
        const builderBtn = screen.getByTestId('builder-btn');
        expect(builderBtn).toBeInTheDocument();
    });
});
