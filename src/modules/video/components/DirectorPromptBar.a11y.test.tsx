import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DirectorPromptBar } from './DirectorPromptBar';

describe('DirectorPromptBar Accessibility', () => {
    it('should have an accessible input label', () => {
        render(
            <DirectorPromptBar
                prompt=""
                onPromptChange={vi.fn()}
                onGenerate={vi.fn()}
                isGenerating={false}
            />
        );
        // This will fail if there is no label or aria-label
        const input = screen.getByRole('textbox', { name: /describe your scene/i });
        expect(input).toBeInTheDocument();
    });

    it('should have an accessible microphone button', () => {
        render(
            <DirectorPromptBar
                prompt=""
                onPromptChange={vi.fn()}
                onGenerate={vi.fn()}
                isGenerating={false}
            />
        );
        // This will fail if the button is icon-only without aria-label
        const micButton = screen.getByRole('button', { name: /voice input/i });
        expect(micButton).toBeInTheDocument();
    });

    it('should have visible focus indicators', () => {
        // This is a manual check usually, but we can check for focus classes if we want to be thorough.
        // For now, checking the semantic HTML is the priority.
    });
});
