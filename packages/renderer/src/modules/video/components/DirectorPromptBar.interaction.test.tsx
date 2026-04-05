import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DirectorPromptBar } from './DirectorPromptBar';

describe('DirectorPromptBar Interaction', () => {
    it('Scenario: Typing & Debounce', async () => {
        vi.useFakeTimers();
        try {
            const handlePromptChange = vi.fn();
            const handleGenerate = vi.fn();

            render(
                <DirectorPromptBar
                    prompt=""
                    onPromptChange={handlePromptChange}
                    onGenerate={handleGenerate}
                    isGenerating={false}
                />
            );

            const input = screen.getByTestId('director-prompt-input');

            // 1. User types "Hello"
            fireEvent.change(input, { target: { value: 'Hello' } });

            // Local state updates immediately (input value changes)
            expect(input).toHaveValue('Hello');

            // Parent update is debounced, so not called yet
            expect(handlePromptChange).not.toHaveBeenCalled();

            // 2. Fast forward time (wait for debounce)
            // Verify it hasn't fired yet at 200ms
            act(() => {
                vi.advanceTimersByTime(200);
            });
            expect(handlePromptChange).not.toHaveBeenCalled();

            // Complete the debounce time
            act(() => {
                vi.advanceTimersByTime(100);
            });

            // 3. Assert parent update
            expect(handlePromptChange).toHaveBeenCalledWith('Hello');
        } finally {
            vi.useRealTimers();
        }
    });

    it('Scenario: Generate Lifecycle (Click -> Action -> Feedback)', () => {
        const handlePromptChange = vi.fn();
        const handleGenerate = vi.fn();

        const { rerender } = render(
            <DirectorPromptBar
                prompt=""
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                isGenerating={false}
            />
        );

        const input = screen.getByTestId('director-prompt-input');
        const generateBtn = screen.getByTestId('video-generate-btn');

        // 1. Initial State (Button Disabled because input is empty)
        expect(generateBtn).toBeDisabled();

        // 2. User types
        fireEvent.change(input, { target: { value: 'A cool video' } });
        expect(generateBtn).toBeEnabled();

        // 3. User clicks Generate
        fireEvent.click(generateBtn);

        // 4. Assert Action
        expect(handleGenerate).toHaveBeenCalledWith('A cool video');

        // 5. Simulate Loading State (Feedback)
        rerender(
            <DirectorPromptBar
                prompt="A cool video"
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                isGenerating={true}
            />
        );

        // Assert Loading State
        expect(generateBtn).toBeDisabled();
        expect(generateBtn).toHaveTextContent(/Action.../i);
        // Using regex for case-insensitive match on aria-label
        expect(screen.getByRole('button', { name: /generating video/i })).toBeInTheDocument();

        // 6. Simulate Completion (Ready State)
        rerender(
            <DirectorPromptBar
                prompt="A cool video"
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                isGenerating={false}
            />
        );

        // Assert Ready State
        expect(generateBtn).toBeEnabled();
        expect(generateBtn).toHaveTextContent(/Generate/i);
    });
});
