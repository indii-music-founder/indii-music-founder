import { z } from "zod";
import { UserProfile } from "@/types/User";

export const VideoJobStatusSchema = z.enum([
    'idle', 'queued', 'processing', 'completed', 'failed', 'stitching'
]);

export const SafetyRatingSchema = z.object({
    category: z.string(),
    threshold: z.string()
});

export const VideoResolutionSchema = z.enum([
    '720p', '1080p', '4k'
]);

export const VideoAspectRatioSchema = z.enum([
    '16:9', '9:16', '1:1', '4:3', '3:4'
]);

export const ReferenceImageSchema = z.object({
    image: z.object({
        imageBytes: z.string().optional(),
        uri: z.string().optional()
    }).optional(),
    referenceType: z.enum(["ASSET", "STYLE"]).optional().default("ASSET")
});

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
    ingredients: z.array(z.string()).optional(),
    referenceImages: z.array(ReferenceImageSchema).max(3, "Max 3 reference images").optional(), // Veo 3.1 alias
    personGeneration: z.enum(["dont_allow", "allow_adult", "allow_all"]).optional(),
    duration: z.number().min(1).max(300).optional(), // 5 minutes max per atomic job
    durationSeconds: z.number().optional(), // Alias for consistency
    fps: z.number().int().min(1).max(60).optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().min(0).max(1).optional(),
    shotList: z.array(z.unknown()).optional(), // Can refine later
    generateAudio: z.boolean().optional(),
    thinking: z.boolean().optional(),
    orgId: z.string().optional(),
    userProfile: z.custom<UserProfile>().optional() // Typed UserProfile for service compatibility
});

export type VideoGenerationOptions = z.infer<typeof VideoGenerationOptionsSchema>;
