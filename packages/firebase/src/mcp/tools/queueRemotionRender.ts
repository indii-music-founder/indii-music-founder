import * as admin from 'firebase-admin';

import { failedOperationResult, operationResult, requireString, toolResponse, verifyReleaseOwnership, OwnershipFirestore } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

const CANVAS_TYPES = ['Spotify', 'TikTok', 'Instagram'] as const;
type CanvasType = (typeof CANVAS_TYPES)[number];

/** Whitelisted, type-checked animation spec — never the raw model-supplied object. */
interface SanitizedAnimationSpec {
    template?: string;
    durationSeconds?: number;
    colorPalette?: string[];
    textOverlay?: string;
}

function requireCanvasType(args: Record<string, unknown>): CanvasType {
    const value = args.canvasType;
    if (typeof value !== 'string' || !(CANVAS_TYPES as readonly string[]).includes(value)) {
        throw new TypeError(`canvasType must be one of: ${CANVAS_TYPES.join(', ')}.`);
    }
    return value as CanvasType;
}

/**
 * Whitelists ONLY known animationSpec keys with strict type checks.
 * Unknown keys and invalid-typed values are dropped, never persisted.
 */
function sanitizeAnimationSpec(raw: unknown): SanitizedAnimationSpec {
    if (raw === undefined || raw === null) return {};
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError('animationSpec must be an object when provided.');
    }
    const spec = raw as Record<string, unknown>;
    const out: SanitizedAnimationSpec = {};
    if (typeof spec.template === 'string' && spec.template.trim() && spec.template.length <= 500) {
        out.template = spec.template.trim();
    }
    if (typeof spec.durationSeconds === 'number' && Number.isFinite(spec.durationSeconds) && spec.durationSeconds >= 1 && spec.durationSeconds <= 600) {
        out.durationSeconds = spec.durationSeconds;
    }
    if (Array.isArray(spec.colorPalette)) {
        const palette = spec.colorPalette.filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length <= 64).slice(0, 10);
        if (palette.length > 0) out.colorPalette = palette;
    }
    if (typeof spec.textOverlay === 'string' && spec.textOverlay.trim() && spec.textOverlay.length <= 500) {
        out.textOverlay = spec.textOverlay.trim();
    }
    return out;
}

const NO_PROCESSOR_WARNING = 'Render intent recorded durably in mcpRenderJobs, but NO rendering backend (Remotion/Inngest) consumes this queue yet — no video will be produced until that backend ships.';

export const queueRemotionRender: IndiiMcpTool = {
    name: 'queue_remotion_render',
    description: 'Records a durable video render intent (mcpRenderJobs) for an owned release. No rendering backend consumes this queue yet.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string', description: 'Release owned by the authenticated caller.' },
            canvasType: { type: 'string', enum: [...CANVAS_TYPES] },
            animationSpec: {
                type: 'object',
                description: 'Optional. Only template, durationSeconds (1-600), colorPalette (<=10 strings), textOverlay are honored; other keys are dropped.',
            },
        },
        required: ['releaseId', 'canvasType'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let releaseId = 'unknown';
        try {
            releaseId = requireString(args, 'releaseId', 200);
            const canvasType = requireCanvasType(args);
            const animationSpec = sanitizeAnimationSpec(args.animationSpec);

            const db = admin.firestore();
            await verifyReleaseOwnership(db as unknown as OwnershipFirestore, actorUid, releaseId);

            // Whitelisted fields only — never persist the raw args object.
            const docRef = await db.collection('mcpRenderJobs').add({
                releaseId,
                canvasType,
                animationSpec,
                initiatorUid: actorUid,
                status: 'queued_no_processor',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return toolResponse(operationResult({
                tool: 'queue_remotion_render',
                actorUid,
                status: 'succeeded',
                resourceType: 'render_intent',
                resourceId: docRef.id,
                warnings: [NO_PROCESSOR_WARNING],
                data: { jobId: docRef.id, canvasType },
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: 'queue_remotion_render',
                actorUid,
                resourceType: 'render_intent',
                resourceId: releaseId,
                code: error instanceof TypeError
                    ? 'INVALID_ARGUMENT'
                    : error instanceof Error && error.message.startsWith('Forbidden')
                        ? 'FORBIDDEN'
                        : 'RENDER_INTENT_FAILED',
                message: error instanceof Error ? error.message : 'Failed to record render intent.',
                retryable: false,
            }));
        }
    },
};
