import { render, screen, fireEvent, act } from '@testing-library/react';
import { CodeBlock } from './CodeBlock';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import React from 'react';

expect.extend(matchers);

describe('CodeBlock', () => {
    // Mock clipboard
    const writeTextMock = vi.fn();

    beforeEach(() => {
        // Mock navigator.clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: writeTextMock,
            },
            writable: true,
            configurable: true,
        });
        writeTextMock.mockReset();
    });

    it('renders code content', () => {
        render(<CodeBlock>console.log('hello')</CodeBlock>);
        expect(screen.getByText("console.log('hello')")).toBeInTheDocument();
    });

    it('Scenario: Copy Button Lifecycle (Click -> Success -> Reset)', async () => {
        vi.useFakeTimers();

        try {
            writeTextMock.mockResolvedValue(undefined);
            render(<CodeBlock>const x = 1;</CodeBlock>);

            const copyBtn = screen.getByTestId('copy-code-btn');

            // 1. Initial State
            expect(copyBtn).toHaveTextContent('Copy');
            expect(copyBtn).toHaveAttribute('title', 'Copy code');
            expect(screen.queryByText('Copied!')).not.toBeInTheDocument();

            // 2. Click Interaction
            await act(async () => {
                fireEvent.click(copyBtn);
            });

            // 3. Verify Action (Clipboard)
            expect(writeTextMock).toHaveBeenCalledWith('const x = 1;');

            // 4. Verify Feedback State
            expect(copyBtn).toHaveTextContent('Copied!');
            expect(copyBtn).toHaveAttribute('title', 'Copied!');
            expect(copyBtn).toHaveClass('text-green-400');
            expect(copyBtn).toHaveClass('bg-green-500/20');

            // 5. Verify Reset after timeout
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            // 6. Verify Final Ready State
            expect(copyBtn).toHaveTextContent('Copy');
            expect(copyBtn).toHaveAttribute('title', 'Copy code');
            expect(copyBtn).not.toHaveClass('text-green-400');
        } finally {
            vi.useRealTimers();
        }
    });

    it('is accessible', async () => {
        const { container } = render(<CodeBlock>code</CodeBlock>);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
