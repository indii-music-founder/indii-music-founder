import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncLicensingClearanceService } from '../SyncLicensingClearanceService';
import { setDoc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Global firebase mocks are set up in packages/renderer/src/test/setup.ts
vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
}));

describe('SyncLicensingClearanceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('createClearanceRequirement writes pending_upload with no undefined keys', async () => {
        vi.mocked(setDoc).mockResolvedValue(undefined);

        const result = await syncLicensingClearanceService.createClearanceRequirement(
            'user-123',
            'release-456',
            'track-789',
            'Lead Song',
            'sync_license',
            'Proof of sync rights'
        );

        expect(result.status).toBe('pending_upload');
        expect(result.storagePath).toBe(null);
        expect(result.downloadUrl).toBe(null);

        // Verify setDoc was called
        expect(setDoc).toHaveBeenCalled();
        const [_, docData] = vi.mocked(setDoc).mock.calls[0];

        // Verify no undefined-valued keys in the document
        if (typeof docData === 'object' && docData !== null) {
            Object.values(docData).forEach(val => {
                expect(val).not.toBe(undefined);
            });
        }
    });

    it('createClearanceRequirement includes provenance fields when provided', async () => {
        vi.mocked(setDoc).mockResolvedValue(undefined);

        await syncLicensingClearanceService.createClearanceRequirement(
            'user-123',
            'brief-abc',
            'track-xyz',
            'Track Title',
            'sync_license',
            'Description',
            undefined,
            undefined,
            { briefId: 'brief-abc', briefProject: 'Project Alpha', trackISRC: 'US-AAA-26-00001' }
        );

        expect(setDoc).toHaveBeenCalled();
        const [_, docData] = vi.mocked(setDoc).mock.calls[0];

        if (typeof docData === 'object' && docData !== null) {
            expect((docData as Record<string, any>).briefId).toBe('brief-abc');
            expect((docData as Record<string, any>).briefProject).toBe('Project Alpha');
            expect((docData as Record<string, any>).trackISRC).toBe('US-AAA-26-00001');
        }
    });

    it('uploadClearanceFile uses the users/{userId}/clearance/ storage path and merge-updates status', async () => {
        const mockDoc = {
            userId: 'user-123',
            releaseId: 'release-456',
            trackId: 'track-789',
            status: 'pending_upload',
        };

        vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => mockDoc } as any);
        // The global setup.ts mock leaves ref() returning undefined by default
        // (shared across many files) — stub it locally to mimic the real SDK's
        // StorageReference.toString(), so the path assertion below is meaningful.
        vi.mocked(ref).mockImplementation((_storage, path) => ({ toString: () => `gs://mock-bucket/${path}` } as any));
        vi.mocked(uploadBytes).mockResolvedValue({} as any);
        vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/file.pdf');
        vi.mocked(setDoc).mockResolvedValue(undefined);

        const file = new File(['content'], 'clearance.pdf', { type: 'application/pdf' });
        await syncLicensingClearanceService.uploadClearanceFile('clearance-id-123', file);

        // Verify storage path uses users/{userId}/clearance/...
        const uploadCall = vi.mocked(uploadBytes).mock.calls[0];
        const storageRef = uploadCall[0];
        expect(storageRef.toString()).toContain('users/user-123/clearance/release-456');

        // Verify merge-update with status: uploaded
        const setDocCall = vi.mocked(setDoc).mock.calls[0];
        const updateData = setDocCall[1];
        if (typeof updateData === 'object' && updateData !== null) {
            expect((updateData as Record<string, any>).status).toBe('uploaded');
        }
    });

    it('checkTrackClearance returns isCleared: false when no docs exist', async () => {
        vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

        const result = await syncLicensingClearanceService.checkTrackClearance('release-456', 'track-789');

        expect(result.isCleared).toBe(false);
        expect(result.pendingDocs).toHaveLength(0);
        expect(result.approvedDocs).toHaveLength(0);
    });

    it('checkTrackClearance returns isCleared: false when only uploaded docs exist', async () => {
        const uploadedDoc = {
            status: 'uploaded',
            trackTitle: 'Track Title',
            trackId: 'track-789',
        };

        vi.mocked(getDocs).mockResolvedValue({
            docs: [{ data: () => uploadedDoc }],
        } as any);

        const result = await syncLicensingClearanceService.checkTrackClearance('release-456', 'track-789');

        expect(result.isCleared).toBe(false);
        expect(result.pendingDocs).toHaveLength(1);
    });

    it('checkTrackClearance returns isCleared: true when approved docs exist and no pending/rejected', async () => {
        const approvedDoc = {
            status: 'approved',
            trackTitle: 'Track Title',
            trackId: 'track-789',
            id: 'doc-1',
        };

        vi.mocked(getDocs).mockResolvedValue({
            docs: [{ data: () => approvedDoc }],
        } as any);

        const result = await syncLicensingClearanceService.checkTrackClearance('release-456', 'track-789');

        expect(result.isCleared).toBe(true);
        expect(result.approvedDocs).toHaveLength(1);
        expect(result.pendingDocs).toHaveLength(0);
    });

    it('checkTrackClearance returns isCleared: false when approved and rejected docs both exist', async () => {
        const approvedDoc = { status: 'approved', trackId: 'track-789', id: 'doc-1' };
        const rejectedDoc = { status: 'rejected', trackId: 'track-789', id: 'doc-2' };

        vi.mocked(getDocs).mockResolvedValue({
            docs: [{ data: () => approvedDoc }, { data: () => rejectedDoc }],
        } as any);

        const result = await syncLicensingClearanceService.checkTrackClearance('release-456', 'track-789');

        expect(result.isCleared).toBe(false);
        expect(result.approvedDocs).toHaveLength(1);
        expect(result.rejectedDocs).toHaveLength(1);
    });

    it('reviewClearance updates status and review fields', async () => {
        vi.mocked(setDoc).mockResolvedValue(undefined);

        await syncLicensingClearanceService.reviewClearance('clearance-id-123', 'approved', 'Looks good');

        expect(setDoc).toHaveBeenCalled();
        const [_, updateData, options] = vi.mocked(setDoc).mock.calls[0];

        if (typeof updateData === 'object' && updateData !== null) {
            expect((updateData as Record<string, any>).status).toBe('approved');
            expect((updateData as Record<string, any>).reviewNotes).toBe('Looks good');
        }
        expect(options).toEqual({ merge: true });
    });
});
