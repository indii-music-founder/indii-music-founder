import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin');

import * as admin from 'firebase-admin';
import { queueVideoRender } from '../queueVideoRender.js';
import type { McpContext } from '../../types.js';
import { textContent } from './mcpContent';

const projectGetMock = vi.fn();
const dispatchAddMock = vi.fn();

const firestoreFn = vi.fn(() => ({
    collection: (name: string) => {
        if (name !== 'users') throw new Error(`unexpected collection ${name}`);
        return {
            doc: () => ({
                collection: (child: string) => {
                    if (child === 'videoProjects') {
                        return { doc: () => ({ get: projectGetMock }) };
                    }
                    if (child === 'agent_dispatch_queue') {
                        return { add: dispatchAddMock };
                    }
                    throw new Error(`unexpected child collection ${child}`);
                },
            }),
        };
    },
})) as any;

firestoreFn.FieldValue = {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
};

vi.mocked(admin.firestore).mockImplementation(firestoreFn);
vi.mocked(admin.firestore).FieldValue = firestoreFn.FieldValue;

const context = (uid: string): McpContext => ({ user: { uid } } as McpContext);

describe('queueVideoRender MCP tool', () => {
    beforeEach(() => {
        projectGetMock.mockReset();
        dispatchAddMock.mockReset().mockResolvedValue({ id: 'render-123' });
    });

    it('queues an owned persisted project for the desktop renderer', async () => {
        projectGetMock.mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'user-1', project: { id: 'project-1', clips: [{}], tracks: [] } }),
        });

        const result = await queueVideoRender.handler({
            projectId: 'project-1',
            outputName: 'My Final / No.mp4'.replace(' / ', ' '),
            callbackUrl: 'https://attacker.example',
            engine: 'remotion',
        }, context('user-1'));

        const payload = JSON.parse(textContent(result));
        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('queued');
        expect(payload.data).toEqual({
            renderId: 'render-123',
            projectId: 'project-1',
            status: 'queued',
            progress: 0,
        });
        expect(dispatchAddMock).toHaveBeenCalledWith({
            type: 'video_render',
            payload: { projectId: 'project-1', outputName: 'My_Final_No.mp4' },
            status: 'pending',
            createdAt: 'SERVER_TIMESTAMP',
        });
    });

    it('fails closed for a missing or cross-tenant project', async () => {
        projectGetMock.mockResolvedValue({
            exists: true,
            data: () => ({ userId: 'other-user', project: { id: 'project-1' } }),
        });

        const result = await queueVideoRender.handler({ projectId: 'project-1' }, context('user-1'));
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('FORBIDDEN');
        expect(dispatchAddMock).not.toHaveBeenCalled();
    });

    it('rejects path-like project IDs and output names', async () => {
        const badProject = await queueVideoRender.handler({ projectId: '../other' }, context('user-1'));
        expect(JSON.parse(textContent(badProject)).error.code).toBe('INVALID_ARGUMENT');

        const badOutput = await queueVideoRender.handler(
            { projectId: 'project-1', outputName: '../outside.mp4' },
            context('user-1'),
        );
        expect(JSON.parse(textContent(badOutput)).error.code).toBe('INVALID_ARGUMENT');
        expect(dispatchAddMock).not.toHaveBeenCalled();
    });
});
