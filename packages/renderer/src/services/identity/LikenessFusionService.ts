/**
 * LikenessFusionService.ts
 *
 * Best-of-N guided identity-fusion loop (Workstream A1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §6). No GAN swap — pure client
 * orchestration over the backend generation/edit services.
 *
 * The face analysis backend is INJECTED so the loop, thresholds, and
 * best-of-N retry are fully testable (A1.3) without the (not-installed)
 * identity model. Production default uses the real FacePipeline backend, which
 * throws an honest "not configured" error until A1.1/A1.6 are resolved.
 */

import { APPROVED_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';
import {
    analyzeFace as defaultAnalyzeFace,
    cosineSimilarity,
    geometryFitSimilarity,
    type FaceAnalysisFn
} from '@/services/identity/FacePipeline';
import { Editing } from '@/services/image/EditingService';
import { LikenessService, type LikenessImage } from '@/services/image/LikenessService';

/** Matches the plan §6 A1.5 calibration target. Mock tests cannot set this. */
export const IDENTITY_SIMILARITY_THRESHOLD = 0.55;

/** Locked identity prompt suffix — reference 1 = identity, reference 2 = pose/scene. */
export const LIKENESS_IDENTITY_PROMPT_SUFFIX =
    'Preserve the facial structure, skin texture, and distinctive features of the person in reference 1 exactly. The person in reference 2 supplies the pose, wardrobe, and scene only. Do not blend, morph, or alter the face identity.';

export interface FusionRequest {
    targetDataUrl: string;
    headshotId?: string;
    maxAttempts?: number;
    preservePromptNote?: string;
}

export interface FusionAttempt {
    dataUrl: string;
    similarity: number;
}

export interface FusionResult {
    dataUrl: string;
    similarity: number;
    passedThreshold: boolean;
    attempts: FusionAttempt[];
    /** 'identity' (biometric) or 'geometry' (founder-approved degraded v1, A1.6). */
    embeddingMode: 'identity' | 'geometry';
}

export interface AnalyzeDeps {
    analyzeFace: FaceAnalysisFn;
    resolveHeadshot: () => Promise<LikenessImage>;
    similarity: (a: number[], b: number[]) => number;
    geometrySimilarity: (a: Array<[number, number]>, b: Array<[number, number]>) => number;
    edit: (args: {
        image: { mimeType: string; data: string };
        prompt: string;
        model: string;
        sourceImages: Array<{ mimeType: string; data: string }>;
    }) => Promise<{ id: string; url: string } | null>;
    threshold: number;
}

function parseDataUri(dataUri: string): { mimeType: string; data: string } | null {
    const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUri);
    if (!m || !m[1] || !m[2]) return null;
    return { mimeType: m[1]!, data: m[2]! };
}

/** Default headshot resolver mirrors DEC-2: only My Likeness sources, never arbitrary gallery images. */
async function defaultResolveHeadshot(headshotId?: string): Promise<LikenessImage> {
    const all = await LikenessService.getAll();
    if (!all || all.length === 0) {
        throw new Error('No verified likeness found. Add a selfie in My Likeness before fusing (DEC-2).');
    }
    if (headshotId) {
        const match = all.find(l => l.id === headshotId);
        if (!match) throw new Error(`Likeness "${headshotId}" not found.`);
        return match;
    }
    // Newest good-quality selfie.
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
    return sorted[0]!;
}

class LikenessFusionServiceImpl {
    private makeDeps(req: FusionRequest, injected?: Partial<AnalyzeDeps>): AnalyzeDeps {
        const threshold = injected?.threshold ?? IDENTITY_SIMILARITY_THRESHOLD;
        return {
            analyzeFace: injected?.analyzeFace ?? defaultAnalyzeFace,
            similarity: injected?.similarity ?? cosineSimilarity,
            geometrySimilarity: injected?.geometrySimilarity ?? geometryFitSimilarity,
            resolveHeadshot: injected?.resolveHeadshot ?? (() => defaultResolveHeadshot(req.headshotId)),
            threshold,
            edit: injected?.edit ?? (async (args) => Editing.editImage(args))
        };
    }

