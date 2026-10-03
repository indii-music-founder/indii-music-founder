import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferPanel } from '../TransferPanel';
import { credentialService } from '@/services/security/CredentialService';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
        updateProgress: vi.fn(),
    }),
}));

vi.mock('@/services/security/CredentialService', () => ({
    credentialService: {
        getCredentials: vi.fn(),
        saveCredentials: vi.fn(),
        listConfigured: vi.fn().mockResolvedValue(['distrokid', 'merlin']),
    },
}));

vi.mock('../ConnectDistributorModal', () => ({
    default: {
        call: vi.fn().mockResolvedValue(true),
    },
}));

describe('TransferPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the bridge transmission panel with distributor preset selector', () => {
        render(<TransferPanel />);

        expect(screen.getByText('Bridge Control')).toBeDefined();
        expect(screen.getByTestId('distro-target-preset-select')).toBeDefined();
        expect(screen.getByTestId('transfer-input-host')).toBeDefined();
        expect(screen.getByTestId('transfer-input-port')).toBeDefined();
    });

    it('autofills host and port when selecting a distributor preset', async () => {
        (credentialService.getCredentials as any).mockResolvedValueOnce({
            sftpHost: 'sftp.distrokid.com',
            sftpPort: 22,
            sftpUsername: 'artist_distro_user',
            sftpPassword: 'secret_password_123',
            sftpPath: '/incoming/123456789012',
        });

        render(<TransferPanel />);

        const select = screen.getByTestId('distro-target-preset-select');
        fireEvent.change(select, { target: { value: 'distrokid' } });

        await waitFor(() => {
            const hostInput = screen.getByTestId('transfer-input-host') as HTMLInputElement;
            expect(hostInput.value).toBe('sftp.distrokid.com');
            const userInput = screen.getByTestId('transfer-input-username') as HTMLInputElement;
            expect(userInput.value).toBe('artist_distro_user');
            const passInput = screen.getByTestId('transfer-input-password') as HTMLInputElement;
            expect(passInput.value).toBe('secret_password_123');
        });

        expect(screen.getByTestId('configure-selected-distro-btn')).toBeDefined();
    });
});
