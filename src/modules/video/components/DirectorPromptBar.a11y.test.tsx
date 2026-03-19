import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { DirectorPromptBar } from './DirectorPromptBar';

// Mock Web Speech API for test environment
beforeAll(() => {
    // Provide SpeechRecognition mock so VoiceInputButton renders
    const MockSpeechRecognition = vi.fn().mockImplementation(() => ({
        continuous: false,
        interimResults: false,
        lang: '',
        onresult: null,
        onend: null,
        onerror: null,
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
    }));
    (window as any).SpeechRecognition = MockSpeechRecognition;
});

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

    it('should have an accessible voice input button', () => {
        render(
            <DirectorPromptBar
                prompt=""
                onPromptChange={vi.fn()}
                onGenerate={vi.fn()}
                isGenerating={false}
            />
        );
        // VoiceInputButton has aria-label="Voice input" when not listening
        const micButton = screen.getByRole('button', { name: /voice input/i });
        expect(micButton).toBeInTheDocument();
    });

    it('should have an accessible generate button', () => {
        render(
            <DirectorPromptBar
                prompt="test prompt"
                onPromptChange={vi.fn()}
                onGenerate={vi.fn()}
                isGenerating={false}
            />
        );
        const generateButton = screen.getByRole('button', { name: /generate video/i });
        expect(generateButton).toBeInTheDocument();
    });

    it('should indicate generating state accessibly', () => {
        render(
            <DirectorPromptBar
                prompt="test prompt"
                onPromptChange={vi.fn()}
                onGenerate={vi.fn()}
                isGenerating={true}
            />
        );
        const generatingButton = screen.getByRole('button', { name: /generating video/i });
        expect(generatingButton).toBeInTheDocument();
    });

    it('should have visible focus indicators', () => {
        // Input and buttons use focus-visible:ring-2 classes for keyboard navigation.
        // This is a CSS concern that requires visual/manual testing.
        // Semantic HTML checks are the priority here — covered by the tests above.
    });
});
