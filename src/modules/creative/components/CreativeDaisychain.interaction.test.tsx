import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    const mockSetPrompt = vi.fn();
    const mockSetViewMode = vi.fn();
    const mockAddWhiskItem = vi.fn();
    const mockSetPendingPrompt = vi.fn();
    const mockSetGenerationMode = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useToast as any).mockReturnValue({
            info: mockToastInfo,
            success: mockToastSuccess,
            warning: vi.fn(),
            error: vi.fn()
        });

        // Mock store.getState() for handleRefine
        (useStore as any).getState = () => ({
            addWhiskItem: mockAddWhiskItem,
            setPendingPrompt: mockSetPendingPrompt,
            setViewMode: mockSetViewMode,
            setGenerationMode: mockSetGenerationMode,
            updateWhiskItem: vi.fn()
        });
    });

    it('successfully completes the 6-click daisychain: Gallery -> Canvas -> Refine -> Builder -> Tag', async () => {
        // Stateful Wrapper to handle store-like behavior
        const DaisychainApp = () => {
            const [selectedItem, setSelectedItem] = useState<any>(null);
            const [prompt, setLocalPrompt] = useState('Initial Prompt');

            // Mock implementation of useStore within this component's scope
            (useStore as any).mockImplementation((selector: any) => {
                const state = {
                    generatedHistory: [mockItem],
                    selectedItem,
                    setSelectedItem: (item: any) => {
                        setSelectedItem(item);
                    },
                    setViewMode: mockSetViewMode,
                    viewMode: 'gallery',
                    generationMode: 'image',
                    setGenerationMode: mockSetGenerationMode,
                    addWhiskItem: mockAddWhiskItem,
                    setPendingPrompt: mockSetPendingPrompt,
                    prompt,
                    setPrompt: (newPrompt: string) => {
                        setLocalPrompt(newPrompt);
                        mockSetPrompt(newPrompt);
                    },
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
                            onRefine={() => {
                                // Simulate actual handleRefine behavior from CreativeCanvas.tsx
                                mockToastInfo("Refining...");
                                mockSetViewMode('gallery');
                                mockAddWhiskItem('subject', 'image', mockItem.url, mockItem.prompt, 'mock-uuid');
                                setSelectedItem(null);
                            }}
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

        // --- CLICK 3: Refine In Canvas ---
        const refineBtn = await screen.findByTestId('refine-btn');
        fireEvent.click(refineBtn);

        // --- CLICK 4: Open Prompt Builder in Navbar ---
        const builderBtn = screen.getByTestId('builder-btn');
        fireEvent.click(builderBtn);

        // --- CLICK 5: Open Category Dropdown ---
        const brandTrigger = await screen.findByTestId('category-Brand-trigger');
        fireEvent.click(brandTrigger);

        // --- CLICK 6: Select a Tag ---
        const tagBtn = await screen.findByTestId('tag-Cool Brand-btn');
        fireEvent.click(tagBtn);

        // FINAL VERIFICATION
        expect(mockSetPrompt).toHaveBeenCalledWith('Initial Prompt, Cool Brand');
    });
});
