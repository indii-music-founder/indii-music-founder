import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileUpload from './file-upload';

describe('FileUpload', () => {
    it('renders upload button', () => {
        render(<FileUpload />);
        expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    it('renders take photo button on mobile (simulated)', () => {
        render(<FileUpload />);
        // The button is hidden on desktop (md:hidden), but present in the DOM
        // We can check if it exists in the document
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

    it('displays error message with alert role', () => {
        const validateFile = vi.fn().mockReturnValue({ message: 'Invalid file', code: 'INVALID' });
        render(<FileUpload validateFile={validateFile} />);

        const fileInput = screen.getByLabelText('File input');
        const file = new File(['test'], 'test.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Invalid file');
    });

    it('displays progress bar with correct ARIA attributes', async () => {
        render(<FileUpload uploadDelay={500} />); // Slow down upload to capture state

        const fileInput = screen.getByLabelText('File input');
        const file = new File(['test'], 'test.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        const progressBar = await screen.findByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        // Initial value might be 0
        expect(progressBar).toHaveAttribute('aria-valuenow');
    });

    it('cancel button has accessible name', async () => {
        render(<FileUpload uploadDelay={500} />);

        const fileInput = screen.getByLabelText('File input');
        const file = new File(['test'], 'test.png', { type: 'image/png' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        const cancelButton = await screen.findByRole('button', { name: /cancel upload/i });
        expect(cancelButton).toBeInTheDocument();
    });
});
