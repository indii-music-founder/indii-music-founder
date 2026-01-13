import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AIGenerateCampaignModal from './AIGenerateCampaignModal';
import { useToast } from '@/core/context/ToastContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as matchers from 'vitest-axe/matchers';
import { axe } from 'vitest-axe';

// Extend expect with vitest-axe matchers
expect.extend(matchers);

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn()
}));

// Mock CampaignAIService
vi.mock('@/services/marketing/CampaignAIService', () => ({
    CampaignAI: {
        generateCampaign: vi.fn().mockResolvedValue({
            title: 'Mock Campaign',
            description: 'A mock campaign description',
            posts: []
        }),
        planToCampaignAsset: vi.fn()
    }
}));

describe('AIGenerateCampaignModal Accessibility', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useToast).mockReturnValue({
            success: vi.fn(),
            error: vi.fn(),
            showToast: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
            loading: vi.fn(),
            dismiss: vi.fn(),
            updateProgress: vi.fn(),
            promise: vi.fn()
        });
    });

    it('should have no automatically detectable accessibility violations', async () => {
        const { container } = render(
            <AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should implement the dialog role correctly', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        const dialog = screen.getByRole('dialog', { hidden: true }); // hidden: true sometimes needed if aria-modal missing
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('close button should have an accessible name', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // Try to find by label text first, which validates the aria-label
        const closeButton = screen.getByRole('button', { name: /close/i });
        expect(closeButton).toBeInTheDocument();
    });

    it('objective selection buttons should use aria-pressed', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // Find the 'Launch' objective which is selected by default
        const launchButton = screen.getByRole('button', { name: /Launch/i });
        expect(launchButton).toHaveAttribute('aria-pressed', 'true');

        // Find the 'Awareness' objective which is not selected
        const awarenessButton = screen.getByRole('button', { name: /Awareness/i });
        expect(awarenessButton).toHaveAttribute('aria-pressed', 'false');

        // Interaction Check
        fireEvent.click(awarenessButton);
        expect(awarenessButton).toHaveAttribute('aria-pressed', 'true');
        expect(launchButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('platform toggle buttons should use aria-pressed and update on click', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // Instagram is selected by default
        const instagramButton = screen.getByRole('button', { name: /Instagram/i });
        expect(instagramButton).toHaveAttribute('aria-pressed', 'true');

        // LinkedIn is not selected by default
        const linkedinButton = screen.getByRole('button', { name: /LinkedIn/i });
        expect(linkedinButton).toHaveAttribute('aria-pressed', 'false');

        // Click LinkedIn to select it
        fireEvent.click(linkedinButton);
        expect(linkedinButton).toHaveAttribute('aria-pressed', 'true');

        // Click Instagram to deselect it
        fireEvent.click(instagramButton);
        expect(instagramButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('tone selection buttons should use aria-pressed and update on click', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        // 'Professional' is selected by default
        const proButton = screen.getByRole('button', { name: /Professional/i });
        expect(proButton).toHaveAttribute('aria-pressed', 'true');

        const casualButton = screen.getByRole('button', { name: /Casual/i });
        expect(casualButton).toHaveAttribute('aria-pressed', 'false');

        // Select Casual
        fireEvent.click(casualButton);
        expect(casualButton).toHaveAttribute('aria-pressed', 'true');
        expect(proButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('text areas and inputs should have accessible labels', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByLabelText(/Campaign Topic/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Target Audience/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Posts\/Day/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    });

    it('should close on Escape key press', () => {
        render(<AIGenerateCampaignModal onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalled();
    });
});
