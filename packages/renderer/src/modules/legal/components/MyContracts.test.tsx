import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyContracts } from './MyContracts';
import { LegalService } from '@/services/legal/LegalService';
import { ContractStatus } from '@/modules/legal/types';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('@/services/legal/LegalService', () => ({
    LegalService: {
        getContracts: vi.fn(),
        updateContract: vi.fn(),
    },
}));

vi.mock('@/services/legal/ContractPDFService', () => ({
    ContractPDFService: {
        download: vi.fn(),
        preview: vi.fn(),
        toBase64: vi.fn().mockReturnValue('mock-base64'),
    },
}));

vi.mock('@/services/email/ResendEmailService', () => ({
    ResendEmailService: {
        sendContract: vi.fn().mockResolvedValue({ success: true }),
    },
}));

describe('MyContracts component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('displays loading state while fetching contracts', async () => {
        vi.mocked(LegalService.getContracts).mockImplementation(() => new Promise(() => {}));
        render(<MyContracts />);
        expect(screen.getByText('Loading contracts…')).toBeInTheDocument();
    });

    it('renders ContractLoadError when loading fails, distinguishing error from empty state', async () => {
        vi.mocked(LegalService.getContracts).mockRejectedValue(new Error('FirebaseError: Missing or insufficient permissions'));
        render(<MyContracts />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        expect(screen.getByText('Unable to Load Contracts')).toBeInTheDocument();
        expect(screen.queryByText('No Contracts Yet')).toBeNull();

        // Clicking retry invokes getContracts again
        vi.mocked(LegalService.getContracts).mockResolvedValueOnce([]);
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(screen.getByText('No Contracts Yet')).toBeInTheDocument();
        });
    });

    it('renders empty state when contract list is empty and triggers onNewContract', async () => {
        vi.mocked(LegalService.getContracts).mockResolvedValue([]);
        const onNewContract = vi.fn();
        render(<MyContracts onNewContract={onNewContract} />);

        await waitFor(() => {
            expect(screen.getByText('No Contracts Yet')).toBeInTheDocument();
        });

        const draftBtn = screen.getByRole('button', { name: /Draft a Contract/i });
        fireEvent.click(draftBtn);
        expect(onNewContract).toHaveBeenCalledTimes(1);
    });

    it('renders populated contract list and status badges', async () => {
        vi.mocked(LegalService.getContracts).mockResolvedValue([
            {
                id: 'contract-1',
                userId: 'user-123',
                title: '50/50 Split Sheet: Paper Moon',
                content: '# Split Sheet\n50/50 split between Artist A and Artist B',
                status: ContractStatus.DRAFT,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                parties: ['Artist A', 'Artist B'],
                type: 'Split Sheet',
            },
        ]);

        render(<MyContracts />);

        await waitFor(() => {
            expect(screen.getByText('50/50 Split Sheet: Paper Moon')).toBeInTheDocument();
        });
        expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('re-fetches contracts when refreshTrigger changes', async () => {
        vi.mocked(LegalService.getContracts).mockResolvedValue([]);
        const { rerender } = render(<MyContracts refreshTrigger={0} />);

        await waitFor(() => {
            expect(LegalService.getContracts).toHaveBeenCalledTimes(1);
        });

        rerender(<MyContracts refreshTrigger={1} />);

        await waitFor(() => {
            expect(LegalService.getContracts).toHaveBeenCalledTimes(2);
        });
    });
});
