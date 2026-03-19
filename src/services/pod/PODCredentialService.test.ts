import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PODCredentialService } from './PODCredentialService';

// firebase/firestore is mocked globally in src/test/setup.ts
// We re-import the mock handles here so we can configure per-test behavior.
import * as firestore from 'firebase/firestore';

const mockGetDoc = vi.mocked(firestore.getDoc);
const mockSetDoc = vi.mocked(firestore.setDoc);
const mockUpdateDoc = vi.mocked(firestore.updateDoc);

const USER_ID = 'user_test_123';

describe('PODCredentialService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // saveCredential
    // -------------------------------------------------------------------------
    describe('saveCredential', () => {
        it('calls setDoc with merge:true and the correct provider key', async () => {
            mockSetDoc.mockResolvedValueOnce(undefined as unknown as void);
            await PODCredentialService.saveCredential(USER_ID, 'printful', 'pk_test_abc');

            expect(mockSetDoc).toHaveBeenCalledOnce();
            const [, data, options] = mockSetDoc.mock.calls[0]!;
            expect(data).toEqual({ printful: 'pk_test_abc' });
            expect(options).toEqual({ merge: true });
        });

        it('saves printify credentials', async () => {
            mockSetDoc.mockResolvedValueOnce(undefined as unknown as void);
            await PODCredentialService.saveCredential(USER_ID, 'printify', 'py_key_xyz');

            const [, data] = mockSetDoc.mock.calls[0]!;
            expect(data).toEqual({ printify: 'py_key_xyz' });
        });
    });

    // -------------------------------------------------------------------------
    // loadCredential
    // -------------------------------------------------------------------------
    describe('loadCredential', () => {
        it('returns the stored key when the document exists', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ printful: 'stored_key_123' }),
                id: 'pod_credentials',
            } as ReturnType<typeof mockGetDoc> extends Promise<infer R> ? R : never);

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBe('stored_key_123');
        });

        it('returns null when the document does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
                id: 'pod_credentials',
            } as ReturnType<typeof mockGetDoc> extends Promise<infer R> ? R : never);

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBeNull();
        });

        it('returns null when the provider field is absent', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ printify: 'other_key' }),
                id: 'pod_credentials',
            } as ReturnType<typeof mockGetDoc> extends Promise<infer R> ? R : never);

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBeNull();
        });

        it('returns null and does not throw when getDoc rejects', async () => {
            mockGetDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));

            const key = await PODCredentialService.loadCredential(USER_ID, 'printful');
            expect(key).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // loadAllCredentials
    // -------------------------------------------------------------------------
    describe('loadAllCredentials', () => {
        it('returns all stored provider keys', async () => {
            const stored = { printful: 'k1', printify: 'k2', gooten: 'k3' };
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => stored,
                id: 'pod_credentials',
            } as ReturnType<typeof mockGetDoc> extends Promise<infer R> ? R : never);

            const result = await PODCredentialService.loadAllCredentials(USER_ID);
            expect(result).toEqual(stored);
        });

        it('returns empty object when document does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
                id: 'pod_credentials',
            } as ReturnType<typeof mockGetDoc> extends Promise<infer R> ? R : never);

            const result = await PODCredentialService.loadAllCredentials(USER_ID);
            expect(result).toEqual({});
        });

        it('returns empty object and does not throw on error', async () => {
            mockGetDoc.mockRejectedValueOnce(new Error('Network error'));

            const result = await PODCredentialService.loadAllCredentials(USER_ID);
            expect(result).toEqual({});
        });
    });

    // -------------------------------------------------------------------------
    // removeCredential
    // -------------------------------------------------------------------------
    describe('removeCredential', () => {
        it('calls updateDoc with deleteField() for the given provider', async () => {
            mockUpdateDoc.mockResolvedValueOnce(undefined as unknown as void);
            await PODCredentialService.removeCredential(USER_ID, 'printful');

            expect(mockUpdateDoc).toHaveBeenCalledOnce();
            const [, fields] = mockUpdateDoc.mock.calls[0]!;
            // deleteField() returns a sentinel object — just verify the key exists
            expect(Object.keys(fields as object)).toContain('printful');
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
