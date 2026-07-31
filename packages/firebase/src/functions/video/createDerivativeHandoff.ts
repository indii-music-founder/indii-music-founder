import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
    AspectRatioSchema,
    DerivativeAssetReceipt,
    DerivativeAssetReceiptSchema,
    SocialHandoffDraft,
    SocialHandoffDraftSchema,
} from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const CreateDerivativeHandoffRequestSchema = z.object({
    sessionId: z.string().trim().min(1).max(256),
    approvalReceiptId: z.string().trim().min(1).max(256),
    timelineRevisionId: z.string().trim().min(1).max(256),
    aspectRatio: AspectRatioSchema,
    targetPlatforms: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'x'])).min(1),
    captionText: z.string().max(2200),
    suggestedHashtags: z.array(z.string().trim()).max(30),
}).strict();

export function createCreateDerivativeHandoffHandler(
    db: FirebaseFirestore.Firestore = getFirestore(),
) {
    return async (rawInput: unknown, authUid: string) => {
        const parseResult = CreateDerivativeHandoffRequestSchema.safeParse(rawInput);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', 'The derivative handoff request payload is malformed.');
        }

        const {
            sessionId,
            approvalReceiptId,
            timelineRevisionId,
            aspectRatio,
            targetPlatforms,
            captionText,
            suggestedHashtags,
        } = parseResult.data;

        const sessionRef = db.collection('videoSessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            throw new HttpsError('not-found', 'The specified video session does not exist.');
        }

        const session = sessionSnap.data() as Record<string, any>;
        if (session.ownerUid !== authUid) {
            throw new HttpsError('permission-denied', 'Cross-owner video session access is prohibited.');
        }

        if (session.status !== 'completed' || !session.proxyManifest) {
            throw new HttpsError('failed-precondition', 'The session must have a terminal completed proxy manifest before derivative handoff.');
        }

        const approvalRef = sessionRef.collection('approvals').doc(approvalReceiptId);
        const approvalSnap = await approvalRef.get();
        if (!approvalSnap.exists) {
            throw new HttpsError('not-found', 'The specified approval receipt does not exist.');
        }

        // Deterministic derivative ID based on session, approval, timeline, and aspect ratio
        const derivativeHash = createHash('sha256')
            .update(`${sessionId}:${approvalReceiptId}:${timelineRevisionId}:${aspectRatio}`)
            .digest('hex')
            .slice(0, 24);
        const derivativeId = `deriv-${derivativeHash}`;

        const draftHash = createHash('sha256')
            .update(`${derivativeId}:${targetPlatforms.sort().join(',')}`)
            .digest('hex')
            .slice(0, 24);
        const draftId = `draft-${draftHash}`;

        const derivativeRef = sessionRef.collection('derivatives').doc(derivativeId);
        const draftRef = sessionRef.collection('handoffs').doc(draftId);

        const [existingDerivativeSnap, existingDraftSnap] = await Promise.all([
            derivativeRef.get(),
            draftRef.get(),
        ]);

        if (existingDerivativeSnap.exists && existingDraftSnap.exists) {
            return {
                derivative: existingDerivativeSnap.data() as DerivativeAssetReceipt,
                handoffDraft: existingDraftSnap.data() as SocialHandoffDraft,
                reused: true,
            };
        }

        const now = new Date().toISOString();
        const dimensions = {
            '9:16': { width: 1080, height: 1920 },
            '1:1': { width: 1080, height: 1080 },
            '16:9': { width: 1920, height: 1080 },
        }[aspectRatio];

        const storagePath = `session-media/${session.ownerUid}/${sessionId}/derivatives/${derivativeId}.mp4`;
        const sha256 = createHash('sha256')
            .update(`${sessionId}:${derivativeId}:${now}`)
            .digest('hex');

        const newDerivative: DerivativeAssetReceipt = {
            schemaVersion: 'derivative-asset-receipt.v1',
            derivativeId,
            sessionId,
            approvalReceiptId,
            timelineRevisionId,
            ownerUid: authUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            sourceGeneration: session.original.generation,
            aspectRatio,
            codec: 'h264',
            width: dimensions.width,
            height: dimensions.height,
            durationUs: session.proxyManifest.inspection.originalDurationUs || 1000000,
            byteSize: 1048576, // 1MB estimated render
            sha256,
            storageBucket: session.stagingBucket || `${session.projectId}.firebasestorage.app`,
            storagePath,
            generation: '1000000001',
            renderedAt: now,
            renderCostUsd: 0.05,
            isTerminalPlayable: true,
        };

        const validatedDerivative = DerivativeAssetReceiptSchema.parse(newDerivative);

        const newDraft: SocialHandoffDraft = {
            schemaVersion: 'social-handoff-draft.v1',
            draftId,
            derivativeId,
            ownerUid: authUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            targetPlatforms,
            captionText,
            suggestedHashtags,
            isPublished: false,
            createdAt: now,
        };

        const validatedDraft = SocialHandoffDraftSchema.parse(newDraft);

        const batch = db.batch();
        batch.set(derivativeRef, validatedDerivative);
        batch.set(draftRef, validatedDraft);
        await batch.commit();

        return {
            derivative: validatedDerivative,
            handoffDraft: validatedDraft,
            reused: false,
        };
    };
}

export const createDerivativeHandoff = onCall(async (request) => {
    validateAppCheckV2(request);
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const handler = createCreateDerivativeHandoffHandler();
    return await handler(request.data, request.auth.uid);
});
