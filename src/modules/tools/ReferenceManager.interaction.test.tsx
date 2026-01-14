import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReferenceManager from './ReferenceManager';
import { useStore } from '@/core/store';
import { StorageService } from '@/services/StorageService';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/services/StorageService');
vi.mock('./components/WebcamCapture', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="webcam-mock">
            <button onClick={onClose} data-testid="close-camera">Close</button>
        </div>
    )
}));

describe('ReferenceManager Interaction (🖱️ Click)', () => {
    const mockUpdateBrandKit = vi.fn();
    const mockUserProfile = {
        id: 'u123',
        brandKit: {
            referenceImages: []
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            userProfile: mockUserProfile,
            updateBrandKit: mockUpdateBrandKit,
        });
    });

    it('verifies the Upload Files lifecycle (Action → Loading → Success)', async () => {
        render(<ReferenceManager />);

        const uploadBtn = screen.getByTestId('upload-btn');

        // Find the hidden file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();

        // 1. Action: Trigger File Upload
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });

        // Mock StorageService.uploadFile to return a controlled promise
        let resolveUpload: any;
        const uploadPromise = new Promise((resolve) => {
            resolveUpload = resolve;
        });
        (StorageService.uploadFile as any).mockReturnValue(uploadPromise);

        // Simulate choosing a file
        fireEvent.change(fileInput, { target: { files: [file] } });

        // 2. Feedback: Loading State
        // The processFiles function is called in handleFileUpload
        await waitFor(() => {
            expect(uploadBtn).toBeDisabled();
            expect(screen.getByTestId('upload-loader')).toBeInTheDocument();
        });

        // 3. Completion: Resolve the upload promise
        resolveUpload('https://example.com/hello.png');

        await waitFor(() => {
            // Button should be re-enabled
            expect(uploadBtn).not.toBeDisabled();
            expect(screen.queryByTestId('upload-loader')).not.toBeInTheDocument();

            // Store should be updated with new asset
            expect(mockUpdateBrandKit).toHaveBeenCalledWith({
                referenceImages: [
                    {
                        id: expect.any(String),
                        url: 'https://example.com/hello.png',
                        description: 'hello.png'
                    }
                ]
            });

            // Input should be cleared for next upload
            expect(fileInput.value).toBe('');
        });
    });

    it('verifies the Camera toggle lifecycle (Action → Visibility → Dismiss)', () => {
        render(<ReferenceManager />);

        const cameraBtn = screen.getByTestId('camera-btn');

        // 1. Ready State: Camera UI is hidden
        expect(screen.queryByTestId('webcam-mock')).not.toBeInTheDocument();

        // 2. Action: Click 'Use Camera'
        fireEvent.click(cameraBtn);

        // 3. Feedback: Camera UI appears
        expect(screen.getByTestId('webcam-mock')).toBeInTheDocument();

        // 4. Action: Click 'Close' on camera UI
        fireEvent.click(screen.getByTestId('close-camera'));

        // 5. Return to Ready State: Camera UI is hidden again
        expect(screen.queryByTestId('webcam-mock')).not.toBeInTheDocument();
    });

    it('verifies the "Add New" placeholder clicks the hidden input', () => {
        render(<ReferenceManager />);

        const addNewBtn = screen.getByTestId('add-new-btn');
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        // Mock the native click() method
        const clickSpy = vi.spyOn(fileInput, 'click');

        // Action: Click 'Add New'
        fireEvent.click(addNewBtn);

        // Feedback: Internal input is triggered
        expect(clickSpy).toHaveBeenCalled();
    });
});
