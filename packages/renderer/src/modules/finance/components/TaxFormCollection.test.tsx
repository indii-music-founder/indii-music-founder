import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxFormCollection } from './TaxFormCollection';
import { TaxFormService, type TaxCollaborator } from '@/services/finance/TaxFormService';

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
        tr: ({ children, ...props }: React.ComponentProps<'tr'>) => <tr {...props}>{children}</tr>,
    },
}));

const mockAddDialogCall = vi.fn();
vi.mock('@/components/ui/AddTaxCollaboratorDialog', () => ({
    AddTaxCollaboratorDialog: { call: (...args: unknown[]) => mockAddDialogCall(...args) },
}));

const mockConfirmDialogCall = vi.fn();
vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: { call: (...args: unknown[]) => mockConfirmDialogCall(...args) },
}));

vi.mock('@/services/finance/TaxFormService', () => ({
    TaxFormService: {
        subscribeCollaborators: vi.fn(),
        addCollaborator: vi.fn(),
        uploadForm: vi.fn(),
        requestForm: vi.fn(),
        markReviewed: vi.fn(),
        deleteUploadedFile: vi.fn(),
        removeCollaborator: vi.fn(),
        getDownloadUrl: vi.fn(),
    },
}));

function makeCollaborator(overrides: Partial<TaxCollaborator> = {}): TaxCollaborator {
    return {
        id: 'collab-1',
        name: 'Jane Collaborator',
        email: 'jane@x.com',
        country: 'US',
        formType: 'W-9',
        status: 'needed',
        ...overrides,
    };
}

describe('TaxFormCollection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([]);
            return () => {};
        });
    });

    it('shows the honest empty state when there are no collaborators', () => {
        render(<TaxFormCollection />);
        expect(screen.getByText('No Collaborators Added')).toBeInTheDocument();
        expect(screen.queryByText(/requires the backend/i)).not.toBeInTheDocument();
    });

    it('opens the add-collaborator dialog and calls the service on submit', async () => {
        mockAddDialogCall.mockResolvedValueOnce({ name: 'New Person', email: 'n@x.com', country: 'US' });
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByText('Add Collaborator'));

        await waitFor(() => {
            expect(TaxFormService.addCollaborator).toHaveBeenCalledWith({ name: 'New Person', email: 'n@x.com', country: 'US' });
        });
    });

    it('does not call addCollaborator when the dialog is cancelled', async () => {
        mockAddDialogCall.mockResolvedValueOnce(null);
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByText('Add Collaborator'));

        await waitFor(() => expect(mockAddDialogCall).toHaveBeenCalled());
        expect(TaxFormService.addCollaborator).not.toHaveBeenCalled();
    });

    it('renders a collaborator row with Payout locked when status is needed', () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator()]);
            return () => {};
        });
        render(<TaxFormCollection />);

        expect(screen.getByText('Jane Collaborator')).toBeInTheDocument();
        expect(screen.getByText('Payout locked')).toBeInTheDocument();
        expect(screen.getByText('Needed')).toBeInTheDocument();
    });

    it('calls requestForm when Request is clicked', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator()]);
            return () => {};
        });
        (TaxFormService.requestForm as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByText('Request'));

        await waitFor(() => expect(TaxFormService.requestForm).toHaveBeenCalledWith('collab-1'));
    });

    it('surfaces an honest error when requestForm fails', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator()]);
            return () => {};
        });
        (TaxFormService.requestForm as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Resend API down'));
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByText('Request'));

        await waitFor(() => expect(screen.getByText('Resend API down')).toBeInTheDocument());
    });

    it('uploads a file via the hidden input and calls uploadForm', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator()]);
            return () => {};
        });
        (TaxFormService.uploadForm as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        render(<TaxFormCollection />);

        const file = new File(['dummy'], 'w9.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText('Upload tax form for Jane Collaborator') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => expect(TaxFormService.uploadForm).toHaveBeenCalledWith('collab-1', file));
    });

    it('shows Mark Reviewed and Download for on_file collaborators, not Upload/Request', () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator({ status: 'on_file', storagePath: 'tax_docs/uid/collab-1/1-w9.pdf', fileName: 'w9.pdf' })]);
            return () => {};
        });
        render(<TaxFormCollection />);

        expect(screen.getByText('Mark Reviewed')).toBeInTheDocument();
        expect(screen.getByText('w9.pdf')).toBeInTheDocument();
        expect(screen.queryByText('Request')).not.toBeInTheDocument();
    });

    it('marks reviewed on click', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator({ status: 'on_file', storagePath: 'tax_docs/uid/collab-1/1-w9.pdf', fileName: 'w9.pdf' })]);
            return () => {};
        });
        (TaxFormService.markReviewed as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByText('Mark Reviewed'));

        await waitFor(() => expect(TaxFormService.markReviewed).toHaveBeenCalledWith('collab-1'));
    });

    it('confirms before deleting an uploaded file, and skips the call when cancelled', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator({ status: 'on_file', storagePath: 'tax_docs/uid/collab-1/1-w9.pdf', fileName: 'w9.pdf' })]);
            return () => {};
        });
        mockConfirmDialogCall.mockResolvedValueOnce(false);
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByLabelText('Delete uploaded form for Jane Collaborator'));

        await waitFor(() => expect(mockConfirmDialogCall).toHaveBeenCalled());
        expect(TaxFormService.deleteUploadedFile).not.toHaveBeenCalled();
    });

    it('deletes the uploaded file after confirmation', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator({ status: 'on_file', storagePath: 'tax_docs/uid/collab-1/1-w9.pdf', fileName: 'w9.pdf' })]);
            return () => {};
        });
        mockConfirmDialogCall.mockResolvedValueOnce(true);
        (TaxFormService.deleteUploadedFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByLabelText('Delete uploaded form for Jane Collaborator'));

        await waitFor(() => expect(TaxFormService.deleteUploadedFile).toHaveBeenCalledWith('collab-1'));
    });

    it('removes a collaborator after confirmation', async () => {
        (TaxFormService.subscribeCollaborators as ReturnType<typeof vi.fn>).mockImplementation((cb: (data: TaxCollaborator[]) => void) => {
            cb([makeCollaborator()]);
            return () => {};
        });
        mockConfirmDialogCall.mockResolvedValueOnce(true);
        (TaxFormService.removeCollaborator as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
        render(<TaxFormCollection />);

        fireEvent.click(screen.getByLabelText('Remove collaborator Jane Collaborator'));

        await waitFor(() => expect(TaxFormService.removeCollaborator).toHaveBeenCalledWith('collab-1'));
    });
});
