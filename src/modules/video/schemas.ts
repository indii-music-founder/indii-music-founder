import { z } from "zod";

export const VideoJobStatusSchema = z.enum([
    'idle', 'queued', 'processing', 'completed', 'failed', 'stitching'
]);

export const VideoResolutionSchema = z.enum([
    '1280x720', '1920x1080', '1080x1920', '720x1280', '1024x1024'
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
    firstFrame: z.string().url().optional(),
    lastFrame: z.string().url().optional(),
    timeOffset: z.number().optional(),
    ingredients: z.array(z.string().url()).optional(),
    duration: z.number().min(1).max(300).optional(), // 5 minutes max per atomic job
    fps: z.number().int().min(1).max(60).optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().min(0).max(1).optional(),
    shotList: z.array(z.any()).optional(), // Can refine later
    orgId: z.string().optional(),
    userProfile: z.any().optional() // Complex object, keep loose for now
});

export type VideoGenerationOptions = z.infer<typeof VideoGenerationOptionsSchema>;
