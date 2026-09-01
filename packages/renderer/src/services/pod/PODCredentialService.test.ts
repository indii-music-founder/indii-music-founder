import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PODCredentialService } from './PODCredentialService';

const USER_ID = 'user_test_123';

describe('PODCredentialService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock electronAPI.credentials bridge
        window.electronAPI = {
            credentials: {
                save: vi.fn(),
                get: vi.fn(),
                delete: vi.fn(),
            },
        } as any;
    });

    afterEach(() => {
        window.electronAPI = undefined as any;
    });

    // -------------------------------------------------------------------------
    // saveCredential
    // -------------------------------------------------------------------------
    describe('saveCredential', () => {
        it('calls electronAPI.credentials.save with serviceId and credentials', async () => {
            const mockSave = vi.mocked(window.electronAPI?.credentials?.save);
            await PODCredentialService.saveCredential(USER_ID, 'printful', 'pk_test_abc');

            expect(mockSave).toHaveBeenCalledOnce();
            expect(mockSave).toHaveBeenCalledWith('indii-pod-printful', { [USER_ID]: 'pk_test_abc' });
        });

        it('saves printify credentials', async () => {
            const mockSave = vi.mocked(window.electronAPI?.credentials?.save);
            await PODCredentialService.saveCredential(USER_ID, 'printify', 'py_key_xyz');

            expect(mockSave).toHaveBeenCalledWith('indii-pod-printify', { [USER_ID]: 'py_key_xyz' });
        });

        it('throws when Electron API is unavailable', async () => {
            window.electronAPI = undefined as any;
            await expect(
                PODCredentialService.saveCredential(USER_ID, 'printful', 'key')
            ).rejects.toThrow('Credential storage requires Electron desktop environment');
        });
    });

    // -------------------------------------------------------------------------
    // loadCredential
    // -------------------------------------------------------------------------
    describe('loadCredential', () => {
        it('returns the stored key when credentials exist', async () => {
            const mockGet = vi.mocked(window.electronAPI?.credentials?.get);
            mockGet.mockResolvedValueOnce({ [USER_ID]: 'stored_key_123' });

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBe('stored_key_123');
            expect(mockGet).toHaveBeenCalledWith('indii-pod-printful');
        });

        it('returns null when credentials do not exist', async () => {
            const mockGet = vi.mocked(window.electronAPI?.credentials?.get);
            mockGet.mockResolvedValueOnce(null);

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBeNull();
        });

        it('returns null when the userId key is absent', async () => {
            const mockGet = vi.mocked(window.electronAPI?.credentials?.get);
            mockGet.mockResolvedValueOnce({ other_user: 'other_key' });

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBeNull();
        });

        it('returns null when Electron API is unavailable', async () => {
            window.electronAPI = undefined as any;

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // loadAllCredentials
    // -------------------------------------------------------------------------
        describe('loadAllCredentials', () => {
        it('returns all stored provider credentials', async () => {
            const mockGet = vi.mocked(window.electronAPI?.credentials?.get);
            mockGet
                .mockResolvedValueOnce({ [USER_ID]: 'k1' }) // printful
                .mockResolvedValueOnce({ [USER_ID]: 'k2' }) // printify
                .mockResolvedValueOnce(null); // gooten

            const result = await PODCredentialService.loadAllCredentials(USER_ID);
            expect(result).toEqual({ printful: 'k1', printify: 'k2' });
        });

        it('returns empty object when Electron API is unavailable', async () => {
            window.electronAPI = undefined as any;

            const result = await PODCredentialService.loadAllCredentials(USER_ID);
            expect(result).toEqual({});
        });

        it('skips providers that fail to load', async () => {
            const mockGet = vi.mocked(window.electronAPI?.credentials?.get);
            mockGet
                .mockResolvedValueOnce({ [USER_ID]: 'k1' }) // printful succeeds
                .mockRejectedValueOnce(new Error('Network error')) // printify fails
                .mockResolvedValueOnce({ [USER_ID]: 'k3' }); // gooten succeeds

            const result = await PODCredentialService.loadAllCredentials(USER_ID);
            expect(result).toEqual({ printful: 'k1', gooten: 'k3' });
        });
    });

    // -------------------------------------------------------------------------
    // removeCredential
    // -------------------------------------------------------------------------
    describe('removeCredential', () => {
        it('calls electronAPI.credentials.delete with serviceId', async () => {
            const mockDelete = vi.mocked(window.electronAPI?.credentials?.delete);
            await PODCredentialService.removeCredential(USER_ID, 'printful');

            expect(mockDelete).toHaveBeenCalledOnce();
            expect(mockDelete).toHaveBeenCalledWith('indii-pod-printful');
        });

        it('throws when Electron API is unavailable', async () => {
            window.electronAPI = undefined as any;
            await expect(
                PODCredentialService.removeCredential(USER_ID, 'printful')
            ).rejects.toThrow('Credential storage requires Electron desktop environment');
        });
    });

    // -------------------------------------------------------------------------
    // validateKey
    // -------------------------------------------------------------------------
    describe('validateKey', () => {
        it('returns true for printful when fetch responds ok', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
            const valid = await PODCredentialService.validateKey('printful', 'good_key');
            expect(valid).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.printful.com/store',
                expect.objectContaining({ headers: { Authorization: 'Bearer good_key' } })
            );
        });

        it('returns false for printful when fetch responds not ok', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({ ok: false } as Response);
            const valid = await PODCredentialService.validateKey('printful', 'bad_key');
            expect(valid).toBe(false);
        });

        it('returns true for printify when fetch responds ok', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
            const valid = await PODCredentialService.validateKey('printify', 'py_key');
            expect(valid).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.printify.com/v1/shops.json',
                expect.anything()
            );
        });

        it('returns true for gooten when fetch responds ok', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response);
            const valid = await PODCredentialService.validateKey('gooten', 'gt_key');
            expect(valid).toBe(true);
        });

        it('returns false and does not throw when fetch rejects', async () => {
            global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
            const valid = await PODCredentialService.validateKey('printful', 'any_key');
            expect(valid).toBe(false);
        });

        it('returns false for unknown provider', async () => {
            const valid = await PODCredentialService.validateKey(
                'unknown_provider' as Parameters<typeof PODCredentialService.validateKey>[0],
                'key'
            );
            expect(valid).toBe(false);
        });
    });
});
