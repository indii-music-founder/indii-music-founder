import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileUpload from './file-upload';

// Mock framer-motion to skip animations
vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    }
}));

describe('FileUpload', () => {
    it('renders upload button', () => {
        render(<FileUpload />);
        expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    it('renders take photo button on mobile (simulated)', () => {
        render(<FileUpload />);
        expect(screen.getByText('Take Photo')).toBeInTheDocument();
    });

    it('triggers file input with capture attribute when take photo is clicked', () => {
        render(<FileUpload />);

        const fileInput = screen.getByLabelText('File input');
        const setAttributeSpy = vi.spyOn(fileInput, 'setAttribute');
        const clickSpy = vi.spyOn(fileInput, 'click');

        const takePhotoBtn = screen.getByText('Take Photo').closest('button');
        fireEvent.click(takePhotoBtn!);

        expect(setAttributeSpy).toHaveBeenCalledWith('capture', 'environment');
        expect(clickSpy).toHaveBeenCalled();
    });

    it('displays error message with role="alert" when file is too large', async () => {
        render(<FileUpload maxFileSize={100} />); // 100 bytes limit

        const file = new File(['x'.repeat(200)], 'large-file.png', { type: 'image/png' });
        const fileInput = screen.getByLabelText('File input');

        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [file] } });
        });

        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/File size exceeds/);
    });

    it('displays progress bar with role="progressbar" during upload', async () => {
        // Use fake timers to control upload progress
        vi.useFakeTimers();
        render(<FileUpload uploadDelay={1000} />);

        const file = new File(['content'], 'test.png', { type: 'image/png' });
        const fileInput = screen.getByLabelText('File input');

        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [file] } });
        });

        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');

        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('cancel button has aria-label', async () => {
        vi.useFakeTimers();
        render(<FileUpload uploadDelay={1000} />);

        const file = new File(['content'], 'test.png', { type: 'image/png' });
        const fileInput = screen.getByLabelText('File input');

        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [file] } });
        });

        const cancelBtn = screen.getByRole('button', { name: /cancel upload/i });
        expect(cancelBtn).toBeInTheDocument();

        vi.useRealTimers();
    });
});
