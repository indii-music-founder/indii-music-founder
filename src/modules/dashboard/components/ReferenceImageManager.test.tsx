import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ReferenceImageManager from './ReferenceImageManager';

const updateBrandKitMock = vi.fn();
const uploadFileMock = vi.fn().mockResolvedValue('https://mock-storage-url.com/image.png');

vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: {
            id: 'mock-user-id',
            brandKit: {
                referenceImages: [
                    { url: 'data:image/png;base64,mock1', description: 'Selfie 1' },
                    { url: 'data:image/png;base64,mock2', description: 'Art Style' }
                ]
            }
        },
        updateBrandKit: updateBrandKitMock
    })
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        uploadFile: (...args: any[]) => uploadFileMock(...args)
    }
}));

// Mock WebcamCapture to avoid mediaDevices issues in test env
vi.mock('./WebcamCapture', () => ({
    default: ({ onCapture, onClose }: any) => (
        <div data-testid="webcam-mock">
            <button onClick={() => onCapture(new Blob(['mock-data'], { type: 'image/png' }))}>Capture</button>
            <button onClick={onClose}>Close</button>
        </div>
    )
}));

describe('ReferenceImageManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders reference images from store', () => {
        render(<ReferenceImageManager />);
        expect(screen.getByText('Reference Images')).toBeInTheDocument();
        expect(screen.getByText('Selfie 1')).toBeInTheDocument();
        expect(screen.getByText('Art Style')).toBeInTheDocument();
    });

    it('renders upload and camera buttons', () => {
        render(<ReferenceImageManager />);
        expect(screen.getByText('Upload')).toBeInTheDocument();
        expect(screen.getByText('Use Camera')).toBeInTheDocument();
    });

    it('opens webcam modal when camera button is clicked', () => {
        render(<ReferenceImageManager />);
        fireEvent.click(screen.getByText('Use Camera'));
        expect(screen.getByTestId('webcam-mock')).toBeInTheDocument();
    });

    it('handles camera capture flow', async () => {
        render(<ReferenceImageManager />);
        fireEvent.click(screen.getByText('Use Camera'));

        const captureBtn = screen.getByText('Capture');
        fireEvent.click(captureBtn);

        await waitFor(() => {
            expect(uploadFileMock).toHaveBeenCalled();
            expect(updateBrandKitMock).toHaveBeenCalled();
        });

        // Verify the updateBrandKit call contains the new image from "Storage"
        const lastCall = updateBrandKitMock.mock.calls[0][0];
        const newImage = lastCall.referenceImages[lastCall.referenceImages.length - 1];
        expect(newImage.url).toBe('https://mock-storage-url.com/image.png');
    });

    it('calls updateBrandKit when an image is deleted', () => {
        render(<ReferenceImageManager />);
        const allButtons = screen.getAllByRole('button');
        // Filter out main action buttons to find trash icons
        const deleteButtons = allButtons.filter(btn => !btn.textContent?.includes('Upload') && !btn.textContent?.includes('Use Camera'));

        expect(deleteButtons.length).toBeGreaterThan(0);

        fireEvent.click(deleteButtons[0]);

        expect(updateBrandKitMock).toHaveBeenCalledTimes(1);
    });
});
