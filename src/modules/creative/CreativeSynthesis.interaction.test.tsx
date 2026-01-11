import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeGallery from './components/CreativeGallery';
import { CommandBar } from '@/core/components/CommandBar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { VideoGeneration } from '@/services/video/VideoGenerationService';

// 🔌 Mock Deputies (Services)
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        subscribeToJob: vi.fn(),
    }
}));

// 🍞 Mock Toast
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
};
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
    ToastProvider: ({ children }: any) => <div>{children}</div>
}));

// 🏦 Stateful Store Mock (The "Brain")
// We need a real state container to verify the "Daisychain" of data
const storeState = {
    // Creative Slice
    generatedHistory: [] as any[],
    activeReferenceImage: null,
    entityAnchor: null,
    videoInputs: {
        firstFrame: null,
        lastFrame: null,
        isDaisyChain: false
    },
    // App Slice
    isRightPanelOpen: false,
    viewMode: 'gallery',
    generationMode: 'image', // Start in image mode

    // Actions (Spies)
    setVideoInput: vi.fn((key, val) => {
        storeState.videoInputs = { ...storeState.videoInputs, [key]: val };
    }),
    setEntityAnchor: vi.fn((val) => { storeState.entityAnchor = val; }),
    addToHistory: vi.fn((item) => { storeState.generatedHistory.unshift(item); }),
    setGenerationMode: vi.fn((mode) => { storeState.generationMode = mode; }),

    // Command Bar Requirements
    input: '',
    setInput: vi.fn(),
    isProcessing: false,
    setIsProcessing: vi.fn(),
    attachments: [],

    // User Profile
    userProfile: { id: 'u1', name: 'Tester' },
    updateBrandKit: vi.fn(),
};

vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => storeState)
}));

// 🧩 Mock Components
vi.mock('./components/CreativeNavbar', () => ({
    default: () => <div data-testid="creative-navbar">Navbar</div>
}));

describe('🔗 The Creative Synthesis: Daisychain Audit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset state
        storeState.generatedHistory = [];
        storeState.videoInputs = { firstFrame: null, lastFrame: null, isDaisyChain: false };
        storeState.generationMode = 'image';
    });

    it('executes the 6-click "Generation to Context" daisychain', async () => {
        // We render a fragment that represents the user's view
        const { rerender } = render(
            <>
                <CreativeGallery />
                <CommandBar />
            </>
        );

        // --- STEP 1: Entry (Implicitly validated by render) ---
        // Just verify we are in the gallery
        expect(screen.getByTestId('creative-gallery')).toBeInTheDocument();

        // --- STEP 2: Composition (Typing) ---
        const input = screen.getByPlaceholderText(/Describe your task/i);
        fireEvent.change(input, { target: { value: 'A futuristic glass-morphic building' } });

        // --- STEP 3: Generation (Click Run) ---
        const runBtn = screen.getByTestId('command-bar-run-btn');
        fireEvent.click(runBtn);

        // Simulate the "Generation" completing and adding to history
        // (The real app uses a service, we simulate the effect here)
        act(() => {
            storeState.addToHistory({
                id: 'gen-123',
                url: 'https://example.com/glass-building.png',
                type: 'image',
                timestamp: Date.now(),
                prompt: 'A futuristic glass-morphic building'
            });
        });

        // Re-render to show the new item
        rerender(
            <>
                <CreativeGallery />
                <CommandBar />
            </>
        );

        // --- STEP 4: Focus (Select Asset) ---
        // Find the newly generated item
        const generatedItem = screen.getByAltText('A futuristic glass-morphic building');
        expect(generatedItem).toBeInTheDocument();

        // --- STEP 5: Context Set (Set First Frame) ---
        // In "Image Mode", we assume the user might switch to "Video Mode" OR use a context tool.
        // Wait, the "Set First Frame" button is ONLY visible if generationMode === 'video'.
        // So we must simulate the user switching to video mode first?
        // OR the gallery shows these buttons always?
        // Let's check CreativeGallery.tsx logic...
        // It says: {generationMode === 'video' && (...) <button data-testid="set-first-frame-btn">...}

        // Ah, so Step 1 should have been "Switch to Video Mode" or "Creative Director (Video)".
        // Let's simulate clicking a "Switch to Video" button if we can, or manually force it.
        // For this test, we'll manually force the state change to enable the button,
        // mimicking the user clicking the "Video" tab in the real app.
        act(() => {
            storeState.generationMode = 'video';
        });

        // Re-render to reveal video controls
        rerender(
            <>
                <CreativeGallery />
                <CommandBar />
            </>
        );

        const setFirstFrameBtn = screen.getByTestId('set-first-frame-btn');
        fireEvent.click(setFirstFrameBtn);

        // --- STEP 6: Pivot & Verification ---
        // Verify the toast feedback
        expect(mockToast.success).toHaveBeenCalledWith('Set as First Frame');

        // Verify the Store "Daisychain"
        // This confirms that the 'First Frame' slot in the Video Producer (the store) received the asset
        expect(storeState.setVideoInput).toHaveBeenCalledWith(
            'firstFrame',
            expect.objectContaining({
                id: 'gen-123',
                url: 'https://example.com/glass-building.png'
            })
        );

        // In a real browser test, we'd visually check the Video Producer "First Frame" slot.
        // Here, the Store assertion proves the data link is active.
    });
});
