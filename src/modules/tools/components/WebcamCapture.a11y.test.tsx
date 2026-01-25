import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import WebcamCapture from './WebcamCapture';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as matchers from 'vitest-axe/matchers';
import { axe } from 'vitest-axe';

// Extend expect with vitest-axe matchers
expect.extend(matchers);

describe('WebcamCapture Accessibility', () => {
    const mockOnCapture = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        // Mock navigator.mediaDevices.getUserMedia
        Object.defineProperty(navigator, 'mediaDevices', {
            value: {
                getUserMedia: vi.fn().mockResolvedValue({
                    getTracks: () => [{ stop: vi.fn() }],
                }),
            },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('should have basic accessibility attributes', async () => {
        const { container } = render(
            <WebcamCapture onCapture={mockOnCapture} onClose={mockOnClose} />
        );

        // Check for violations (this might fail initially)
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should implement the dialog role correctly', () => {
        render(<WebcamCapture onCapture={mockOnCapture} onClose={mockOnClose} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby');

        // Check if the label points to the title
        const labelId = dialog.getAttribute('aria-labelledby');
        expect(labelId).toBeTruthy();
        const title = document.getElementById(labelId!);
        expect(title).toBeInTheDocument();
        expect(title).toHaveTextContent('Capture Reference');
    });

    it('close button should have an accessible name', () => {
        render(<WebcamCapture onCapture={mockOnCapture} onClose={mockOnClose} />);

        const closeButton = screen.getByRole('button', { name: /close camera/i });
        expect(closeButton).toBeInTheDocument();
    });
});
