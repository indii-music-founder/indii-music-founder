import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin');

import { queueRemotionRender } from '../queueRemotionRender.js';
import { McpContext } from '../../types.js';
import * as admin from 'firebase-admin';

const addMock = vi.fn();
const releaseGetMock = vi.fn();
const topLevelGetMock = vi.fn();

// Structural firestore mock covering users/{uid}/releases/{id}, releases/{id}, mcpRenderJobs.
const firestoreFn = vi.fn(() => ({
    collection: (name: string) => {
        if (name === 'users') {
            return {
                doc: () => ({
                    collection: () => ({ doc: () => ({ get: releaseGetMock }) }),
                }),
            };
        }
        if (name === 'releases') {
            return { doc: () => ({ get: topLevelGetMock }) };
        }
        if (name === 'mcpRenderJobs') {
            return { add: addMock };
        }
        throw new Error(`unexpected collection ${name}`);
    },
})) as any;

firestoreFn.FieldValue = {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
};

vi.mocked(admin.firestore).mockImplementation(firestoreFn);
vi.mocked(admin.firestore).FieldValue = firestoreFn.FieldValue;

const context = (uid: string): McpContext => ({ user: { uid } } as McpContext);

describe('queueRemotionRender MCP tool', () => {
    beforeEach(() => {
        addMock.mockReset().mockResolvedValue({ id: 'job-123' });
        releaseGetMock.mockReset();
        topLevelGetMock.mockReset();
    });

    it('writes a whitelisted mcpRenderJobs doc, dropping unknown animationSpec keys, with honest no-processor warning', async () => {
        releaseGetMock.mockResolvedValueOnce({ exists: true, data: () => ({}) });

        const result = await queueRemotionRender.handler({
            releaseId: 'rel-1',
            canvasType: 'Spotify',
            animationSpec: {
                template: 'waveform',
                durationSeconds: 30,
                colorPalette: ['#000', '#fff'],
                textOverlay: 'New single',
                __proto__pollution: 'evil',
                callbackUrl: 'https://attacker.example',
                userId: 'someone-else',
            },
        }, context('user-1'));

        const payload = JSON.parse(result.content[0].text);
        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.resource.type).toBe('render_intent');
        expect(payload.data).toEqual({ jobId: 'job-123', canvasType: 'Spotify' });
        expect(payload.warnings.join(' ')).toMatch(/NO rendering backend .*no video will be produced/);

        expect(addMock).toHaveBeenCalledTimes(1);
        const written = addMock.mock.calls[0][0];
        expect(written).toEqual({
            releaseId: 'rel-1',
            canvasType: 'Spotify',
            animationSpec: {
                template: 'waveform',
                durationSeconds: 30,
                colorPalette: ['#000', '#fff'],
                textOverlay: 'New single',
            },
            initiatorUid: 'user-1',
            status: 'queued_no_processor',
            createdAt: 'SERVER_TIMESTAMP',
        });
        expect(written.animationSpec).not.toHaveProperty('callbackUrl');
        expect(written.animationSpec).not.toHaveProperty('userId');
    });

    it('rejects a cross-tenant release without writing anything', async () => {
        releaseGetMock.mockResolvedValueOnce({ exists: false, data: () => undefined });
        topLevelGetMock.mockResolvedValueOnce({ exists: true, data: () => ({ userId: 'other-user' }) });

        const result = await queueRemotionRender.handler(
            { releaseId: 'rel-not-mine', canvasType: 'TikTok' },
            context('user-1'),
        );

        const payload = JSON.parse(result.content[0].text);
        expect(result.isError).toBe(true);
        expect(payload.status).toBe('failed');
        expect(payload.error.code).toBe('FORBIDDEN');
        expect(payload.error.message).toContain('Forbidden');
        expect(addMock).not.toHaveBeenCalled();
    });

    it('rejects invalid canvasType and out-of-range durationSeconds is dropped', async () => {
        const bad = await queueRemotionRender.handler(
            { releaseId: 'rel-1', canvasType: 'YouTube' },
            context('user-1'),
        );
        expect(bad.isError).toBe(true);
        expect(JSON.parse(bad.content[0].text).error.code).toBe('INVALID_ARGUMENT');
        expect(addMock).not.toHaveBeenCalled();

        releaseGetMock.mockResolvedValueOnce({ exists: true, data: () => ({}) });
        const ok = await queueRemotionRender.handler(
            { releaseId: 'rel-1', canvasType: 'Instagram', animationSpec: { durationSeconds: 9999, template: 42 } },
            context('user-1'),
        );
        expect(ok.isError).toBeUndefined();
        expect(addMock.mock.calls[0][0].animationSpec).toEqual({});
    });
});
