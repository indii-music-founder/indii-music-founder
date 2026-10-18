import { describe, expect, it } from 'vitest';
import { createRegistrationFilingRecord, generateCopilotActionPlan, validateDepositAsset, validateRegistrationManifest, } from './rightsRegistration';
describe('rightsRegistration - ISSUE-1511 Assisted Rights Registration Engine', () => {
    const validDepositAsset = {
        filename: 'track_01_master.wav',
        fileSizeBytes: 45000000,
        mimeType: 'audio/wav',
        sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        durationSeconds: 215,
        localPath: '/masters/track_01_master.wav',
    };
    const validManifest = {
        manifestId: 'manifest-001',
        artistId: 'artist-123',
        artistLegalName: 'Jane Doe',
        artistStageName: 'Jane Beats',
        citizenshipOrDomicile: 'United States',
        targetPortals: ['loc_copyright', 'the_mlc'],
        copyrightFormType: 'Form_SR',
        work: {
            title: 'Midnight Sun',
            yearOfCreation: 2026,
            isPublished: false,
            isrc: 'USIND2600001',
        },
        splits: [
            {
                legalName: 'Jane Doe',
                role: 'writer_composer',
                sharePercentage: 60,
                ipiCaeNumber: '00123456789',
                proAffiliation: 'BMI',
            },
            {
                legalName: 'John Smith',
                role: 'lyricist',
                sharePercentage: 40,
                ipiCaeNumber: '00987654321',
                proAffiliation: 'ASCAP',
            },
        ],
        depositAssets: [validDepositAsset],
        createdAtMs: 1728000000000,
        updatedAtMs: 1728000000000,
    };
    describe('validateRegistrationManifest', () => {
        it('passes for a well-formed complete manifest', () => {
            const result = validateRegistrationManifest(validManifest);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('rejects manifest missing artist legal name', () => {
            const invalid = { ...validManifest, artistLegalName: '   ' };
            const result = validateRegistrationManifest(invalid);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Artist legal name is required for official copyright and royalty filings');
        });
        it('rejects manifest with empty target portals list', () => {
            const invalid = { ...validManifest, targetPortals: [] };
            const result = validateRegistrationManifest(invalid);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('At least one target portal (e.g. loc_copyright, the_mlc) must be specified');
        });
        it('rejects manifest with missing work title', () => {
            const invalid = { ...validManifest, work: { ...validManifest.work, title: '' } };
            const result = validateRegistrationManifest(invalid);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Work title is required');
        });
        it('rejects manifest when writer splits do not sum to 100%', () => {
            const invalid = {
                ...validManifest,
                splits: [
                    {
                        legalName: 'Jane Doe',
                        role: 'writer_composer',
                        sharePercentage: 50,
                    },
                    {
                        legalName: 'John Smith',
                        role: 'lyricist',
                        sharePercentage: 40, // 50 + 40 = 90%
                    },
                ],
            };
            const result = validateRegistrationManifest(invalid);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toContain('Writer splits must total exactly 100%');
        });
    });
    describe('validateDepositAsset', () => {
        it('validates a correct deposit audio asset', () => {
            const result = validateDepositAsset(validDepositAsset);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('rejects invalid or malformed SHA-256 checksums', () => {
            const invalid = {
                ...validDepositAsset,
                sha256Checksum: 'invalid-checksum-short',
            };
            const result = validateDepositAsset(invalid);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Deposit asset requires a valid 64-character SHA-256 hexadecimal checksum');
        });
        it('rejects zero or negative byte sizes', () => {
            const invalid = {
                ...validDepositAsset,
                fileSizeBytes: 0,
            };
            const result = validateDepositAsset(invalid);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Deposit file size must be greater than zero bytes');
        });
    });
    describe('generateCopilotActionPlan', () => {
        it('generates a step-by-step action sequence for US Copyright Office eCO', () => {
            const actions = generateCopilotActionPlan(validManifest, 'loc_copyright');
            expect(actions.length).toBeGreaterThanOrEqual(7);
            const navAction = actions.find((a) => a.type === 'navigate');
            expect(navAction?.value).toContain('copyright.gov');
            const formAction = actions.find((a) => a.type === 'select_option');
            expect(formAction?.value).toBe('Form_SR');
            const authAction = actions.find((a) => a.type === 'pause_for_user_auth');
            expect(authAction?.requiresUserAction).toBe(true);
            const depositAction = actions.find((a) => a.type === 'stage_deposit_upload');
            expect(depositAction?.value).toBe('track_01_master.wav');
            const paymentAction = actions.find((a) => a.type === 'pause_for_user_payment');
            expect(paymentAction?.requiresUserAction).toBe(true);
            const confirmAction = actions.find((a) => a.type === 'extract_confirmation');
            expect(confirmAction).toBeDefined();
        });
        it('generates action sequence for The MLC portal work registration', () => {
            const actions = generateCopilotActionPlan(validManifest, 'the_mlc');
            expect(actions.length).toBeGreaterThanOrEqual(4);
            const navAction = actions.find((a) => a.type === 'navigate');
            expect(navAction?.value).toContain('themlc.com');
            const titleAction = actions.find((a) => a.targetFieldKey === 'work.title');
            expect(titleAction?.value).toBe('Midnight Sun');
        });
        it('generates non-empty action plans with auth pause and confirmation extraction for all 6 portals', () => {
            const portals = ['loc_copyright', 'the_mlc', 'bmi', 'ascap', 'soundexchange', 'hfa'];
            for (const portal of portals) {
                const actions = generateCopilotActionPlan(validManifest, portal);
                expect(actions.length).toBeGreaterThanOrEqual(5);
                expect(actions.some((a) => a.type === 'navigate')).toBe(true);
                expect(actions.some((a) => a.type === 'pause_for_user_auth' && a.requiresUserAction)).toBe(true);
                expect(actions.some((a) => a.type === 'autofill_input' && a.value === 'Midnight Sun')).toBe(true);
                expect(actions.some((a) => a.type === 'extract_confirmation')).toBe(true);
            }
        });
    });
    describe('createRegistrationFilingRecord', () => {
        it('creates a user-reported receipt record with SHA-256 deposit provenance', () => {
            const record = createRegistrationFilingRecord(validManifest, 'loc_copyright', {
                confirmationNumber: '1-14928374651',
                serviceRequestId: 'SR-2026-09912',
                filingFeeUsd: 45,
                officialFilingDate: '2026-10-12',
            });
            expect(record.portalTarget).toBe('loc_copyright');
            expect(record.status).toBe('outcome_unknown');
            expect(record.evidenceSource).toBe('user_report');
            expect(record.confirmationNumber).toBe('1-14928374651');
            expect(record.serviceRequestId).toBe('SR-2026-09912');
            expect(record.workTitle).toBe('Midnight Sun');
            expect(record.isrc).toBe('USIND2600001');
            expect(record.depositChecksum).toBe(validDepositAsset.sha256Checksum);
            expect(record.filingFeeUsd).toBe(45);
            expect(record.officialFilingDate).toBe('2026-10-12');
        });
        it('throws when confirmationNumber is empty', () => {
            expect(() => createRegistrationFilingRecord(validManifest, 'the_mlc', {
                confirmationNumber: '   ',
            })).toThrow('Official confirmation number is required');
        });
    });
});
