import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { DerivativeAssetReceipt, SocialHandoffDraft, SocialHandoffDraftSchema } from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const CreateSocialHandoffDraftRequestSchema = z.object({
    derivativeId: z.string().trim().min(1).max(256),
    targetPlatforms: z.array(z.enum(['tiktok', 'instagram', 'youtube', 'x'])).min(1),
    captionText: z.string().max(2200).default(''),
    suggestedHashtags: z.array(z.string().trim()).max(30).default([]),
}).strict();

export function createCreateSocialHandoffDraftHandler(
    db: FirebaseFirestore.Firestore = getFirestore(),
) {
    return async (rawInput: unknown, authUid: string) => {
        const parseResult = CreateSocialHandoffDraftRequestSchema.safeParse(rawInput);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', 'The social handoff draft request is malformed.');
        }

        const { derivativeId, targetPlatforms, captionText, suggestedHashtags } = parseResult.data;

        // Verify derivative asset exists and belongs to authUid
        const derivativeRef = db.collection('derivatives').doc(derivativeId);
        const derivativeSnap = await derivativeRef.get();
        if (!derivativeSnap.exists) {
            throw new HttpsError('not-found', 'The specified derivative asset receipt does not exist.');
        }

        const derivative = derivativeSnap.data() as DerivativeAssetReceipt;
        if (derivative.ownerUid !== authUid) {
            throw new HttpsError('permission-denied', 'Cross-owner derivative asset access is prohibited.');
        }

        if (!derivative.isTerminalPlayable) {
            throw new HttpsError('failed-precondition', 'Only completed, playable terminal derivatives may enter Social/Campaign handoff.');
        }

        const draftId = `draft-${createHash('sha256').update(`${derivativeId}:${[...targetPlatforms].sort().join(',')}`).digest('hex').slice(0, 24)}`;
        const draftRef = db.collection('socialDrafts').doc(draftId);
        const existingSnap = await draftRef.get();

        if (existingSnap.exists) {
            const existing = existingSnap.data() as SocialHandoffDraft;
            return { draft: existing, reused: true };
        }

        const now = new Date().toISOString();
        const newDraft: SocialHandoffDraft = {
            schemaVersion: 'social-handoff-draft.v1',
            draftId,
            derivativeId,
            ownerUid: authUid,
            organizationId: derivative.organizationId,
            projectId: derivative.projectId,
            targetPlatforms,
            captionText,
            suggestedHashtags,
            isPublished: false,
            createdAt: now,
        };

        const validated = SocialHandoffDraftSchema.parse(newDraft);
        await draftRef.set(validated);

        return { draft: validated, reused: false };
    };
}

export const createSocialHandoffDraft = onCall(async (request) => {
    validateAppCheckV2(request);
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const handler = createCreateSocialHandoffDraftHandler();
    return await handler(request.data, request.auth.uid);
});
