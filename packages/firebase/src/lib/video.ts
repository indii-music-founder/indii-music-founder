import { z } from "zod";
import { FUNCTION_INTELLIGENCE_MODELS } from "../config/models";

export type VeoModelTier = "lite" | "fast" | "pro";
export type VeoDurationSeconds = 4 | 6 | 8;

/**
 * Resolve only the supported server-owned Veo model allowlist. Clients may
 * send a tier keyword or its exact public model ID, but cannot select an
 * arbitrary Vertex publisher model.
 */
export function resolveVeoModel(rawModel: unknown): {
    tier: VeoModelTier;
    modelId: typeof FUNCTION_INTELLIGENCE_MODELS.VIDEO.LITE
        | typeof FUNCTION_INTELLIGENCE_MODELS.VIDEO.FAST
        | typeof FUNCTION_INTELLIGENCE_MODELS.VIDEO.PRO;
} {
    if (rawModel === "lite" || rawModel === FUNCTION_INTELLIGENCE_MODELS.VIDEO.LITE) {
        return { tier: "lite", modelId: FUNCTION_INTELLIGENCE_MODELS.VIDEO.LITE };
    }
    if (rawModel === "fast" || rawModel === FUNCTION_INTELLIGENCE_MODELS.VIDEO.FAST) {
        return { tier: "fast", modelId: FUNCTION_INTELLIGENCE_MODELS.VIDEO.FAST };
    }
    if (
        rawModel === undefined
        || rawModel === null
        || rawModel === ""
        || rawModel === "pro"
        || rawModel === FUNCTION_INTELLIGENCE_MODELS.VIDEO.PRO
        || rawModel === FUNCTION_INTELLIGENCE_MODELS.VIDEO.GENERATION
    ) {
        return { tier: "pro", modelId: FUNCTION_INTELLIGENCE_MODELS.VIDEO.PRO };
    }
    throw new TypeError("Unsupported video model tier.");
}

/**
 * Normalize the requested clip duration to the exact Veo durations the
 * provider can execute. This value must be used for both billing and the
 * provider request so a five-second UI request is reserved as six seconds.
 */
export function normalizeVeoDuration(rawDuration: unknown): VeoDurationSeconds {
    if (rawDuration === undefined || rawDuration === null || rawDuration === "") return 6;
    const duration = typeof rawDuration === "string" ? Number(rawDuration) : rawDuration;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0 || duration > 8) {
        throw new TypeError("Video duration must be greater than 0 and no more than 8 seconds.");
    }
    if (duration <= 4) return 4;
    if (duration <= 6) return 6;
    return 8;
}

export const VideoJobSchema = z.object({
    // Legacy callers may still send a client correlation ID, but the backend
    // deliberately ignores it and creates the authoritative job ID itself.
    jobId: z.string().min(1).max(128).optional(),
    userId: z.string().optional().nullable(),
    orgId: z.string().optional().nullable(),
    prompt: z.string().min(1),
    resolution: z.string().optional().nullable(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9").nullable(),
    negativePrompt: z.string().optional().nullable(),
    seed: z.number().optional().nullable(),
    fps: z.number().optional().nullable(),
    cameraMovement: z.string().optional().nullable(),
    motionStrength: z.number().optional().nullable(),
    shotList: z.array(z.any()).optional().nullable(),
    firstFrame: z.string().optional().nullable(),
    inputVideo: z.string().optional().nullable(), // For video extension
    image: z.object({
        imageBytes: z.string(),
        mimeType: z.string().optional()
    }).optional().nullable(),
    lastFrame: z.string().optional().nullable(),
    timeOffset: z.number().optional().nullable(),
    ingredients: z.array(z.string()).optional().nullable(),
    referenceImages: z.array(z.object({
        image: z.object({
            imageBytes: z.string().optional(),
            uri: z.string().optional()
        }).optional(),
        referenceType: z.enum(["ASSET", "STYLE"]).optional().default("ASSET")
    })).optional().nullable(),
    personGeneration: z.enum(["dont_allow", "allow_adult", "allow_all"]).optional().nullable(),
    duration: z.union([z.string(), z.number()]).optional().nullable(), // Allow number and null
    durationSeconds: z.number().optional().nullable(),
    generateAudio: z.boolean().optional().nullable(),
    thinking: z.boolean().optional().nullable(),
    model: z.string().optional().nullable(),
    options: z.object({
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
        resolution: z.enum(["720p", "1080p", "4k"]).optional(),
    }).optional().nullable(),
});

export type VideoJobInput = z.infer<typeof VideoJobSchema>;
