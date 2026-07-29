import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { FUNCTION_INTELLIGENCE_MODELS } from "../config/models";
import { requireVerifiedEmailV2, validateAppCheckV2 } from "../middleware/appCheck";

export const GenerateSpeechRequestSchema = z.object({
    text: z.string().min(1, "Text is required"),
    voice: z.string().optional().default("en-US-Journey-F"),
    model: z.string().optional().default(FUNCTION_INTELLIGENCE_MODELS.SPEECH.GENERATION),
});

export const AnalyzeAudioRequestSchema = z.object({
    storagePath: z.string().trim().regex(
        /^masters\/[A-Za-z0-9_-]{1,128}\/[a-f0-9]{64}\/original\.(wav|flac)$/,
        'storagePath must be a canonical WAV or FLAC master path.'
    ),
}).strict();

const CANONICAL_MASTER_PATH = /^masters\/([A-Za-z0-9_-]{1,128})\/([a-f0-9]{64})\/original\.(wav|flac)$/;

export function resolveOwnedCanonicalMasterPath(
    ownerUid: string,
    storagePath: string,
): { storagePath: string; contentHash: string; mimeType: 'audio/wav' | 'audio/flac' } {
    const match = storagePath.match(CANONICAL_MASTER_PATH);
    if (!match) {
        throw new Error('storagePath must be a canonical WAV or FLAC master path.');
    }
    const [, pathOwnerUid, contentHash, extension] = match;
    if (pathOwnerUid !== ownerUid) {
        throw new Error('Canonical master path does not belong to the authenticated owner.');
    }
    return {
        storagePath,
        contentHash,
        mimeType: extension === 'flac' ? 'audio/flac' : 'audio/wav',
    };
}

/**
 * Analyze Audio Ear (indii_audio_ear)
 * 
 * Retired synchronous audio analysis boundary.
 *
 * Canonical masters are analyzed exactly once by engine-dsp and surfaced via a
 * generation-bound receipt. This callable intentionally fails closed instead
 * of accepting a public URL, an arbitrary GCS bucket, or raw audio bytes that
 * could create SSRF, duplicate model charges, and untraceable provenance.
 */
export const analyzeAudioFn = () => onCall(
    {
        region: "us-central1",
        enforceAppCheck: false,
        timeoutSeconds: 120,
        memory: "512MiB",
        cpu: 'gcf_gen1',
        concurrency: 1,
    },
    async (request) => {
        validateAppCheckV2(request);
        const userId = requireVerifiedEmailV2(request);

        // 2. Validation
        const validation = AnalyzeAudioRequestSchema.safeParse(request.data);
        if (!validation.success) {
            throw new HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }
        resolveOwnedCanonicalMasterPath(userId, validation.data.storagePath);
        throw new HttpsError(
            'failed-precondition',
            'Direct audio analysis is retired. Wait for the verified canonical-master analysis receipt.'
        );
    },
);
