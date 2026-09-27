import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import WalletSection from './WalletSection';
import { MembershipService } from '@/services/MembershipService';

const mockUser = {
    uid: 'user-wallet-test-123',
    email: 'artist@indii.music',
    displayName: 'Test Artist',
};

const mockTransactions = [
    {
        id: 'tx-1',
        userId: 'user-wallet-test-123',
        type: 'PURCHASE',
        amountCredits: 2500,
        balanceAfter: 2500,
        reason: 'Growth Pack Purchase ($20.00)',
        referenceId: 'pi_test_1',
        createdAt: 1727400000000,
    },
    {
        id: 'tx-2',
        userId: 'user-wallet-test-123',
        type: 'CONSUMPTION',
        amountCredits: -50,
        balanceAfter: 2450,
        reason: '4K Cover Artwork Generation',
        referenceId: 'gen_art_1',
        createdAt: 1727401000000,
    },
];

vi.mock('@/core/store', () => ({
    useStore: () => ({
        user: mockUser,
    }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

const mockShowToast = vi.fn();
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        getCreditBalance: vi.fn(),
        getCreditTransactions: vi.fn(),
        addCredits: vi.fn(),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('WalletSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(MembershipService.getCreditBalance).mockResolvedValue(2450);
        vi.mocked(MembershipService.getCreditTransactions).mockResolvedValue(mockTransactions as any);
    });

    it('renders the balance and feature unlocks', async () => {
        render(<WalletSection />);

        expect(screen.getByText('Credit Wallet & Micro-Transactions')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('wallet-balance-amount')).toHaveTextContent('2,450');
        });

        expect(screen.getByText('Cover Art & 4K Upscale')).toBeInTheDocument();
        expect(screen.getByText('Audio Mastering & Loudness')).toBeInTheDocument();
        expect(screen.getByText('Global DSP Distribution')).toBeInTheDocument();
    });

    it('renders all standard credit packs', async () => {
        render(<WalletSection />);

        await waitFor(() => {
            expect(screen.getByTestId('credit-pack-pack_starter_500')).toBeInTheDocument();
            expect(screen.getByTestId('credit-pack-pack_growth_2500')).toBeInTheDocument();
            expect(screen.getByTestId('credit-pack-pack_power_10000')).toBeInTheDocument();
        });

        expect(screen.getByText('Starter Pack')).toBeInTheDocument();
        expect(screen.getByText('Growth Pack')).toBeInTheDocument();
        expect(screen.getByText('Power Pack')).toBeInTheDocument();
    });

    it('purchases a credit pack and updates balance', async () => {
        vi.mocked(MembershipService.addCredits).mockResolvedValueOnce({
            success: true,
            balanceAfter: 2950,
            transactionId: 'tx-new',
        });

        render(<WalletSection />);

        await waitFor(() => {
            expect(screen.getByTestId('buy-pack-pack_starter_500')).toBeInTheDocument();
        });

        const buyButton = screen.getByTestId('buy-pack-pack_starter_500');
        fireEvent.click(buyButton);

        await waitFor(() => {
            expect(MembershipService.addCredits).toHaveBeenCalledWith(
                500,
                expect.stringContaining('Starter Pack Purchase'),
                'PURCHASE',
                expect.any(String),
                mockUser.uid
            );
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.stringContaining('Successfully added 500 credits'),
                'success'
            );
        });
    });

    it('renders transaction ledger rows', async () => {
        render(<WalletSection />);

        await waitFor(() => {
            expect(screen.getByTestId('tx-row-tx-1')).toBeInTheDocument();
            expect(screen.getByTestId('tx-row-tx-2')).toBeInTheDocument();
        });

        expect(screen.getByText('Growth Pack Purchase ($20.00)')).toBeInTheDocument();
        expect(screen.getByText('4K Cover Artwork Generation')).toBeInTheDocument();
        expect(screen.getByText('+2,500')).toBeInTheDocument();
        expect(screen.getByText('-50')).toBeInTheDocument();
    });

    it('renders empty notice when there are no transactions', async () => {
        vi.mocked(MembershipService.getCreditTransactions).mockResolvedValueOnce([]);

        render(<WalletSection />);

        await waitFor(() => {
            expect(screen.getByTestId('empty-transactions-notice')).toBeInTheDocument();
        });

        expect(screen.getByText('No transactions recorded yet')).toBeInTheDocument();
    });
});
