import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxFormUploadPage } from './TaxFormUploadPage';

vi.mock('@/core/config/EndpointService', () => ({
    endpointService: { getFunctionUrl: vi.fn(() => 'https://us-central1-test.cloudfunctions.net/submitTaxForm') },
}));

const VALID_TOKEN = 'a'.repeat(64);

function setUrl(search: string) {
    window.history.replaceState({}, '', `/tax-form-upload${search}`);
}

describe('TaxFormUploadPage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        global.fetch = vi.fn();
    });

    it('shows an honest error when the token is missing', () => {
        setUrl('');
        render(<TaxFormUploadPage />);
        expect(screen.getByText('Invalid Link')).toBeInTheDocument();
    });

    it('shows an honest error when the token is malformed', () => {
        setUrl('?token=not-a-real-token');
        render(<TaxFormUploadPage />);
        expect(screen.getByText('Invalid Link')).toBeInTheDocument();
    });

    it('renders the upload form for a valid token', () => {
        setUrl(`?token=${VALID_TOKEN}`);
        render(<TaxFormUploadPage />);
        expect(screen.getByText('Submit Your Tax Form')).toBeInTheDocument();
        expect(screen.getByText('Submit Form')).toBeDisabled();
    });

    it('rejects an unsupported file type client-side without calling fetch', () => {
        setUrl(`?token=${VALID_TOKEN}`);
        render(<TaxFormUploadPage />);

        const file = new File(['x'], 'malware.exe', { type: 'application/x-msdownload' });
        const input = screen.getByLabelText('Tax form file') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });

        expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
        expect(screen.getByText('Submit Form')).toBeDisabled();
    });

    it('submits a valid file and shows success', async () => {
        setUrl(`?token=${VALID_TOKEN}`);
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, text: async () => '' });
        render(<TaxFormUploadPage />);

        const file = new File(['pdf-bytes'], 'w9.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText('Tax form file') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });

        fireEvent.click(screen.getByText('Submit Form'));

        await waitFor(() => expect(screen.getByText('Form Submitted')).toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledWith(
            'https://us-central1-test.cloudfunctions.net/submitTaxForm',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('shows the server error honestly on failure, not a fake success', async () => {
        setUrl(`?token=${VALID_TOKEN}`);
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 409, text: async () => 'This link has already been used.' });
        render(<TaxFormUploadPage />);

        const file = new File(['pdf-bytes'], 'w9.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText('Tax form file') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });
        fireEvent.click(screen.getByText('Submit Form'));

        await waitFor(() => expect(screen.getByText('This link has already been used.')).toBeInTheDocument());
        expect(screen.queryByText('Form Submitted')).not.toBeInTheDocument();
    });
});