    async fuseLikeness(req: FusionRequest, injected?: Partial<AnalyzeDeps>): Promise<FusionResult> {
        if (!req.targetDataUrl) throw new Error('fuseLikeness: targetDataUrl is required');
        const maxAttempts = Math.max(1, req.maxAttempts ?? 3);

        const deps = this.makeDeps(req, injected);
        const headshot = await deps.resolveHeadshot();
        const headshotUri = headshot.url;

        // Analyze the headshot: require >= 1 face.
        const headshotAnalysis = await deps.analyzeFace(headshotUri);
        const referenceEmbedding = headshotAnalysis.primaryEmbedding;
        const referenceLandmarks = headshotAnalysis.landmarks;
        if ((!referenceEmbedding || referenceEmbedding.length === 0) && (!referenceLandmarks || referenceLandmarks.length === 0)) {
            throw new Error('Headshot could not be read as a face. Use a clear, front-facing selfie in My Likeness.');
        }
        const embeddingMode = headshotAnalysis.embeddingMode ?? (referenceEmbedding ? 'identity' : 'geometry');

        const targetParts = parseDataUri(req.targetDataUrl);
        if (!targetParts) throw new Error('targetDataUrl must be a base64 image data URI.');

        const attempts: FusionAttempt[] = [];
        let best = { dataUrl: req.targetDataUrl, similarity: -Infinity };
        let bestPassed = false;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const basePrompt = `Replace the face in the target with the identity from reference 1. ${LIKENESS_IDENTITY_PROMPT_SUFFIX}`;
            const prompt = attempt === 1
                ? basePrompt
                : `${basePrompt} (attempt ${attempt}: strengthen the match to the reference identity; reduce any drift in facial features, skin tone, and structure.)`;
            const withNote = req.preservePromptNote ? `${prompt}\nNote: ${req.preservePromptNote}` : prompt;

            const result = await deps.edit({
                image: { mimeType: targetParts.mimeType, data: targetParts.data },
                prompt: withNote,
                model: APPROVED_MODELS.IMAGE_GEN,
                sourceImages: [{ mimeType: headshotUri.startsWith('data:') ? headshotUri.slice(5).split(';')[0]! : 'image/jpeg', data: headshotUri.split(',')[1] ?? '' }]
            });

            if (!result?.url) {
                throw new Error(`Fusion attempt ${attempt} returned no result.`);
            }

            const resultAnalysis = await deps.analyzeFace(result.url);
            let similarity: number;
            if (embeddingMode === 'identity' && referenceEmbedding && resultAnalysis.primaryEmbedding) {
                similarity = deps.similarity(referenceEmbedding, resultAnalysis.primaryEmbedding);
            } else if (referenceLandmarks && resultAnalysis.landmarks && resultAnalysis.landmarks.length > 0) {
                similarity = deps.geometrySimilarity(referenceLandmarks, resultAnalysis.landmarks);
            } else {
                throw new Error(`Fusion attempt ${attempt} produced no detectable face.`);
            }
            attempts.push({ dataUrl: result.url, similarity });
            logger.info(`[LikenessFusion] attempt ${attempt}: similarity ${similarity.toFixed(3)}`);

            if (similarity > best.similarity) best = { dataUrl: result.url, similarity };
            if (similarity >= deps.threshold) {
                bestPassed = true;
                best = { dataUrl: result.url, similarity };
                break;
            }
        }

        return {
            dataUrl: best.dataUrl,
            similarity: best.similarity,
            passedThreshold: bestPassed,
            attempts,
            embeddingMode
        };
    }
}

export const LikenessFusionService = new LikenessFusionServiceImpl();
