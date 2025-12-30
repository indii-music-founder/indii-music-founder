import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeliveryService } from './DeliveryService';
import { ernService } from '@/services/ddex/ERNService';
import { ExtendedGoldenMetadata } from './types/distributor';

// Mock dependencies
vi.mock('@/services/ddex/ERNService', () => ({
    ernService: {
        generateERN: vi.fn(),
        parseERN: vi.fn(),
        validateERNContent: vi.fn(),
    },
}));

vi.mock('@/services/security/CredentialService', () => ({
    credentialService: {
        getCredentials: vi.fn().mockResolvedValue({}),
    },
}));

// Mock FS for the test environment (since vitest runs in Node)
// But DeliveryService uses dynamic import, so we need to mock that interaction or environment.
// Since we can't easily mock dynamic imports that are inside the function without more setup,
// we will verify the logic that calls ernService and handles the result.

describe('DeliveryService', () => {
    let deliveryService: DeliveryService;

    beforeEach(() => {
        vi.clearAllMocks();
        deliveryService = new DeliveryService();
    });

    describe('generateReleasePackage', () => {
        it('should generate ERN XML and return success with xml content', async () => {
            const mockMetadata = { upc: '123' } as ExtendedGoldenMetadata;
            const mockXml = '<ern>test</ern>';

            vi.mocked(ernService.generateERN).mockResolvedValue({
                success: true,
                xml: mockXml,
            });

            // We mock the environment to simulate browser where fs fails,
            // OR we verify that it returns success even if fs fails (as per our implementation logic).
            // Actually, in Vitest (Node env), the dynamic import('fs') WILL work.
            // So we might get an error if we provide a dummy path that it tries to write to.
            // Let's rely on the behavior that it returns { success: true, xml } in either case.

            // To avoid actual file writing during test, we can try to mock 'fs'.
            // However, mocking dynamic imports is tricky.
            // We'll trust the return value structure.

            // To prevent actual file writing in test, we'll use a fake output directory
            // and maybe expect it to fail safely or succeed if we mock fs properly.
            // But since we can't easily mock the dynamic import 'fs' inside the method from here without hoisting,
            // let's just focus on the 'generateERN' call.

            const result = await deliveryService.generateReleasePackage(mockMetadata, '/tmp/test-output');

            expect(ernService.generateERN).toHaveBeenCalledWith(mockMetadata);
            expect(result.success).toBe(true);
            expect(result.xml).toBe(mockXml);
            // We don't strictly assert packagePath because it depends on fs success
        });

        it('should return error if ERN generation fails', async () => {
            const mockMetadata = { upc: '123' } as ExtendedGoldenMetadata;

            vi.mocked(ernService.generateERN).mockResolvedValue({
                success: false,
                error: 'Generation failed',
            });

            const result = await deliveryService.generateReleasePackage(mockMetadata, '/tmp/test-output');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Generation failed');
        });
    });

    describe('validateReleasePackage', () => {
        it('should validate successfully when all checks pass', async () => {
             const mockMetadata = { upc: '123' } as ExtendedGoldenMetadata;
             const mockXml = '<ern>test</ern>';
             const mockParsed = { messageHeader: {} } as any;

             vi.mocked(ernService.generateERN).mockResolvedValue({ success: true, xml: mockXml });
             vi.mocked(ernService.parseERN).mockReturnValue({ success: true, data: mockParsed });
             vi.mocked(ernService.validateERNContent).mockReturnValue({ valid: true, errors: [] });

             const result = await deliveryService.validateReleasePackage(mockMetadata);

             expect(result.valid).toBe(true);
             expect(result.errors).toEqual([]);
        });
    });
});
