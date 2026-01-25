import { z } from "zod";

export const VideoJobStatusSchema = z.enum([
    'idle', 'queued', 'processing', 'completed', 'failed', 'stitching'
]);

export const SafetyRatingSchema = z.object({
    category: z.string(),
    threshold: z.string()
});

export const VideoResolutionSchema = z.enum([
    '1280x720', '1920x1080', '1080x1920', '720x1280', '1024x1024', '4k'
]);

export const VideoAspectRatioSchema = z.enum([
    '16:9', '9:16', '1:1', '4:3', '3:4'
]);

export const VideoGenerationOptionsSchema = z.object({
    prompt: z.string().min(1, "Prompt is required"),
    aspectRatio: VideoAspectRatioSchema.optional(),
    resolution: VideoResolutionSchema.optional(),
    seed: z.number().int().optional(),
    negativePrompt: z.string().optional(),
    model: z.string().optional(),
    firstFrame: z.string().optional(), // Allow Data URI or URL
    lastFrame: z.string().optional(),  // Allow Data URI or URL
    inputVideo: z.string().optional(), // For video extensions (URL or Base64)
    image: z.object({
        imageBytes: z.string(),
        mimeType: z.string().optional()
    }).optional(),
    timeOffset: z.number().optional(),
    ingredients: z.array(z.string().url()).optional(),
    referenceImages: z.array(z.any()).optional(), // Veo 3.1 alias
    duration: z.number().min(1).max(300).optional(), // 5 minutes max per atomic job
    durationSeconds: z.number().optional(), // Alias for consistency
    fps: z.number().int().min(1).max(60).optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().min(0).max(1).optional(),
    shotList: z.array(z.any()).optional(), // Can refine later
    generateAudio: z.boolean().optional(),
    orgId: z.string().optional(),
    userProfile: z.any().optional() // Complex object, keep loose for now
});

export type VideoGenerationOptions = z.infer<typeof VideoGenerationOptionsSchema>;
