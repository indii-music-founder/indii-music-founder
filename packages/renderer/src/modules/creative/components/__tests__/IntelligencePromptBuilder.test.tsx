import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntelligencePromptBuilder from '../IntelligencePromptBuilder';
import { STUDIO_TAGS } from '@/modules/creative/constants';
import { IntelligencePromptService } from '@/services/creative/IntelligencePromptService';
import { PromptAdditiveTracker } from '@/services/creative/PromptAdditiveTracker';

vi.mock('@/services/creative/PromptAdditiveTracker', () => ({
    PromptAdditiveTracker: {
        recordUsage: vi.fn(),
        getFrequentAdditives: vi.fn(() => []),
    },
}));

vi.mock('@/services/creative/IntelligencePromptService', () => ({
    IntelligencePromptService: {
        improve: vi.fn(),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('IntelligencePromptBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders Brand pill and all studio category pills', () => {
        const handleAddTag = vi.fn();
        render(<IntelligencePromptBuilder onAddTag={handleAddTag} currentPrompt="A neon cyber city" onSetPrompt={vi.fn()} />);

        expect(screen.getByTestId('category-Brand-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Camera-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Cinematography-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Subject & Pose-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Vibe & Energy-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Cultural Motif-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Digital FX-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('category-Finish-trigger')).toBeInTheDocument();
    });

    it('renders the Improve with Intelligence pill with full alignment and handles click', async () => {
        const handleSetPrompt = vi.fn();
        vi.mocked(IntelligencePromptService.improve).mockResolvedValueOnce({
            improved: 'A breathtaking neon cyber city with volumetric god rays and cinematic color grade',
            reasoning: 'Enhanced atmosphere and lighting',
        });

        render(<IntelligencePromptBuilder onAddTag={vi.fn()} currentPrompt="A neon cyber city" onSetPrompt={handleSetPrompt} />);

        const improveBtn = screen.getByRole('button', { name: /improve with intelligence/i });
        expect(improveBtn).toBeInTheDocument();
        expect(improveBtn).not.toBeDisabled();

        fireEvent.click(improveBtn);

        await waitFor(() => {
            expect(IntelligencePromptService.improve).toHaveBeenCalledWith({
                rawPrompt: 'A neon cyber city',
                mode: 'image',
            });
            expect(handleSetPrompt).toHaveBeenCalledWith('A breathtaking neon cyber city with volumetric god rays and cinematic color grade');
        });
    });

    it('disables Improve with Intelligence button when current prompt is empty', () => {
        render(<IntelligencePromptBuilder onAddTag={vi.fn()} currentPrompt="" onSetPrompt={vi.fn()} />);
        const improveBtn = screen.getByRole('button', { name: /improve with intelligence/i });
        expect(improveBtn).toBeDisabled();
    });

    it('records tag selection to PromptAdditiveTracker when a tag is clicked', () => {
        const handleAddTag = vi.fn();
        render(<IntelligencePromptBuilder onAddTag={handleAddTag} currentPrompt="test" onSetPrompt={vi.fn()} />);

        // Open Camera category
        const cameraTrigger = screen.getByTestId('category-Camera-trigger');
        fireEvent.click(cameraTrigger);

        // Find a camera tag
        const tagBtn = screen.getByText('Leica M6');
        fireEvent.click(tagBtn);

        expect(handleAddTag).toHaveBeenCalledWith('Leica M6');
        expect(PromptAdditiveTracker.recordUsage).toHaveBeenCalledWith('Leica M6', 'Camera');
    });
});
