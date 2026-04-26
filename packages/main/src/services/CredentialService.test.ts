import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeStorage } from 'electron';
import keytar from 'keytar';

// Mock electron's safeStorage
vi.mock('electron', () => ({
    safeStorage: {
        isEncryptionAvailable: vi.fn(),
        encryptString: vi.fn(),
        decryptString: vi.fn(),
    }
}));

// Mock keytar
vi.mock('keytar', () => ({
    default: {
        setPassword: vi.fn(),
        getPassword: vi.fn(),
        deletePassword: vi.fn(),
    }
}));

import { CredentialService } from './CredentialService';

describe('CredentialService', () => {
    let service: CredentialService;

    beforeEach(() => {
        service = new CredentialService();
        vi.clearAllMocks();
    });

    describe('saveCredentials', () => {
        it('should save encrypted credentials when encryption is available', async () => {
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
            const mockBuffer = Buffer.from('encrypted-data');
            vi.mocked(safeStorage.encryptString).mockReturnValue(mockBuffer);
            vi.mocked(keytar.setPassword).mockResolvedValue(undefined);

            const creds = { apiKey: 'test-key' };
            await service.saveCredentials('dist1', creds);

            expect(safeStorage.isEncryptionAvailable).toHaveBeenCalled();
            expect(safeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify(creds));
            expect(keytar.setPassword).toHaveBeenCalledWith(
                'IndiiOS_Distribution',
                'dist1',
                mockBuffer.toString('base64')
            );
        });

        it('should throw an error when encryption is not available', async () => {
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

            await expect(service.saveCredentials('dist1', { apiKey: 'test' }))
                .rejects.toThrow('Encryption is not available. Credentials cannot be stored securely.');

            expect(safeStorage.encryptString).not.toHaveBeenCalled();
            expect(keytar.setPassword).not.toHaveBeenCalled();
        });

        it('should propagate errors from keytar', async () => {
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
            vi.mocked(safeStorage.encryptString).mockReturnValue(Buffer.from('encrypted'));
            const error = new Error('keytar error');
            vi.mocked(keytar.setPassword).mockRejectedValue(error);

            await expect(service.saveCredentials('dist1', { apiKey: 'test' }))
                .rejects.toThrow('keytar error');
        });
    });

    describe('getCredentials', () => {
        it('should return null if no credentials found', async () => {
            vi.mocked(keytar.getPassword).mockResolvedValue(null);

            const result = await service.getCredentials('dist1');
            expect(result).toBeNull();
        });

        it('should return decrypted credentials', async () => {
            const encryptedBase64 = Buffer.from('encrypted-data').toString('base64');
            vi.mocked(keytar.getPassword).mockResolvedValue(encryptedBase64);
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);

            const creds = { apiKey: 'test' };
            vi.mocked(safeStorage.decryptString).mockReturnValue(JSON.stringify(creds));

            const result = await service.getCredentials('dist1');

            expect(safeStorage.isEncryptionAvailable).toHaveBeenCalled();
            expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from(encryptedBase64, 'base64'));
            expect(result).toEqual(creds);
        });

        it('should return legacy plaintext credentials', async () => {
            const creds = { apiKey: 'legacy-key' };
            vi.mocked(keytar.getPassword).mockResolvedValue(JSON.stringify(creds));

            const result = await service.getCredentials('dist1');

            expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled();
            expect(result).toEqual(creds);
        });

        it('should throw error inside try if safeStorage is not available for encrypted data, and return null', async () => {
            const encryptedBase64 = Buffer.from('encrypted-data').toString('base64');
            vi.mocked(keytar.getPassword).mockResolvedValue(encryptedBase64);
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

            const result = await service.getCredentials('dist1');
            expect(result).toBeNull();
        });

        it('should return null if decryption throws and payload is not legacy JSON', async () => {
            vi.mocked(keytar.getPassword).mockResolvedValue('not-a-json-or-base64-that-decrypts');
            vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
            vi.mocked(safeStorage.decryptString).mockImplementation(() => { throw new Error('decrypt error'); });

            const result = await service.getCredentials('dist1');
            expect(result).toBeNull();
        });

        it('should catch keytar errors and return null', async () => {
            vi.mocked(keytar.getPassword).mockRejectedValue(new Error('keytar error'));

            const result = await service.getCredentials('dist1');
            expect(result).toBeNull();
        });
    });

    describe('deleteCredentials', () => {
        it('should delete credentials successfully', async () => {
            vi.mocked(keytar.deletePassword).mockResolvedValue(true);

            const result = await service.deleteCredentials('dist1');

            expect(keytar.deletePassword).toHaveBeenCalledWith('IndiiOS_Distribution', 'dist1');
            expect(result).toBe(true);
        });

        it('should catch keytar errors and return false', async () => {
            vi.mocked(keytar.deletePassword).mockRejectedValue(new Error('keytar error'));

            const result = await service.deleteCredentials('dist1');
            expect(result).toBe(false);
        });
    });
});
