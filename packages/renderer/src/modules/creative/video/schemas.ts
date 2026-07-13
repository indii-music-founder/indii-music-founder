import { z } from "zod";
import { UserProfile } from "@/types/User";
export { BaseMediaRequestSchema, GenerateAudioSchema, GenerateImageSchema, GenerateOmniRemixSchema, GenerateVideoSchema } from '@indii/shared';

export const VideoJobStatusSchema = z.enum([
    'idle', 'queued', 'processing', 'completed', 'failed', 'stitching', 'cancelled'
]);

export const SafetyRatingSchema = z.object({
    category: z.string(),
    threshold: z.string()
});

export const VideoResolutionSchema = z.enum([
    '720p', '1080p', '4k'
]);

export const AspectRatioSchema = z.enum([
    '1:1', '3:4', '4:3', '9:16', '16:9', '21:9', '9:21', '2:3', '3:2', '4:5', '5:4', '7:9', '9:7', '16:10', '10:16'
]);

export const VideoAspectRatioSchema = z.enum([
    '16:9', '9:16', '1:1'
]);

export const ReferenceImageSchema = z.object({
    image: z.object({
        imageBytes: z.string().optional(),
        uri: z.string().optional()
    }).optional(),
    // Official Veo 3.1 API only supports lowercase 'asset' — no 'style' mode exists
    referenceType: z.literal('asset').optional().default('asset')
});

export const DirectorSettingsSchema = z.object({
    fps: z.number().int().min(1).max(60),
    durationSeconds: z.number().positive(),
    totalFrames: z.number().int().nonnegative(),
    aspectRatio: VideoAspectRatioSchema.optional(),
    resolution: VideoResolutionSchema.optional(),
    seed: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
    firstFrameUri: z.string().optional(),
    lastFrameUri: z.string().optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().min(0).max(1).optional(),
});

// UI callers may use a semantic tier or the canonical GA provider ID from
// INTELLIGENCE_MODELS. Preview/retired IDs are deliberately absent.
export const SupportedVideoModelSchema = z.enum([
    'lite', 'fast', 'pro',
    'veo-3.1-lite-generate-001',
    'veo-3.1-fast-generate-001',
    'veo-3.1-generate-001',
]);

export const VideoGenerationOptionsSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    mode: z.enum(['video_remix', 'temporal_inpaint']).optional(),
    aspectRatio: VideoAspectRatioSchema.optional(),
    resolution: VideoResolutionSchema.optional(),
    seed: z.number().int().optional(),
    negativePrompt: z.string().optional(),
    model: SupportedVideoModelSchema.optional(),
    firstFrame: z.string().optional(), // Allow Data URI or URL
    lastFrame: z.string().optional(),  // Allow Data URI or URL
    inputVideo: z.string().optional(), // For video extensions (URL or Base64)
    image: z.object({
        imageBytes: z.string(),
        mimeType: z.string().optional()
    }).optional(),
    sourceVideoUri: z.string().startsWith('gs://').optional(),
    maskFrameUri: z.string().startsWith('gs://').optional(),
    maskTrackUri: z.string().startsWith('gs://').optional(),
    frameRange: z.object({
        startFrame: z.number().int().min(0),
        endFrame: z.number().int().min(0),
    }).optional(),
    timeOffset: z.number().optional(),
    ingredients: z.array(z.string()).optional(),
    referenceImages: z.array(ReferenceImageSchema).max(3, "Max 3 reference images").optional(), // Veo 3.1 alias
    personGeneration: z.enum(["dont_allow", "allow_adult", "allow_all"]).optional(),
    duration: z.number().min(1).max(300).optional(), // 5 minutes max per atomic job
    durationSeconds: z.number().optional(), // Alias for consistency
    fps: z.number().int().min(1).max(60).optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().min(0).max(1).optional(),
    shotList: z.array(z.unknown()).optional(), // Can refine later
    directorSettings: DirectorSettingsSchema.optional(),
    // NOTE: Audio is always-on for Veo 3.1 — generateAudio is not a valid API parameter
    // Retained in schema for UI state only, never sent to API
    inputAudio: z.string().optional(), // For custom soundtracks (URL or Base64)
    thinkingLevel: z.enum(['none', 'minimal', 'low', 'medium', 'high']).optional(),
    orgId: z.string().optional(),
    userProfile: z.custom<UserProfile>().optional(), // Typed UserProfile for service compatibility
    jobId: z.string().optional(),
    useGrounding: z.boolean().optional(),
    skipCostCheck: z.boolean().optional(),
    costReservationId: z.string().optional(),
    parentId: z.string().optional(),
    inputManifest: z.array(z.object({
        role: z.enum(['first_frame', 'last_frame', 'ingredient', 'character_reference', 'whisk_reference']),
        uri: z.string(),
    })).max(5).optional(),
});

export type VideoGenerationOptions = z.infer<typeof VideoGenerationOptionsSchema>;
