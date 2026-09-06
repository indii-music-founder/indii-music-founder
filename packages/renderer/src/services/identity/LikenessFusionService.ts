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
    evaluateLikenessCalibration,
    type FaceAnalysisFn,
    type CalibrationSample,
    type LikenessCalibrationPair,
    type LikenessCalibrationReport,
    type EmbeddingMode
} from '@/services/identity/FacePipeline';
import { Editing } from '@/services/image/EditingService';
import { LikenessService, type LikenessImage } from '@/services/image/LikenessService';

export {
    evaluateLikenessCalibration,
    type CalibrationSample,
    type LikenessCalibrationPair,
    type LikenessCalibrationReport
};

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

/** Default headshot resolver mirrors DEC-2: only My Likeness or Brand Kit headshots, never arbitrary gallery images. */
async function defaultResolveHeadshot(headshotId?: string): Promise<LikenessImage> {
    if (headshotId && (/^https?:\/\//i.test(headshotId) || /^data:/i.test(headshotId))) {
        throw new Error('Arbitrary external or gallery URLs are rejected at the schema level (Part I.1 compliance violation). Use a verified Likeness ID.');
    }

    const all = await LikenessService.getAll();
    let headshot: LikenessImage | undefined;

    if (all && all.length > 0) {
        if (headshotId) {
            headshot = all.find(l => l.id === headshotId);
        } else {
            const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
            headshot = sorted[0];
        }
    }

    // Fallback to BrandKit headshot assets per DEC-2 / Part I.1
    if (!headshot) {
        try {
            const { useStore } = await import('@/core/store');
            const brandKit = useStore.getState().userProfile?.brandKit;
            const brandHeadshots = brandKit?.referenceImages?.filter(a => a.category === 'headshot') || [];
            if (headshotId) {
                const bMatch = brandHeadshots.find(b => b.id === headshotId || b.description === headshotId || b.url === headshotId);
                if (bMatch) {
                    headshot = {
                        id: headshotId,
                        url: bMatch.url,
                        storageRef: bMatch.url,
                        qualityScore: 'good',
                        consentGiven: true,
                        createdAt: Date.now()
                    };
                }
            } else if (brandHeadshots.length > 0) {
                const first = brandHeadshots[0]!;
                headshot = {
                    id: first.id || 'brandkit-headshot',
                    url: first.url,
                    storageRef: first.url,
                    qualityScore: 'good',
                    consentGiven: true,
                    createdAt: Date.now()
                };
            }
        } catch {
            // Store unavailable
        }
    }

    if (!headshot) {
        if (headshotId) {
            throw new Error(`Likeness "${headshotId}" not found.`);
        }
        throw new Error('No verified likeness found. Add a selfie in My Likeness before fusing (DEC-2).');
    }

    if (!headshot.consentGiven) {
        throw new Error('Affirmative biometric consent was not provided for this likeness (Part I.1 compliance violation).');
    }

    return headshot;
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

            // Immutable audit record logging (Part I.1)
            logger.info('[LikenessFusionAudit]', {
                meta: 'likeness_fusion',
                headshotId: headshot.id,
                similarityScore: similarity,
                attempt,
                passedThreshold: similarity >= deps.threshold,
                timestamp: Date.now()
            });

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

    /**
     * Deterministic calibration loop (Workstream A1.5).
     * Runs evaluation against a set of calibration pairs to verify decision boundary separation.
     */
    async calibrateLikenessLoop(
        samples: CalibrationSample[],
        mode: EmbeddingMode = 'identity'
    ): Promise<LikenessCalibrationReport> {
        return evaluateLikenessCalibration(samples, mode);
    }
}

export const LikenessFusionService = new LikenessFusionServiceImpl();
export const fuseLikeness = LikenessFusionService.fuseLikeness.bind(LikenessFusionService);
