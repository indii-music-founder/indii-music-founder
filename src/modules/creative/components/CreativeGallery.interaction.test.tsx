import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeGallery from './CreativeGallery';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// 🖱️ Click Persona: Interaction Lifecycle Test
// Component: CreativeGallery
// Focus: Interaction Lifecycle (Click → Action → Feedback)

vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn()
}));

describe('🖱️ Click: CreativeGallery Interaction', () => {
    const mockRemoveFromHistory = vi.fn();
    const mockSetVideoInput = vi.fn();
    const mockSetSelectedItem = vi.fn();
    const mockToastSuccess = vi.fn();

    const mockItem = {
        id: 'test-123',
        url: 'test.jpg',
        type: 'image',
        prompt: 'Sunset over mountains',
        timestamp: Date.now(),
        projectId: 'p1',
        origin: 'generated'
    };

    const mockStore = {
        generatedHistory: [mockItem],
        uploadedImages: [],
        uploadedAudio: [],
        removeFromHistory: mockRemoveFromHistory,
        addUploadedImage: vi.fn(),
        removeUploadedImage: vi.fn(),
        addUploadedAudio: vi.fn(),
        removeUploadedAudio: vi.fn(),
        currentProjectId: 'p1',
        generationMode: 'image',
        setVideoInput: mockSetVideoInput,
        selectedItem: null,
        setSelectedItem: mockSetSelectedItem,
        addCharacterReference: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(mockStore);
        (useToast as any).mockReturnValue({
            success: mockToastSuccess,
            error: vi.fn()
        });
    });

    it('verifies the Maximize lifecycle (Fixes dead click → setSelectedItem)', async () => {
        render(<CreativeGallery />);

        // 🔍 Isolate
        const maximizeBtn = screen.getByTestId('view-fullsize-btn');

        // ⚡ Action
        fireEvent.click(maximizeBtn);

        // ✅ Assert Action: Verify setSelectedItem was called
        expect(mockSetSelectedItem).toHaveBeenCalledWith(mockItem);
    });

    it('verifies the Delete Asset lifecycle (Click → Action)', async () => {
        render(<CreativeGallery />);

        // 🔍 Isolate
        const deleteBtn = screen.getByTestId('delete-asset-btn');
        expect(deleteBtn).toBeInTheDocument();

        // ⚡ Action
        fireEvent.click(deleteBtn);

        // ✅ Assert Action: Verify removeFromHistory was called
        expect(mockRemoveFromHistory).toHaveBeenCalledWith('test-123');
    });

    it('verifies the Video Set Frame lifecycle in Video Mode (Click → Action → Feedback)', async () => {
        (useStore as any).mockReturnValue({
            ...mockStore,
            generationMode: 'video'
        });

        render(<CreativeGallery />);

        // 🔍 Isolate
        const setFirstFrameBtn = screen.getByTestId('set-first-frame-btn');

        // ⚡ Action
        fireEvent.click(setFirstFrameBtn);

        // ✅ Assert Action
        expect(mockSetVideoInput).toHaveBeenCalledWith('firstFrame', mockItem);

        // ✅ Assert Feedback: Toast confirmation
        expect(mockToastSuccess).toHaveBeenCalledWith("Set as First Frame");
    });

    it('verifies the Set as Character Reference lifecycle (Click → Action → Feedback)', async () => {
        const mockAddCharacterReference = vi.fn();
        (useStore as any).mockReturnValue({
            ...mockStore,
            addCharacterReference: mockAddCharacterReference
        });

        render(<CreativeGallery />);

        // 🔍 Isolate
        const anchorBtn = screen.getByTestId('set-anchor-btn');

        // ⚡ Action
        fireEvent.click(anchorBtn);

        // ✅ Assert Action
        expect(mockAddCharacterReference).toHaveBeenCalledWith({ image: mockItem, referenceType: 'subject' });

        // ✅ Assert Feedback: Toast confirmation (Check exact message from component)
        expect(mockToastSuccess).toHaveBeenCalledWith("Character Reference Set");
    });

    it('verifies the Like lifecycle (Click → Feedback)', async () => {
        render(<CreativeGallery />);
        const likeBtn = screen.getByTestId('like-btn');
        fireEvent.click(likeBtn);
        expect(mockToastSuccess).toHaveBeenCalledWith("Feedback recorded: Liked");
    });

    it('verifies the Dislike lifecycle (Click → Feedback)', async () => {
        render(<CreativeGallery />);
        const dislikeBtn = screen.getByTestId('dislike-btn');
        fireEvent.click(dislikeBtn);
        expect(mockToastSuccess).toHaveBeenCalledWith("Feedback recorded: Disliked");
    });
});
