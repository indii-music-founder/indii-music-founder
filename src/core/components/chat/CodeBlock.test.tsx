import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        });
        writeTextMock.mockReset();
    });

    it('renders code content', () => {
        render(<CodeBlock>console.log('hello')</CodeBlock>);
        expect(screen.getByText("console.log('hello')")).toBeInTheDocument();
    });

    it('copies text when button is clicked', async () => {
        writeTextMock.mockResolvedValue(undefined);
        render(<CodeBlock>const x = 1;</CodeBlock>);

        // Button is initially hidden (opacity 0) but accessible in DOM
        // The accessible name is "Copy code to clipboard"
        const button = screen.getByRole('button', { name: /copy code to clipboard/i });
        fireEvent.click(button);

        expect(writeTextMock).toHaveBeenCalledWith('const x = 1;');

        // Check for success state
        expect(await screen.findByText('Copied!')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copied to clipboard/i })).toBeInTheDocument();
    });

    it('is accessible', async () => {
        const { container } = render(<CodeBlock>code</CodeBlock>);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
