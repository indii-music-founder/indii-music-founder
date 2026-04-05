/**
 * DistributionTools.test.ts
 * Tests for the Direct Distribution Engine tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase before importing tools
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user-123' } },
    remoteConfig: { defaultConfig: {} },
    getFirebaseAI: vi.fn(() => ({})),
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    collection: vi.fn(),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn(() => new Date().toISOString())
}));

vi.mock('@/services/ddex/ERNService', () => ({
    ernService: {
        generateERN: vi.fn().mockResolvedValue({
            success: true,
            xml: '<ern:NewReleaseMessage>...</ern:NewReleaseMessage>'
        })
    }
}));

vi.mock('@/services/identity/IdentifierService', () => ({
    IdentifierService: {
        nextISRC: vi.fn().mockResolvedValue('USIND2600001'),
        validateISRC: vi.fn().mockReturnValue(true),
        validateUPC: vi.fn().mockReturnValue(true)
    }
}));

// Mock electronAPI
if (typeof window !== 'undefined') {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined; // Disable by default for tests that expect JS fallback
}

function enableElectron() {
    (window as unknown as { electronAPI?: unknown }).electronAPI = {
        distribution: {
            generateISRC: vi.fn().mockResolvedValue({ isrc: 'USIND2600001' }),
            registerRelease: vi.fn().mockResolvedValue({ success: true }),
            generateDDEX: vi.fn().mockResolvedValue('<xml>...</xml>'),
            calculateTax: vi.fn().mockResolvedValue({ report: { withholding_rate: 0 } }),
            certifyTax: vi.fn().mockResolvedValue({ report: { certified: true, payout_status: 'ACTIVE' } }),
            executeWaterfall: vi.fn().mockResolvedValue({ report: { net_revenue: 9000 } }),
            validateMetadata: vi.fn().mockResolvedValue({ report: { valid: true, errors: [], warnings: [] } }),
            generateBWARM: vi.fn().mockResolvedValue({ csv: '...', report: {} }),
            checkMerlinStatus: vi.fn().mockResolvedValue({ report: { compliant: true } })
        }
    };
}

function disableElectron() {
    if (typeof window !== 'undefined') {
        (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
    }
}

describe('DistributionTools', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        disableElectron();

        // Reset validation mocks to pass by default
        const { IdentifierService } = await import('@/services/identity/IdentifierService');
        vi.mocked(IdentifierService.validateISRC).mockReturnValue(true);
        vi.mocked(IdentifierService.validateUPC).mockReturnValue(true);
    });

    describe('issue_isrc', () => {
        it('should generate a valid ISRC', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.issue_isrc({
                trackTitle: 'Test Track',
                artist: 'Test Artist',
                year: 2026
            });

            const parsed = result;
            expect(parsed.success).toBe(true);
            expect(parsed.data.isrc).toMatch(/^USIND26\d{5}$/);
            expect(parsed.data.track_title).toBe('Test Track');
            expect(parsed.data.registry_status).toBe('REGISTERED');
        }, 10000); // 10s timeout to avoid flaky cold-start failures
    });

    describe('certify_tax_profile', () => {
        it('should certify valid US SSN format', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                isUsPerson: true,
                country: 'US',
                tin: '123-45-6789',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.success).toBe(true);
            expect(parsed.data.form_type).toBe('W-9');
            expect(parsed.data.tin_valid).toBe(true);
            expect(parsed.data.payout_status).toBe('ACTIVE');
        });

        it('should reject invalid TIN format', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                isUsPerson: true,
                country: 'US',
                tin: 'invalid-tin',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.data.tin_valid).toBe(false);
            expect(parsed.data.payout_status).toBe('HELD');
            expect(parsed.data.tin_message).toContain('TIN Match Fail');
        });

        it('should require perjury signature for certification', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                isUsPerson: true,
                country: 'US',
                tin: '123-45-6789',
                signedUnderPerjury: false
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.data.certified).toBe(false);
            expect(parsed.data.payout_status).toBe('HELD');
        });

        it('should select W-8BEN for foreign individuals', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                isUsPerson: false,
                isEntity: false,
                country: 'UK',
                tin: 'AB12345678',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.data.form_type).toBe('W-8BEN');
        });

        it('should select W-8BEN-E for foreign entities', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                isUsPerson: false,
                isEntity: true,
                country: 'DE',
                tin: 'DE123456789',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.data.form_type).toBe('W-8BEN-E');
        });
    });

    describe('calculate_payout', () => {
        it('should calculate waterfall correctly', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.calculate_payout({
                grossRevenue: 10000,
                indiiFeePercent: 10,
                recoupableExpenses: 0,
                splits: [
                    { name: 'Artist', percentage: 60 },
                    { name: 'Producer', percentage: 40 }
                ]
            });

            const parsed = result;
            expect(parsed.success).toBe(true);
            expect(parsed.data.gross_revenue).toBe(10000);
            expect(parsed.data.indii_fee).toBe(1000);
            expect(parsed.data.net_distributable).toBe(9000);
        });

        it('should recoup expenses before splits', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.calculate_payout({
                grossRevenue: 10000,
                indiiFeePercent: 10,
                recoupableExpenses: 2000,
                splits: [
                    { name: 'Artist', percentage: 100 }
                ]
            });

            const parsed = result;
            expect(parsed.data.recouped_expenses).toBe(2000);
            expect(parsed.data.net_distributable).toBe(7000); // 10000 - 1000 fee - 2000 recoup
        });
    });

    describe('run_metadata_qc', () => {
        beforeEach(() => {
            disableElectron();
        });

        it('should pass clean metadata', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.run_metadata_qc({
                title: 'Beautiful Song',
                artist: 'Luna Vega',
                artworkUrl: 'https://example.com/artwork.jpg'
            });

            const parsed = result;
            expect(parsed.success).toBe(true);
            expect(parsed.data.status).toBe('PASS');
            expect(parsed.data.errors).toHaveLength(0);
        });

        it('should reject generic artist names', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.run_metadata_qc({
                title: 'Some Track',
                artist: 'Various Artists',
                artworkUrl: 'https://example.com/artwork.jpg'
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.data.status).toBe('FAIL');
            expect(parsed.data.errors).toContain('Generic artist name detected - will be rejected by DSPs');
        });

        it('should warn about ALL CAPS titles', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.run_metadata_qc({
                title: 'LOUD SONG',
                artist: 'Artist Name',
                artworkUrl: 'https://example.com/artwork.jpg'
            });

            const parsed = result;
            expect(parsed.data.status).toBe('WARN');
            expect(parsed.data.warnings).toContain('ALL CAPS title detected - Apple/Spotify recommend Title Case');
        });

        it('should error on featured artist in title', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.run_metadata_qc({
                title: 'My Song (feat. Guest Artist)',
                artist: 'Main Artist',
                artworkUrl: 'https://example.com/artwork.jpg'
            });

            const parsed = result;
            expect(parsed.data.status).toBe('FAIL');
            expect(parsed.data.errors).toContain('Featured artist in title - must be in artist field per DDEX standard');
        });

        it('should require artwork URL', async () => {
            const { DistributionTools } = await import('./DistributionTools');

            const result = await DistributionTools.run_metadata_qc({
                title: 'Good Track',
                artist: 'Good Artist'
            });

            const parsed = result;
            expect(parsed.data.status).toBe('FAIL');
            expect(parsed.data.errors).toContain('Missing artwork URL - required for distribution');
        });
    });

    describe('prepare_release', () => {
        it('should reject invalid ISRC', async () => {
            const { DistributionTools } = await import('./DistributionTools');
            const { IdentifierService } = await import('@/services/identity/IdentifierService');
            vi.mocked(IdentifierService.validateISRC).mockReturnValue(false);

            const result = await DistributionTools.prepare_release({
                title: 'Test Track',
                artist: 'Test Artist',
                upc: '012345678905',
                isrc: 'INVALID'
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.error).toContain('Invalid ISRC format');
        });

        it('should reject invalid UPC', async () => {
            const { DistributionTools } = await import('./DistributionTools');
            const { IdentifierService } = await import('@/services/identity/IdentifierService');
            vi.mocked(IdentifierService.validateUPC).mockReturnValue(false);

            const result = await DistributionTools.prepare_release({
                title: 'Test Track',
                artist: 'Test Artist',
                upc: '123456789',
                isrc: 'USIND2600001'
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.error).toContain('Invalid UPC format');
        });
    });
});
