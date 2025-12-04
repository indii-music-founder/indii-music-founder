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
});
