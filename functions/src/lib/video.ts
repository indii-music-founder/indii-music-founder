import { z } from "zod";

export const VideoJobSchema = z.object({
    jobId: z.string().min(1),
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
    lastFrame: z.string().optional().nullable(),
    timeOffset: z.number().optional().nullable(),
    ingredients: z.array(z.string()).optional().nullable(),
    duration: z.union([z.string(), z.number()]).optional().nullable(), // Allow number and null
    durationSeconds: z.number().optional().nullable(),
    generateAudio: z.boolean().optional().nullable(),
    options: z.object({
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
        resolution: z.enum(["720p", "1080p"]).optional(),
    }).optional().nullable(),
});

export type VideoJobInput = z.infer<typeof VideoJobSchema>;
