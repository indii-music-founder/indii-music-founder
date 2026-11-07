import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FreeMiniCampaignModal } from './FreeMiniCampaignModal';
import { FreeMiniCampaignService } from '@/services/creative/FreeMiniCampaignService';
import * as typesafeJudgments from '@/config/typesafeJudgments';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    }),
}));

describe('FreeMiniCampaignModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        userId: 'structural-test-user',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob');
        globalThis.URL.revokeObjectURL = vi.fn();
        vi.spyOn(FreeMiniCampaignService, 'createAudioClip').mockResolvedValue({
            url: 'blob:http://localhost/mock-teaser.wav',
            durationSeconds: 8,
        });
        vi.spyOn(FreeMiniCampaignService, 'analyzeSongForHook').mockResolvedValue([
            { section: 'CHORUS', startTimeSeconds: 24, endTimeSeconds: 48, energyLevel: 'high', lyricSnippet: '' },
        ]);
        vi.spyOn(typesafeJudgments, 'judgeSocialAudioSnippetSelection').mockResolvedValue({
            recommendedSection: 'CHORUS',
            suggestedStartTimeSeconds: 24,
            suggestedEndTimeSeconds: 39,
            viralHookPotential: 4,
            isImmediateVocalOnset: true,
            hookStrategy: 'Structural test selection',
        });
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

    it('progresses to preview and identifies the digital artwork and teaser assets', async () => {
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
            expect(screen.getByText(/square artwork/i)).toBeInTheDocument();
            expect(screen.getByText(/story \/ reel promo/i)).toBeInTheDocument();
            expect(screen.getByText(/15s song teaser/i)).toBeInTheDocument();
            expect(screen.getByText(/No watermark\. Image size/i)).toBeInTheDocument();
            expect(screen.getByText(/digital crops are not print-ready masters/i)).toBeInTheDocument();
            expect(FreeMiniCampaignService.createAudioClip).toHaveBeenCalledWith(audioFile, 24, 15);
        });
    });

    it('lets the user remove in-session copies after exporting', async () => {
        vi.spyOn(FreeMiniCampaignService, 'enforceSaveOrDelete').mockResolvedValue({
            action: 'deleted',
            purgedUrisCount: 0,
            message: 'In-session previews removed.',
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
            expect(screen.getByRole('button', { name: /remove in-session copies/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /remove in-session copies/i }));

        await waitFor(() => {
            expect(screen.getByText('Choice Enforced')).toBeInTheDocument();
            expect(screen.getByText(/in-session previews removed/i)).toBeInTheDocument();
        });
    });
});
