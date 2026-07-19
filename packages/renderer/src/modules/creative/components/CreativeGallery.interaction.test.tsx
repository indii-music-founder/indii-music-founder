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
    const mockRemoveItemFromProject = vi.fn();
    const mockSetVideoInput = vi.fn();
    const mockSetSelectedItem = vi.fn();
    const mockSendToStage = vi.fn();
    const mockToastSuccess = vi.fn();
    const mockToastInfo = vi.fn();

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
        removeItemFromProject: mockRemoveItemFromProject,
        addUploadedImage: vi.fn(),
        removeUploadedImage: vi.fn(),
        addUploadedAudio: vi.fn(),
        removeUploadedAudio: vi.fn(),
        currentProjectId: 'p1',
        generationMode: 'image',
        setVideoInput: mockSetVideoInput,
        selectedItem: null,
        setSelectedItem: mockSetSelectedItem,
        sendToStage: mockSendToStage,
        sendToModule: vi.fn(),
        pinToClipboard: vi.fn(),
        addCharacterReference: vi.fn(),
        setPrompt: vi.fn(),
        setCreativePrompt: vi.fn(),
        setViewMode: vi.fn(),
        playTrack: vi.fn(),
        pauseTrack: vi.fn(),
        resumeTrack: vi.fn(),
        stopTrack: vi.fn(),
        currentTrack: null,
        isPlaying: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => selector ? selector(mockStore) : mockStore);
        (useToast as unknown as import("vitest").Mock).mockReturnValue({
            success: mockToastSuccess,
            info: mockToastInfo,
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

        // ✅ Assert Action: Verify removeItemFromProject was called
        expect(mockRemoveItemFromProject).toHaveBeenCalledWith('test-123');
    });

    it('verifies the Video Set Frame lifecycle in Video Mode (Click → Action → Feedback)', async () => {
        (useStore as unknown as import("vitest").Mock).mockReturnValue({
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
        (useStore as unknown as import("vitest").Mock).mockReturnValue({
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

    it('routes an image to Omni as a true starting frame', () => {
        render(<CreativeGallery />);

        fireEvent.click(screen.getByRole('button', { name: 'Send to workspace' }));
        fireEvent.click(screen.getByText('→ Omni (start)'));

        expect(mockSendToStage).toHaveBeenCalledWith('omni', expect.objectContaining({
            item: mockItem,
            role: 'first-frame',
            originStage: 'image',
        }));
    });

    // ISSUE-922: upload toast must reflect real per-file outcomes, never a
    // blanket success fired before reads/persistence finish.
    describe('ISSUE-922: honest upload reporting', () => {
        const makeFile = (name: string, type: string, sizeBytes = 10) =>
            new File([new Uint8Array(sizeBytes)], name, { type });

        it('reports success only after durable persistence resolves true', async () => {
            const mockAddImage = vi.fn().mockResolvedValue(true);
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
                const s = { ...mockStore, addUploadedImage: mockAddImage };
                return selector ? selector(s) : s;
            });
            render(<CreativeGallery />);

            const input = screen.getAllByTestId('gallery-upload-input')[0];
            fireEvent.change(input, { target: { files: [makeFile('art.png', 'image/png')] } });

            await vi.waitFor(() => {
                expect(mockAddImage).toHaveBeenCalled();
                expect(mockToastSuccess).toHaveBeenCalledWith('1 asset(s) uploaded.');
            });
        });

        it('reports failure when persistence resolves false and never claims success', async () => {
            const mockAddImage = vi.fn().mockResolvedValue(false);
            const mockToastError = vi.fn();
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
                const s = { ...mockStore, addUploadedImage: mockAddImage };
                return selector ? selector(s) : s;
            });
            (useToast as unknown as import("vitest").Mock).mockReturnValue({
                success: mockToastSuccess,
                info: mockToastInfo,
                error: mockToastError
            });
            render(<CreativeGallery />);

            const input = screen.getAllByTestId('gallery-upload-input')[0];
            fireEvent.change(input, { target: { files: [makeFile('art.png', 'image/png')] } });

            await vi.waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('1 asset(s) failed to save'));
            });
            expect(mockToastSuccess).not.toHaveBeenCalled();
        });

        it('skips unsupported and oversized files with an explicit message', async () => {
            const mockAddImage = vi.fn().mockResolvedValue(true);
            const mockToastError = vi.fn();
            (useStore as unknown as import("vitest").Mock).mockImplementation((selector: any) => {
                const s = { ...mockStore, addUploadedImage: mockAddImage };
                return selector ? selector(s) : s;
            });
            (useToast as unknown as import("vitest").Mock).mockReturnValue({
                success: mockToastSuccess,
                info: mockToastInfo,
                error: mockToastError
            });
            render(<CreativeGallery />);

            const input = screen.getAllByTestId('gallery-upload-input')[0];
            const oversized = makeFile('huge.png', 'image/png');
            Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 });
            fireEvent.change(input, {
                target: { files: [makeFile('doc.pdf', 'application/pdf'), oversized] }
            });

            await vi.waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('doc.pdf (unsupported type)'));
                expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('huge.png (over 25MB limit)'));
            });
            expect(mockAddImage).not.toHaveBeenCalled();
            expect(mockToastSuccess).not.toHaveBeenCalled();
        });
    });

    it('verifies the Like lifecycle (Click → Feedback)', async () => {
        render(<CreativeGallery />);
        const likeBtn = screen.getByTestId('like-btn');
        fireEvent.click(likeBtn);
        expect(mockToastInfo).toHaveBeenCalledWith("Liked");
    });

    it('verifies the Dislike lifecycle (Click → Feedback)', async () => {
        render(<CreativeGallery />);
        const dislikeBtn = screen.getByTestId('dislike-btn');
        fireEvent.click(dislikeBtn);
        expect(mockToastInfo).toHaveBeenCalledWith("Disliked");
    });
});
