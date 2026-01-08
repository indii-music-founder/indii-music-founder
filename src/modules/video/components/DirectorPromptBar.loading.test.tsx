import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DirectorPromptBar } from './DirectorPromptBar';

describe('DirectorPromptBar Loading State', () => {
    it('shows loading indicators and disables interaction when generating', () => {
        const handleGenerate = vi.fn();
        const handlePromptChange = vi.fn();

        render(
            <DirectorPromptBar
                prompt="A cyberpunk city"
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                isGenerating={true}
            />
        );

        const button = screen.getByRole('button', { name: /generating video/i });

        // Assert button is disabled
        expect(button).toBeDisabled();

        // Assert loading text
        expect(screen.getByText(/action.../i)).toBeInTheDocument();

        // Assert spinner presence (checking for the class used in the component)
        // The component uses <Sparkles className="animate-spin" ... />
        // We can find it by looking for the hidden element with aria-hidden="true" inside the button
        // or by querying the class directly if we want to be specific about the visual indicator.
        // However, testing-library prefers semantic queries.
        // Since the icon is aria-hidden, we can't get it by role.
        // We can inspect the button's children.
        const spinner = button.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();

        // Verify click does not fire onGenerate
        fireEvent.click(button);
        expect(handleGenerate).not.toHaveBeenCalled();
    });

    it('shows idle state and enables interaction when not generating', () => {
        const handleGenerate = vi.fn();
        const handlePromptChange = vi.fn();

        render(
            <DirectorPromptBar
                prompt="A cyberpunk city"
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                isGenerating={false}
            />
        );

        const button = screen.getByRole('button', { name: /generate video/i });

        // Assert button is enabled
        expect(button).toBeEnabled();

        // Assert idle text
        expect(screen.getByText(/generate/i)).toBeInTheDocument();
        expect(screen.queryByText(/action.../i)).not.toBeInTheDocument();

        // Verify click fires onGenerate
        fireEvent.click(button);
        expect(handleGenerate).toHaveBeenCalledTimes(1);
    });

    it('disables generate button when prompt is empty even if not generating', () => {
        const handleGenerate = vi.fn();

        render(
            <DirectorPromptBar
                prompt=""
                onPromptChange={vi.fn()}
                onGenerate={handleGenerate}
                isGenerating={false}
            />
        );

        const button = screen.getByRole('button', { name: /generate video/i });
        expect(button).toBeDisabled();
    });
});
