import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/web3/WalletConnectService', () => ({
    walletConnectService: { disconnect: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/utils/logger', () => ({
    logger: { error: vi.fn() },
}));

import { WalletConnectPanel } from './WalletConnectPanel';

describe('WalletConnectPanel', () => {
    beforeEach(() => {
        localStorage.setItem('indii_wallet_address', `0x${'a'.repeat(40)}`);
        Object.defineProperty(window, 'ethereum', { configurable: true, value: undefined });
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('does not present a stale localStorage address as a connected wallet', async () => {
        render(<WalletConnectPanel />);

        await waitFor(() => expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument());
        expect(screen.queryByText('Wallet Connected')).not.toBeInTheDocument();
        expect(localStorage.getItem('indii_wallet_address')).toBeNull();
    });
});
