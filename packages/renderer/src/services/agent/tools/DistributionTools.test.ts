/**
 * DistributionTools.test.ts
 * Tests for the Direct Distribution Engine tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importWithRetry } from '@/utils/dynamicImport';

const callableNames = vi.hoisted(() => [] as string[]);

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
    addDoc: vi.fn(async () => ({ id: 'mock-doc-id' })),
    serverTimestamp: vi.fn(() => new Date().toISOString())
}));

vi.mock('@/services/distribution/proprietary-ingestion/IngestionNotificationService', () => ({
    ingestionNotificationService: {
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

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn((_functions: unknown, name: string) => {
        callableNames.push(name);
        return vi.fn(async () => {
            if (name === 'createSftpIngestionRecord') {
                return { data: { ingestionId: 'ing-123' } };
            }
            if (name === 'requestDistributionTakedown') {
                return { data: { takedownId: 'td-123' } };
            }
            return { data: {} };
        });
    }),
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
            generateIngestionNotification: vi.fn().mockResolvedValue('<xml>...</xml>'),
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
        callableNames.length = 0;
        disableElectron();

        // Reset validation mocks to pass by default
        const { IdentifierService } = await importWithRetry(() => import('@/services/identity/IdentifierService'));
        vi.mocked(IdentifierService.validateISRC).mockReturnValue(true);
        vi.mocked(IdentifierService.validateUPC).mockReturnValue(true);
    });

    describe('issue_isrc', () => {
        it('should generate a valid ISRC', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.issue_isrc({
                trackTitle: 'Test Track',
                artist: 'Test Artist',
                year: 2026
            });

            const parsed = result;
            expect(parsed.success).toBe(true);
            expect(parsed.data.isrc).toMatch(/^USIND26\d{5}$/);
            expect(parsed.data.track_title).toBe('Test Track');
            expect(parsed.data.registry_status).toBe('RECORDED_EXTERNAL');
        });
    });

    describe('certify_tax_profile', () => {
        it('should require the Bank Layer for tax certification', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                fullName: 'Test User',
                isUsPerson: true,
                country: 'US',
                tin: '123-45-6789',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.metadata?.errorCode).toBe('TAX_BANK_LAYER_REQUIRED');
        });

        it('should require legal name for certification', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                isUsPerson: true,
                country: 'US',
                tin: 'invalid-tin',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.metadata?.errorCode).toBe('LEGAL_NAME_REQUIRED');
        });

        it('should not locally certify missing perjury signature', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                fullName: 'Test User',
                isUsPerson: true,
                country: 'US',
                tin: '123-45-6789',
                signedUnderPerjury: false
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.metadata?.errorCode).toBe('TAX_BANK_LAYER_REQUIRED');
        });

        it('should not locally select W-8BEN for foreign individuals', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                fullName: 'Test User',
                isUsPerson: false,
                isEntity: false,
                country: 'UK',
                tin: 'AB12345678',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.metadata?.errorCode).toBe('TAX_BANK_LAYER_REQUIRED');
        });

        it('should not locally select W-8BEN-E for foreign entities', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                fullName: 'Test User',
                isUsPerson: false,
                isEntity: true,
                country: 'DE',
                tin: 'DE123456789',
                signedUnderPerjury: true
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.metadata?.errorCode).toBe('TAX_BANK_LAYER_REQUIRED');
        });

        it('sends the canonical snake_case schema to the Bank Layer and succeeds (ISSUE-793)', async () => {
            enableElectron();
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.certify_tax_profile({
                userId: 'user-123',
                fullName: 'Test User',
                isUsPerson: true,
                isEntity: false,
                country: 'US',
                tin: '123-45-6789',
                signedUnderPerjury: true
            });

            const certifyTaxMock = (window as unknown as { electronAPI: { distribution: { certifyTax: import('vitest').Mock } } }).electronAPI.distribution.certifyTax;
            expect(certifyTaxMock).toHaveBeenCalledWith('user-123', {
                full_name: 'Test User',
                country: 'US',
                tin: '123-45-6789',
                is_us_person: true,
                is_entity: false,
                signed_under_perjury: true
            });

            expect(result.success).toBe(true);
            disableElectron();
        });
    });

    describe('calculate_payout', () => {
        it('should calculate waterfall correctly', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

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
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));
            const { IdentifierService } = await importWithRetry(() => import('@/services/identity/IdentifierService'));
            vi.mocked(IdentifierService.validateISRC).mockReturnValue(false);

            const result = await DistributionTools.prepare_release({
                title: 'Test Track',
                artist: 'Test Artist',
                upc: '012345678905',
                isrc: 'INVALID',
                label: 'Test Label',
                genre: 'Rock',
                language: 'eng',
                releaseDate: '2026-01-01'
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.error).toContain('Invalid ISRC format');
        });

        it('should reject invalid UPC', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));
            const { IdentifierService } = await importWithRetry(() => import('@/services/identity/IdentifierService'));
            vi.mocked(IdentifierService.validateUPC).mockReturnValue(false);

            const result = await DistributionTools.prepare_release({
                title: 'Test Track',
                artist: 'Test Artist',
                upc: '123456789',
                isrc: 'USIND2600001',
                label: 'Test Label',
                genre: 'Rock',
                language: 'eng',
                releaseDate: '2026-01-01'
            });

            const parsed = result;
            expect(parsed.success).toBe(false);
            expect(parsed.error).toContain('Invalid UPC format');
        });
    });

    describe('manual fallback paths', () => {
        it('labels premium video distribution as manual-only when no DSP worker is deployed', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.distribute_premium_video({
                videoTitle: 'Live Visual',
                artistName: 'Test Artist',
                videoUrl: 'https://example.com/video.mp4',
                targetDSP: 'VEVO',
            });

            expect(result.success).toBe(true);
            expect(result.data.deliveryStatus).toBe('QUEUED_FOR_MANUAL_REVIEW');
            expect(result.data.note).toContain('manual processing');
            expect(callableNames).not.toContain('distributeVideoToDSP');
        });

        it('labels SFTP ingestion as manual-only when the server-side worker is unavailable', async () => {
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.sftp_direct_ingestion({
                targetDSP: 'VEVO',
                releaseFolder: '/releases/live-visual',
            });

            expect(result.success).toBe(true);
            expect(result.data.sftpStatus).toBe('PENDING_MANUAL');
            expect(result.data.note).toContain('Manual processing is required');
            expect(callableNames).not.toContain('sftpDeliverRelease');
        });

        it('records takedowns for manual follow-up without calling undeployed notification workers', async () => {
            const { getDoc } = await importWithRetry(() => import('firebase/firestore'));
            vi.mocked(getDoc).mockResolvedValue({
                exists: () => true,
                data: () => ({}),
            } as never);
            const { DistributionTools } = await importWithRetry(() => import('./DistributionTools'));

            const result = await DistributionTools.issue_automated_takedown({
                releaseId: 'release-123',
                reason: 'voluntary withdrawal',
            });

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('RECORDED_PENDING_NOTIFICATION');
            expect(result.data.note).toContain('manual follow-up');
            expect(callableNames).toContain('requestDistributionTakedown');
            expect(callableNames).not.toContain('processReleaseTakedown');
        });
    });
});
