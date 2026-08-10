import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../middleware/appCheck', () => ({
    validateAppCheckV2: vi.fn(),
}));

vi.mock('firebase-admin', () => {
    const mockGet = vi.fn();
    const mockDoc = vi.fn();
    const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
    mockDoc.mockReturnValue({ get: mockGet, collection: mockCollection });
    return {
        default: {
            firestore: () => ({
                collection: mockCollection,
            }),
        },
        firestore: () => ({
            collection: mockCollection,
        }),
    };
});

import * as admin from 'firebase-admin';
import {
    sendInstagramMessageCallable,
    replyInstagramCommentCallable,
    getInstagramMediaCommentsCallable,
} from './instagramMessaging';

describe('instagramMessaging Cloud Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sendInstagramMessageCallable validates required fields', async () => {
        const req = {
            auth: { uid: 'user-1' },
            data: {},
        };
        // @ts-expect-error - testing callable request
        await expect(sendInstagramMessageCallable.run(req)).rejects.toThrow('recipientIgUserId and either messageText or mediaUrl are required.');
    });

    it('sendInstagramMessageCallable sends DM via Meta Graph API', async () => {
        const mockSnap = {
            exists: true,
            data: () => ({
                accessToken: 'test-ig-token',
                igUserId: '17841400000000001',
                expiresAt: Date.now() + 3600000,
            }),
        };

        const db = admin.firestore();
        vi.spyOn(db.collection('users').doc('user-1').collection('socialTokens').doc('instagram'), 'get')
            .mockResolvedValueOnce(mockSnap as unknown as FirebaseFirestore.DocumentSnapshot);

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message_id: 'mid.12345', recipient_id: '123456' }),
        } as Response);

        const req = {
            auth: { uid: 'user-1' },
            data: { recipientIgUserId: '123456', messageText: 'Hello from indii!' },
        };

        // @ts-expect-error - testing callable request
        const res = await sendInstagramMessageCallable.run(req);
        expect(res).toEqual({
            ok: true,
            messageId: 'mid.12345',
            recipientId: '123456',
            sentAt: expect.any(Number),
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('https://graph.facebook.com/v23.0/17841400000000001/messages'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    recipient: { id: '123456' },
                    message: { text: 'Hello from indii!' },
                }),
            }),
        );
    });

    it('replyInstagramCommentCallable replies to an Instagram comment', async () => {
        const mockSnap = {
            exists: true,
            data: () => ({
                accessToken: 'test-ig-token',
                igUserId: '17841400000000001',
                expiresAt: Date.now() + 3600000,
            }),
        };

        const db = admin.firestore();
        vi.spyOn(db.collection('users').doc('user-1').collection('socialTokens').doc('instagram'), 'get')
            .mockResolvedValueOnce(mockSnap as unknown as FirebaseFirestore.DocumentSnapshot);

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'reply-cmt-999' }),
        } as Response);

        const req = {
            auth: { uid: 'user-1' },
            data: { commentId: 'cmt-111', replyText: 'Thank you for supporting the release!' },
        };

        // @ts-expect-error - testing callable request
        const res = await replyInstagramCommentCallable.run(req);
        expect(res).toEqual({
            ok: true,
            replyCommentId: 'reply-cmt-999',
            repliedAt: expect.any(Number),
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://graph.facebook.com/v23.0/cmt-111/replies',
            expect.objectContaining({
                method: 'POST',
            }),
        );
    });

    it('getInstagramMediaCommentsCallable fetches post comments', async () => {
        const mockSnap = {
            exists: true,
            data: () => ({
                accessToken: 'test-ig-token',
                igUserId: '17841400000000001',
                expiresAt: Date.now() + 3600000,
            }),
        };

        const db = admin.firestore();
        vi.spyOn(db.collection('users').doc('user-1').collection('socialTokens').doc('instagram'), 'get')
            .mockResolvedValueOnce(mockSnap as unknown as FirebaseFirestore.DocumentSnapshot);

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: 'cmt-1',
                        text: 'Amazing track!',
                        timestamp: '2026-08-10T12:00:00Z',
                        username: 'music_fan_1',
                        from: { id: 'fan-1', username: 'music_fan_1' },
                        like_count: 5,
                    },
                ],
            }),
        } as Response);

        const req = {
            auth: { uid: 'user-1' },
            data: { mediaId: 'media-777' },
        };

        // @ts-expect-error - testing callable request
        const res = await getInstagramMediaCommentsCallable.run(req);
        expect(res).toEqual({
            ok: true,
            comments: [
                {
                    id: 'cmt-1',
                    text: 'Amazing track!',
                    timestamp: '2026-08-10T12:00:00Z',
                    username: 'music_fan_1',
                    fromId: 'fan-1',
                    likeCount: 5,
                },
            ],
        });
    });
});
