import * as admin from 'firebase-admin';

import { failedOperationResult, operationResult, requireString, toolResponse } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

const safeOutputName = (args: Record<string, unknown>): string | undefined => {
    if (args.outputName === undefined) return undefined;
    const value = requireString(args, 'outputName', 180);
    if (value.includes('/') || value.includes('\\')) {
        throw new TypeError('outputName must be a filename, not a path.');
    }
    const sanitized = value.replace(/[^a-z0-9._-]/gi, '_');
    return sanitized.toLowerCase().endsWith('.mp4') ? sanitized : `${sanitized}.mp4`;
};
/**
 * Queue the canonical persisted video project for execution by the signed-in
 * desktop Studio. The desktop applies RenderPlanner and the shared renderer
 * contract, so MCP callers cannot select or smuggle an engine implementation.
 */
export const queueVideoRender: IndiiMcpTool = {
    name: 'queue_video_render',
    description: 'Queues an owned persisted video-editor project for the signed-in desktop Studio. The indii planner selects FFmpeg for direct media or HyperFrames for composed timelines; the completed artifact becomes the editor preview.',
    inputSchema: {
        type: 'object',
        properties: {
            projectId: { type: 'string', description: 'Owned persisted video project ID.' },
            outputName: { type: 'string', description: 'Optional safe MP4 filename in the desktop managed video folder.' },
        },
        required: ['projectId'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let projectId = 'unknown';
        try {
            projectId = requireString(args, 'projectId', 200);
            if (projectId.includes('/')) throw new TypeError('projectId must not contain "/".');
            const outputName = safeOutputName(args);
            const db = admin.firestore();
            const projectRef = db.collection('users').doc(actorUid).collection('videoProjects').doc(projectId);
            const projectSnapshot = await projectRef.get();
            const projectData = projectSnapshot.data();
            if (!projectSnapshot.exists || projectData?.userId !== actorUid || !projectData?.project) {
                throw new Error('Forbidden: video project not found or not owned by caller');
            }

            const dispatchRef = await db.collection('users').doc(actorUid).collection('agent_dispatch_queue').add({
                type: 'video_render',
                payload: {
                    projectId,
                    ...(outputName ? { outputName } : {}),
                },
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return toolResponse(operationResult({
                tool: 'queue_video_render',
                actorUid,
                status: 'queued',
                resourceType: 'video_render',
                resourceId: dispatchRef.id,
                warnings: ['The signed-in desktop Studio must be online to execute this local render. The queue remains durable while Studio is offline.'],
                data: { renderId: dispatchRef.id, projectId, status: 'queued', progress: 0 },
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: 'queue_video_render',
                actorUid,
                resourceType: 'video_render',
                resourceId: projectId,
                code: error instanceof TypeError
                    ? 'INVALID_ARGUMENT'
                    : error instanceof Error && error.message.startsWith('Forbidden')
                        ? 'FORBIDDEN'
                        : 'VIDEO_RENDER_QUEUE_FAILED',
                message: error instanceof Error ? error.message : 'Failed to queue the video render.',
                retryable: false,
            }));
        }
    },
};
