import { describe, expect, it, vi } from 'vitest';
import { createAlignSessionMasterHandler } from './alignSessionMaster';

const HASH_64 = 'a'.repeat(64);

function createFakeFirestore(sessionData?: Record<string, any>, alignmentData?: Record<string, any>) {
    let storedAlignment = alignmentData;

    const alignmentDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!storedAlignment,
            data: () => storedAlignment,
        })),
        set: vi.fn().mockImplementation(async (data: any) => {
            storedAlignment = data;
        }),
    };

    const alignmentsCollection = {
        doc: vi.fn().mockReturnValue(alignmentDoc),
    };

    const sessionDoc = {
        get: vi.fn().mockImplementation(async () => ({
            exists: !!sessionData,
            data: () => sessionData,
        })),
        collection: vi.fn().mockReturnValue(alignmentsCollection),
    };

    const videoSessionsCollection = {
        doc: vi.fn().mockReturnValue(sessionDoc),
    };

    return {
        collection: vi.fn().mockReturnValue(videoSessionsCollection),
    } as unknown as FirebaseFirestore.Firestore;
}

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

const mockSession = {
    sessionId: 'session-1',
    ownerUid: 'user-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    status: 'completed',
    proxyManifest: {
        guideAudio: mockGuideAudioRef,
    },
};

const mockMasterRef = {
    bucket: 'indii-test.firebasestorage.app',
    path: 'masters/user-1/master.wav',
    generation: '987654321',
    sha256: HASH_64,
    masterFingerprint: 'SONIC-master-1',
};

describe('alignSessionMaster Handler', () => {
    it('executes alignment and persists receipt in Firestore', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createAlignSessionMasterHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            canonicalMasterRef: mockMasterRef,
        }, 'user-1');

        expect(result.reused).toBe(false);
        expect(result.alignment.status).toBe('locked');
        expect(result.alignment.sessionId).toBe('session-1');
        expect(result.alignment.ownerUid).toBe('user-1');
        expect(result.alignment.anchors.length).toBeGreaterThan(0);
    });

    it('denies cross-owner video session access', async () => {
        const db = createFakeFirestore(mockSession);
        const handler = createAlignSessionMasterHandler(db);

        await expect(handler({
            sessionId: 'session-1',
            canonicalMasterRef: mockMasterRef,
        }, 'other-user')).rejects.toThrow('Cross-owner video session access is prohibited.');
    });

    it('rejects alignment when session is not completed', async () => {
        const incompleteSession = { ...mockSession, status: 'uploading' };
        const db = createFakeFirestore(incompleteSession);
        const handler = createAlignSessionMasterHandler(db);

        await expect(handler({
            sessionId: 'session-1',
            canonicalMasterRef: mockMasterRef,
        }, 'user-1')).rejects.toThrow('completed video proxy and guide audio');
    });

    it('reuses existing alignment receipt when available', async () => {
        const existingAlignment = {
            schemaVersion: 'master-sync-alignment.v1',
            alignmentId: 'existing-align-1',
            sessionId: 'session-1',
            ownerUid: 'user-1',
            organizationId: 'org-1',
            projectId: 'proj-1',
            timeMapVersion: 'sync-time-map.v1',
            guideAudioRef: mockGuideAudioRef,
            canonicalMasterRef: mockMasterRef,
            anchors: [{ videoUs: 100, masterUs: 500, confidence: 0.9, method: 'onset' }],
            fitModel: 'linear',
            residualP95Us: 5000,
            driftPpm: 0,
            status: 'locked',
            aggregateConfidence: 0.9,
            algorithmVersion: 'align-dsp.v1',
            manualOverrides: [],
            createdAt: '2026-07-31T18:00:00.000Z',
            updatedAt: '2026-07-31T18:00:00.000Z',
            receiptId: 'receipt-existing-1',
        };

        const db = createFakeFirestore(mockSession, existingAlignment);
        const handler = createAlignSessionMasterHandler(db);

        const result = await handler({
            sessionId: 'session-1',
            canonicalMasterRef: mockMasterRef,
        }, 'user-1');

        expect(result.reused).toBe(true);
        expect(result.alignment.alignmentId).toBe('existing-align-1');
    });
});
