import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { GenerateOmniRemixSchema } from '@shared';
import { auth, functions } from '@/services/firebase';
import { CostControlService } from '@/services/billing/CostControlService';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

const OmniRemixResponseSchema = z.object({
    jobId: z.string().min(1),
    resultUri: z.string().min(1),
});

export interface VideoRemixResult {
    id: string;
    url: string;
    prompt: string;
}

/** Edit a persisted video through the secured Gemini Omni video gateway. */
export async function remixVideo(source: string, prompt: string): Promise<VideoRemixResult> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in before editing video.');
    if (!source) throw new Error('A source video is required.');
    if (!prompt.trim()) throw new Error('An edit prompt is required.');

    const durationSeconds = 8;
    const estimatedCost = Math.round(durationSeconds * 0.1 * 100) / 100;
    const referenceVideoUri = await CreativeStorageService.uploadReferenceMedia(userId, source, 'video');
    const reservation = await CostControlService.checkAndReserve({
        operationType: 'video',
        estimatedCost,
        userId,
        metadata: { durationSeconds, model: 'gemini-omni-flash-preview', task: 'edit' },
    });
    if (!reservation.allowed || !reservation.operationId) {
        throw new Error(`Video edit blocked: ${reservation.reason || 'Cost reservation failed.'}`);
    }

    const basePayload = GenerateOmniRemixSchema.parse({
        prompt: prompt.trim(),
        task: 'edit',
        referenceVideoUri,
        aspectRatio: '16:9',
        durationSeconds,
    });
    const response = await httpsCallable(functions, 'generateOmniRemixV3')({
        ...basePayload,
        costEstimate: estimatedCost,
        costReservationId: reservation.operationId,
    });
    const result = OmniRemixResponseSchema.parse(response.data);
    return {
        id: result.jobId,
        url: await resolveStorageUrl(result.resultUri),
        prompt: prompt.trim(),
    };
}
