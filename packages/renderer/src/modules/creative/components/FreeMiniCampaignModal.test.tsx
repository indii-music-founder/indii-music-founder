import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FreeMiniCampaignModal } from './FreeMiniCampaignModal';
import { FreeMiniCampaignService } from '@/services/creative/FreeMiniCampaignService';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}));

describe('FreeMiniCampaignModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob');
        globalThis.URL.revokeObjectURL = vi.fn();
    });

    it('renders nothing when isOpen is false', () => {
        const { container } = render(<FreeMiniCampaignModal {...defaultProps} isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders intake step with title and inputs when open', () => {
        render(<FreeMiniCampaignModal {...defaultProps} />);

        expect(screen.getByText('Guided Free Mini-Campaign')).toBeInTheDocument();
        expect(screen.getByText('Finished Audio Track')).toBeInTheDocument();
        expect(screen.getByText('Artwork Image')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /generate unwatermarked campaign pack/i })).toBeDisabled();
    });

    it('calls onClose when close button is clicked', () => {
        render(<FreeMiniCampaignModal {...defaultProps} />);

        const closeBtn = screen.getByLabelText('Close modal');
        fireEvent.click(closeBtn);

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('progresses to preview and displays unwatermarked guarantee after intake', async () => {
        render(<FreeMiniCampaignModal {...defaultProps} />);

        const titleInput = screen.getByPlaceholderText(/electric dreams/i);
        fireEvent.change(titleInput, { target: { value: 'Sunset Glow' } });

        // Simulate file inputs
        const audioInput = screen.getByLabelText(/select song file/i);
        const audioFile = new File(['dummy-audio'], 'sunset.mp3', { type: 'audio/mpeg' });
        fireEvent.change(audioInput, { target: { files: [audioFile] } });

        const imageInput = screen.getByLabelText(/select image file/i);
        const imageFile = new File(['dummy-image'], 'cover.png', { type: 'image/png' });
        fireEvent.change(imageInput, { target: { files: [imageFile] } });

        const generateBtn = screen.getByRole('button', { name: /generate unwatermarked campaign pack/i });

        await waitFor(() => {
            expect(generateBtn).not.toBeDisabled();
        });

        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(screen.getByText(/square cover/i)).toBeInTheDocument();
            expect(screen.getByText(/story \/ reel promo/i)).toBeInTheDocument();
            expect(screen.getByText(/8s teaser clip/i)).toBeInTheDocument();
            expect(screen.getByText(/100% unwatermarked/i)).toBeInTheDocument();
        });
    });

    it('progresses to decision step and supports permanent deletion choice', async () => {
        vi.spyOn(FreeMiniCampaignService, 'enforceSaveOrDelete').mockResolvedValue({
            action: 'deleted',
            purgedUrisCount: 1,
            message: 'All uploads and generated files permanently purged.',
            timestamp: '2026-09-18T12:00:00Z',
        });

        render(<FreeMiniCampaignModal {...defaultProps} />);

        // Intake
        const audioInput = screen.getByLabelText(/select song file/i);
        const audioFile = new File(['dummy-audio'], 'sunset.mp3', { type: 'audio/mpeg' });
        fireEvent.change(audioInput, { target: { files: [audioFile] } });

        const imageInput = screen.getByLabelText(/select image file/i);
        const imageFile = new File(['dummy-image'], 'cover.png', { type: 'image/png' });
        fireEvent.change(imageInput, { target: { files: [imageFile] } });

        const generateBtn = screen.getByRole('button', { name: /generate unwatermarked campaign pack/i });
        await waitFor(() => expect(generateBtn).not.toBeDisabled());
        fireEvent.click(generateBtn);

        // Preview -> Download All
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /download complete pack/i })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /download complete pack/i }));

        // Decision -> Delete Option
        await waitFor(() => {
            expect(screen.getByText(/pack exported successfully/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /permanently delete all/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /permanently delete all/i }));

        await waitFor(() => {
            expect(screen.getByText('Choice Enforced')).toBeInTheDocument();
            expect(screen.getByText(/permanently purged/i)).toBeInTheDocument();
        });
    });
});
