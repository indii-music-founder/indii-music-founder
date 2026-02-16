
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeliveryService } from '@/services/distribution/DeliveryService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { ernService } from '@/services/ddex/ERNService';

// Mock dependencies
vi.mock('@/services/security/CredentialService', () => ({
  credentialService: {
    getCredentials: vi.fn().mockResolvedValue({ username: 'user', password: 'pass' })
  }
}));

vi.mock('./transport/SFTPTransporter', () => ({
  SFTPTransporter: class {
    isConnected = vi.fn().mockResolvedValue(false);
    disconnect = vi.fn();
  }
}));

vi.mock('@/services/ddex/ERNService', () => ({
  ernService: {
    generateERN: vi.fn().mockResolvedValue({ success: true, xml: '<xml>mock</xml>' }),
    parseERN: vi.fn().mockReturnValue({ success: true, data: { resourceList: [] } }),
    validateERNContent: vi.fn().mockReturnValue({ valid: true, errors: [] })
  }
}));

describe('DeliveryService', () => {
    let service: DeliveryService;

    beforeEach(() => {
        service = new DeliveryService();
        vi.clearAllMocks();
    });

    it('should validate release package', async () => {
         const mockMetadata: ExtendedGoldenMetadata = {
            upc: '1234567890123',
            releaseTitle: 'Test Album',
            artistName: 'Test Artist',
            isrc: 'US12345',
        } as ExtendedGoldenMetadata;

        const result = await service.validateReleasePackage(mockMetadata);

        expect(ernService.generateERN).toHaveBeenCalledWith(mockMetadata, undefined, undefined, undefined);
        expect(ernService.parseERN).toHaveBeenCalled();
        expect(ernService.validateERNContent).toHaveBeenCalled();
        expect(result.valid).toBe(true);
    });

    it('should fail validation if generation fails', async () => {
        vi.mocked(ernService.generateERN).mockResolvedValueOnce({ success: false, error: 'Gen Error' });
        const result = await service.validateReleasePackage({} as ExtendedGoldenMetadata);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Gen Error');
    });
});
