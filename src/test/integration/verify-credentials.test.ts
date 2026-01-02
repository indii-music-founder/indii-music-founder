import { describe, it, expect, vi, beforeEach } from 'vitest';
import { credentialService } from '@/services/security/CredentialService';
import { DistributorId } from '@/services/distribution/types/distributor';

// Mock the credential service since keytar requires native modules
vi.mock('@/services/security/CredentialService', () => {
    const store = new Map<string, Record<string, string>>();
    return {
        credentialService: {
            saveCredentials: vi.fn(async (id: string, creds: Record<string, string>) => {
                store.set(id, creds);
            }),
            getCredentials: vi.fn(async (id: string) => {
                return store.get(id) || null;
            }),
            deleteCredentials: vi.fn(async (id: string) => {
                store.delete(id);
            })
        }
    };
});

describe('Credential Service', () => {
    const testId: DistributorId = 'distrokid';
    const mockCreds = { apiKey: 'test-key-12345', apiSecret: 'shhh-secret' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should save credentials', async () => {
        await credentialService.saveCredentials(testId, mockCreds);
        expect(credentialService.saveCredentials).toHaveBeenCalledWith(testId, mockCreds);
    });

    it('should retrieve saved credentials', async () => {
        await credentialService.saveCredentials(testId, mockCreds);
        const retrieved = await credentialService.getCredentials(testId);
        expect(retrieved?.apiKey).toBe(mockCreds.apiKey);
    });

    it('should delete credentials', async () => {
        await credentialService.saveCredentials(testId, mockCreds);
        await credentialService.deleteCredentials(testId);
        const afterDelete = await credentialService.getCredentials(testId);
        expect(afterDelete).toBeNull();
    });
});
