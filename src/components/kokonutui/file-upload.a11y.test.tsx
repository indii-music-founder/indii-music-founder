import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import FileUpload from './file-upload';

expect.extend(toHaveNoViolations);

// Mock motion to avoid animation complexity and jsdom issues
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Access: FileUpload Accessibility', () => {
    it('passes automated axe-core checks', async () => {
        const { container } = render(<FileUpload />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('has accessible buttons with visible focus states', () => {
        render(<FileUpload />);

        const uploadBtn = screen.getByRole('button', { name: /upload file/i });
        expect(uploadBtn).toBeInTheDocument();

        // Check for focus-visible utility classes
        // The regex checks for focus-visible:ring or similar patterns
        expect(uploadBtn.className).toMatch(/focus-visible:ring/);
    });

    it('announces errors via aria-live region', async () => {
        const handleUploadError = vi.fn();

        // Create a file larger than max size (default is 50MB, we set to 1KB)
        const file = new File(['x'.repeat(2048)], 'huge.png', { type: 'image/png' });

        render(<FileUpload maxFileSize={1024} onUploadError={handleUploadError} />);

        const input = screen.getByLabelText(/file input/i);
        fireEvent.change(input, { target: { files: [file] } });

        // Error should appear
        const errorMsg = await screen.findByRole('alert');
        expect(errorMsg).toHaveTextContent(/exceeds/i);

        // Ensure it has assertive or polite live region
        expect(errorMsg).toHaveAttribute('aria-live', 'assertive');
    });

    it('keyboard navigation triggers file input', () => {
        render(<FileUpload />);

        const uploadBtn = screen.getByRole('button', { name: /upload file/i });
        const input = screen.getByLabelText(/file input/i);

        // Spy on click
        const clickSpy = vi.spyOn(input, 'click');

        uploadBtn.focus();
        fireEvent.click(uploadBtn);

        expect(clickSpy).toHaveBeenCalled();
    });
});
