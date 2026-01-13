import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import AIGenerateCampaignModal from './AIGenerateCampaignModal';
import { CampaignAI } from '@/services/marketing/CampaignAIService';

expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/services/marketing/CampaignAIService', () => ({
    CampaignAI: {
        generateCampaign: vi.fn(),
        planToCampaignAsset: vi.fn(),
    },
}));

describe('👁️ Pixel: AIGenerateCampaignModal Accessibility', () => {
    const defaultProps = {
        onClose: vi.fn(),
        onSave: vi.fn(),
    };

    it('Scenario 1: Modal should have correct dialog roles and labels', () => {
        render(<AIGenerateCampaignModal {...defaultProps} />);

        // The modal container should have role="dialog" and aria-modal="true"
        // Note: The current implementation is just a div, so this will fail initially.
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');

        // It should be labelled by the header
        const heading = screen.getByRole('heading', { name: /AI Campaign Generator/i });
        expect(dialog).toHaveAttribute('aria-labelledby');
        const labelId = dialog.getAttribute('aria-labelledby');
        expect(heading).toHaveAttribute('id', labelId);
    });

    it('Scenario 2: Inputs should have accessible descriptions', async () => {
         const { container } = render(<AIGenerateCampaignModal {...defaultProps} />);

         // Run axe to catch missing labels
         const results = await axe(container);
         expect(results).toHaveNoViolations();
    });

    it('Scenario 3: Loading state should be announced', async () => {
        const user = userEvent.setup();
        // Delay the resolution to capture loading state
        (CampaignAI.generateCampaign as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)));

        render(<AIGenerateCampaignModal {...defaultProps} />);

        // Fill required fields
        const topicInput = screen.getByRole('textbox', { name: /campaign topic/i }); // Expecting accessible name
        await user.type(topicInput, 'Test Topic');

        const generateBtn = screen.getByRole('button', { name: /Generate Campaign/i });
        await user.click(generateBtn);

        // Pixel Philosophy: "If it flickers, it fails". We want stable announcements.
        // The button text changes to "Generating...".
        // We assert that the button (which keeps focus) now announces the new state.

        const loadingBtn = screen.getByRole('button', { name: /Generating.../i });
        expect(loadingBtn).toBeInTheDocument();
        expect(loadingBtn).toBeDisabled();
    });
});
