import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AIGenerateCampaignModal from './AIGenerateCampaignModal';
import { CampaignAI } from '@/services/marketing/CampaignAIService';
import { GeneratedCampaignPlan } from '../types';
import userEvent from '@testing-library/user-event';

// --- Mocks ---

// Hoist mock functions to share between mock factory and tests
const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
};

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => mockToast,
}));

vi.mock('@/services/marketing/CampaignAIService', () => ({
    CampaignAI: {
        generateCampaign: vi.fn(),
        planToCampaignAsset: vi.fn(),
    },
}));

const mockGeneratedPlan: GeneratedCampaignPlan = {
    title: 'Test Campaign',
    description: 'A test campaign for pixel testing',
    posts: [
        {
            platform: 'Twitter',
            day: 1,
            copy: 'Hello world!',
            imagePrompt: 'A beautiful world',
            hashtags: ['#hello', '#world'],
            bestTimeToPost: '10:00 AM',
        },
    ],
};

describe('AIGenerateCampaignModal', () => {
    const defaultProps = {
        onClose: vi.fn(),
        onSave: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the initial form state correctly', () => {
        render(<AIGenerateCampaignModal {...defaultProps} />);

        expect(screen.getByText('AI Campaign Generator')).toBeInTheDocument();
        expect(screen.getByText(/Campaign Topic \*/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Campaign/i })).toBeInTheDocument();
    });

    it('validates required fields before generation', async () => {
        const user = userEvent.setup();
        render(<AIGenerateCampaignModal {...defaultProps} />);

        const generateBtn = screen.getByRole('button', { name: /Generate Campaign/i });
        expect(generateBtn).toBeDisabled();

        const topicInput = screen.getByPlaceholderText(/e.g., New album/i);
        await user.type(topicInput, 'Test Topic');

        expect(generateBtn).toBeEnabled();

        const twitterBtn = screen.getByText('X / Twitter');
        const instagramBtn = screen.getByText('Instagram');

        await user.click(twitterBtn);
        await user.click(instagramBtn);

        expect(generateBtn).toBeDisabled();
    });

    it('shows loading state and handles successful generation', async () => {
        const user = userEvent.setup();

        // Use a delayed promise to catch the loading state
        (CampaignAI.generateCampaign as any).mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return mockGeneratedPlan;
        });

        render(<AIGenerateCampaignModal {...defaultProps} />);

        await user.type(screen.getByPlaceholderText(/e.g., New album/i), 'My Album Launch');

        const generateBtn = screen.getByRole('button', { name: /Generate Campaign/i });
        await user.click(generateBtn);

        // Verify loading state immediately after click
        expect(screen.getByText(/Generating.../i)).toBeInTheDocument();
        expect(generateBtn).toBeDisabled();

        // Wait for completion
        await waitFor(() => {
            expect(screen.getByText(mockGeneratedPlan.title)).toBeInTheDocument();
        });

        expect(screen.getByText(mockGeneratedPlan.description)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
    });

    it('handles generation errors gracefully', async () => {
        const user = userEvent.setup();
        (CampaignAI.generateCampaign as any).mockRejectedValue(new Error('AI overloaded'));

        render(<AIGenerateCampaignModal {...defaultProps} />);

        await user.type(screen.getByPlaceholderText(/e.g., New album/i), 'Fail Topic');
        await user.click(screen.getByRole('button', { name: /Generate Campaign/i }));

        await waitFor(() => {
             expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to generate'));
        });

        expect(screen.getByRole('button', { name: /Generate Campaign/i })).toBeEnabled();
        expect(screen.queryByText(/Generating.../i)).not.toBeInTheDocument();
    });

    it('allows regenerating the campaign', async () => {
        const user = userEvent.setup();
        (CampaignAI.generateCampaign as any).mockResolvedValue(mockGeneratedPlan);

        render(<AIGenerateCampaignModal {...defaultProps} />);

        await user.type(screen.getByPlaceholderText(/e.g., New album/i), 'Regen Topic');
        await user.click(screen.getByRole('button', { name: /Generate Campaign/i }));

        await waitFor(() => {
            expect(screen.getByText(mockGeneratedPlan.title)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Regenerate/i }));

        expect(screen.getByText(/Campaign Topic \*/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Campaign/i })).toBeInTheDocument();
    });

    it('calls onSave when Create Campaign is clicked', async () => {
        const user = userEvent.setup();
        (CampaignAI.generateCampaign as any).mockResolvedValue(mockGeneratedPlan);
        const mockCampaignAsset = { id: 'new-camp', title: 'Asset' };
        (CampaignAI.planToCampaignAsset as any).mockReturnValue(mockCampaignAsset);

        render(<AIGenerateCampaignModal {...defaultProps} />);

        await user.type(screen.getByPlaceholderText(/e.g., New album/i), 'Save Topic');
        await user.click(screen.getByRole('button', { name: /Generate Campaign/i }));

        await waitFor(() => {
            expect(screen.getByText(mockGeneratedPlan.title)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /Create Campaign/i }));

        expect(CampaignAI.planToCampaignAsset).toHaveBeenCalledWith(mockGeneratedPlan, expect.any(String));
        expect(defaultProps.onSave).toHaveBeenCalledWith(mockCampaignAsset);
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('supports keyboard navigation for platform selection', async () => {
        const user = userEvent.setup();
        render(<AIGenerateCampaignModal {...defaultProps} />);

        const twitterBtn = screen.getByText('X / Twitter').closest('button');

        expect(twitterBtn).toHaveAttribute('class', expect.stringContaining('bg-pink-900/30'));

        // Simulate Keyboard Enter
        twitterBtn?.focus();
        await user.keyboard('{Enter}');

        expect(twitterBtn).not.toHaveAttribute('class', expect.stringContaining('bg-pink-900/30'));
    });
});
