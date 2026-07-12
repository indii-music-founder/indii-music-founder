import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAddDoc, mockCurrentUser } = vi.hoisted(() => ({
    mockAddDoc: vi.fn(),
    mockCurrentUser: { value: { uid: 'test-user-123' } as { uid: string } | null },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    get auth() {
        return { currentUser: mockCurrentUser.value };
    },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, ...segments: string[]) => ({ path: segments.join('/') })),
    addDoc: mockAddDoc,
    doc: vi.fn((_db, _collection, id) => ({ id })),
    updateDoc: vi.fn(),
    getDocs: vi.fn(async () => ({ empty: true, forEach: () => {} })),
    query: vi.fn(),
    where: vi.fn(),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

import { PublishingTools } from './PublishingTools';

/**
 * ISSUE-812: register_work_with_pro previously fabricated a "Submitted"
 * status and a random `PRO-XXXXXXX` reference ID with zero real ASCAP/BMI/
 * SESAC integration. These prove it now stores a real draft and reports
 * requires_manual_submission instead of a fake confirmation.
 */
describe('PublishingTools.register_work_with_pro (ISSUE-812)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentUser.value = { uid: 'test-user-123' };
        mockAddDoc.mockResolvedValue({ id: 'draft-abc123' });
    });

    it('never claims Submitted or fabricates a PRO reference ID', async () => {
        const result = await PublishingTools.register_work_with_pro({
            workTitle: 'Test Song',
            writers: [{ name: 'Jane Writer', role: 'composer', split: 100 }],
            society: 'ASCAP',
        });

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('requires_manual_submission');
        expect(result.data).not.toHaveProperty('proReferenceId');
        expect(result.data.status).not.toBe('Submitted');
        expect(result.message).toMatch(/manual/i);
        expect(result.message).toMatch(/ascap\.com/i);
    });

    it('persists a real draft packet to Firestore instead of only returning fabricated data', async () => {
        await PublishingTools.register_work_with_pro({
            workTitle: 'Test Song',
            writers: [{ name: 'Jane Writer', role: 'composer', split: 100 }],
            society: 'BMI',
        });

        expect(mockAddDoc).toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('proSubmissionDrafts') }),
            expect.objectContaining({
                workTitle: 'Test Song',
                society: 'BMI',
                status: 'requires_manual_submission',
            })
        );
    });

    it('rejects unauthenticated callers rather than creating an anonymous draft', async () => {
        mockCurrentUser.value = null;

        const result = await PublishingTools.register_work_with_pro({
            workTitle: 'Test Song',
            writers: [{ name: 'Jane Writer', role: 'composer', split: 100 }],
            society: 'SESAC',
        });

        expect(result.success).toBe(false);
        expect(mockAddDoc).not.toHaveBeenCalled();
    });
});
