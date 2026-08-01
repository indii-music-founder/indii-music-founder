import { describe, expect, it } from 'vitest';
import {
    MasterTimingProfileSchema,
    MasterSyncAlignmentSchema,
} from './masterSyncAlignment';

const HASH_64 = 'a'.repeat(64);

const mockGuideAudioRef = {
    schemaVersion: 'canonical-media-ref.v1' as const,
    role: 'guide_audio' as const,
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    bucket: 'indii-test.firebasestorage.app',
    path: 'session-media/user-1/session-1/guide/guide.wav',
    generation: '123456789',
    sha256: HASH_64,
    mimeType: 'audio/wav',
    byteSize: 1048576,
    createdAt: '2026-07-31T18:00:00.000Z',
    creationReceiptId: 'receipt-guide-1',
};

const mockCanonicalMasterRef = {
    bucket: 'indii-test.firebasestorage.app',
    path: 'masters/user-1/master.wav',
    generation: '987654321',
    sha256: HASH_64,
    masterFingerprint: 'SONIC-master-1',
};

const validAlignment = {
    schemaVersion: 'master-sync-alignment.v1' as const,
    alignmentId: 'align-1',
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    timeMapVersion: 'sync-time-map.v1' as const,
    guideAudioRef: mockGuideAudioRef,
    canonicalMasterRef: mockCanonicalMasterRef,
    anchors: [
        { videoUs: 1_000_000, masterUs: 5_000_000, confidence: 0.95, method: 'cross_correlation' as const },
        { videoUs: 10_000_000, masterUs: 14_000_000, confidence: 0.92, method: 'onset' as const },
    ],
    fitModel: 'linear' as const,
    residualP95Us: 15_000, // 15ms
    driftPpm: 2.5,
    status: 'locked' as const,
    aggregateConfidence: 0.93,
    algorithmVersion: 'align-dsp.v1',
    manualOverrides: [],
    createdAt: '2026-07-31T18:00:00.000Z',
    updatedAt: '2026-07-31T18:00:00.000Z',
    receiptId: 'receipt-align-1',
};

describe('MasterSyncAlignment Schema', () => {
    it('parses a valid locked alignment receipt', () => {
        const result = MasterSyncAlignmentSchema.safeParse(validAlignment);
        expect(result.success).toBe(true);
    });

    it('rejects locked status when aggregate confidence is low (< 0.80)', () => {
        const invalid = {
            ...validAlignment,
            aggregateConfidence: 0.65,
        };
        const result = MasterSyncAlignmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('confidence is below 0.80');
        }
    });

    it('rejects locked status when residual P95 exceeds 40ms', () => {
        const invalid = {
            ...validAlignment,
            residualP95Us: 50_000, // 50ms
        };
        const result = MasterSyncAlignmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('residual P95 error exceeds 40ms');
        }
    });

    it('rejects non-monotonic anchor timestamps', () => {
        const invalid = {
            ...validAlignment,
            anchors: [
                { videoUs: 5_000_000, masterUs: 5_000_000, confidence: 0.9, method: 'onset' as const },
                { videoUs: 4_000_000, masterUs: 6_000_000, confidence: 0.9, method: 'onset' as const },
            ],
        };
        const result = MasterSyncAlignmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('strictly monotonic in video presentation time');
        }
    });

    it('rejects cross-owner guide audio reference', () => {
        const invalid = {
            ...validAlignment,
            guideAudioRef: {
                ...mockGuideAudioRef,
                ownerUid: 'other-user',
            },
        };
        const result = MasterSyncAlignmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });
});

describe('MasterTimingProfile Schema', () => {
    it('parses a valid master timing profile', () => {
        const profile = {
            schemaVersion: 'master-timing-profile.v1' as const,
            contentHash: HASH_64,
            generation: '987654321',
            masterFingerprint: 'SONIC-master-1',
            durationUs: 180_000_000, // 3 minutes
            sampleRate: 44100,
            bpm: 120.0,
            beatsUs: [500_000, 1_000_000, 1_500_000],
            onsetsUs: [100_000, 500_000, 950_000],
            createdAt: '2026-07-31T18:00:00.000Z',
        };
        const result = MasterTimingProfileSchema.safeParse(profile);
        expect(result.success).toBe(true);
    });
});
