import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreativeNavbar from './CreativeNavbar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { ScreenControl } from '@/services/screen/ScreenControlService';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('@/services/video/VideoGenerationService');
vi.mock('@/services/image/ImageGenerationService');
vi.mock('@/services/screen/ScreenControlService');
vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

// Mock child components to simplify testing
vi.mock('./PromptBuilder', () => ({
    default: ({ onAddTag }: { onAddTag: (tag: string) => void }) => (
        <div data-testid="prompt-builder">
            <button onClick={() => onAddTag('test tag')}>Add Tag</button>
        </div>
    )
}));

vi.mock('./BrandAssetsDrawer', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="brand-assets-drawer">
            <button onClick={onClose}>Close Drawer</button>
        </div>
    )
}));

vi.mock('./ImageSubMenu', () => ({
    default: ({ onShowBrandAssets }: { onShowBrandAssets: () => void }) => (
        <div data-testid="image-sub-menu">
            <button onClick={onShowBrandAssets}>Toggle Brand Assets</button>
        </div>
    )
}));

vi.mock('../../video/components/FrameSelectionModal', () => ({
    default: ({ isOpen, onClose, onSelect }: any) => isOpen ? (
        <div data-testid="frame-selection-modal">
            <button onClick={onClose}>Close Modal</button>
            <button onClick={() => onSelect({ url: 'test-frame.png' })}>Select Frame</button>
        </div>
    ) : null
}));

describe('CreativeNavbar', () => {
    const mockSetGenerationMode = vi.fn();
    const mockSetStudioControls = vi.fn();
    const mockSetVideoInput = vi.fn();
    const mockAddToHistory = vi.fn();
    const mockSetPrompt = vi.fn();
    const mockToggleAgentWindow = vi.fn();
    const mockToast = { success: vi.fn(), error: vi.fn() };

    const defaultStore = {
        currentProjectId: 'test-project',
        addToHistory: mockAddToHistory,
        studioControls: {
            resolution: '1K',
            aspectRatio: '16:9',
            negativePrompt: '',
            seed: ''
        },
        generationMode: 'image',
        setGenerationMode: mockSetGenerationMode,
        videoInputs: {
            firstFrame: null,
            lastFrame: null,
            timeOffset: 0,
            isDaisyChain: false
        },
        setVideoInput: mockSetVideoInput,
        addUploadedImage: vi.fn(),
        generatedHistory: [],
        setSelectedItem: vi.fn(),
        setActiveReferenceImage: vi.fn(),
        setViewMode: vi.fn(),
        prompt: '',
        setPrompt: mockSetPrompt,
        toggleAgentWindow: mockToggleAgentWindow,
        userProfile: {
            brandKit: {
                colors: ['#000000'],
                brandAssets: [],
                referenceImages: []
            }
        },
        setStudioControls: mockSetStudioControls
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(defaultStore);
        (useStore as any).getState = () => defaultStore;
        (useToast as any).mockReturnValue(mockToast);
    });

    it('renders correctly', () => {
        render(<CreativeNavbar />);
        expect(screen.getByText('indiiOS')).toBeInTheDocument();
        expect(screen.getByText('Superuser')).toBeInTheDocument();
        // "Image" text is in the mode dropdown button
        expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('toggles generation mode', () => {
        render(<CreativeNavbar />);

        // Open dropdown - find button containing "Image"
        // Since we mocked ImageSubMenu, the only "Image" text should be in the dropdown button
        const modeButton = screen.getByText('Image').closest('button');
        fireEvent.click(modeButton!);

        // Click Video Mode
        const videoOption = screen.getByText('Video Mode');
        fireEvent.click(videoOption);

        expect(mockSetGenerationMode).toHaveBeenCalledWith('video');
    });

    it('opens and closes brand assets drawer', () => {
        render(<CreativeNavbar />);

        // Click the toggle button in the mocked ImageSubMenu
        const toggleButton = screen.getByText('Toggle Brand Assets');
        fireEvent.click(toggleButton);

        // Check if drawer is opened
        expect(screen.getByTestId('brand-assets-drawer')).toBeInTheDocument();

        // Close it
        const closeButton = screen.getByText('Close Drawer');
        fireEvent.click(closeButton);

        // Check if drawer is closed (it might not be removed from DOM immediately if using AnimatePresence, but here we mocked it as simple div)
        // In the real component, it's conditional rendering: {showBrandAssets && (<BrandAssetsDrawer ... />)}
        expect(screen.queryByTestId('brand-assets-drawer')).not.toBeInTheDocument();
    });

    it('opens projector window', async () => {
        (ScreenControl.requestPermission as any).mockResolvedValue(true);
        render(<CreativeNavbar />);

        const projectorButton = screen.getByText('Projector');
        fireEvent.click(projectorButton);

        await waitFor(() => {
            expect(ScreenControl.openProjectorWindow).toHaveBeenCalled();
        });
    });
});
