import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CredentialService } from './CredentialService';
import type { Credentials } from './CredentialService';

describe('CredentialService', () => {
    let service: CredentialService;

    const mockCredentials: Credentials = {
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        accessToken: 'test-access-token',
    };

    const mockElectronCredentials = {
        save: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new CredentialService();
    });

    // ==========================================================================
    // Electron API not available
    // ==========================================================================

    describe('without Electron API', () => {
        beforeEach(() => {
            // Ensure electronAPI is not defined
            Object.defineProperty(window, 'electronAPI', {
                value: undefined,
                writable: true,
                configurable: true,
            });
        });

        it('saveCredentials throws when Electron API is not available', async () => {
            await expect(service.saveCredentials('symphonic', mockCredentials))
                .rejects.toThrow('Electron API not available');
        });

        it('getCredentials throws when Electron API is not available', async () => {
            await expect(service.getCredentials('symphonic'))
                .rejects.toThrow('Electron API not available');
        });

        it('deleteCredentials throws when Electron API is not available', async () => {
            await expect(service.deleteCredentials('symphonic'))
                .rejects.toThrow('Electron API not available');
        });
    });

    // ==========================================================================
    // With Electron API
    // ==========================================================================

    describe('with Electron API', () => {
        beforeEach(() => {
            Object.defineProperty(window, 'electronAPI', {
                value: { credentials: mockElectronCredentials },
                writable: true,
                configurable: true,
            });
        });

        it('saveCredentials delegates to electronAPI', async () => {
            await service.saveCredentials('symphonic', mockCredentials);

            expect(mockElectronCredentials.save).toHaveBeenCalledWith('symphonic', mockCredentials);
            expect(mockElectronCredentials.save).toHaveBeenCalledTimes(1);
        });

        it('getCredentials returns credentials from electronAPI', async () => {
            mockElectronCredentials.get.mockResolvedValueOnce(mockCredentials);

            const result = await service.getCredentials('symphonic');

            expect(result).toEqual(mockCredentials);
            expect(mockElectronCredentials.get).toHaveBeenCalledWith('symphonic');
        });

        it('getCredentials returns null when no credentials stored', async () => {
            mockElectronCredentials.get.mockResolvedValueOnce(null);

            const result = await service.getCredentials('distrokid');
            expect(result).toBeNull();
        });

        it('deleteCredentials returns true on success', async () => {
            mockElectronCredentials.delete.mockResolvedValueOnce(true);

            const result = await service.deleteCredentials('symphonic');
            expect(result).toBe(true);
            expect(mockElectronCredentials.delete).toHaveBeenCalledWith('symphonic');
        });

        it('deleteCredentials returns false on failure', async () => {
            mockElectronCredentials.delete.mockResolvedValueOnce(false);

            const result = await service.deleteCredentials('symphonic');
            expect(result).toBe(false);
        });
    });
});
