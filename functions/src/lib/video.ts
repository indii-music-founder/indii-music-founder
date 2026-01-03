import { z } from "zod";

export const VideoJobSchema = z.object({
    jobId: z.string().min(1),
    userId: z.string().min(1),
    prompt: z.string().min(1),
    duration: z.string().optional(),
    fps: z.string().optional(),
    options: z.object({
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        resolution: z.enum(["720p", "1080p"]).optional().default("720p"),
    }).optional(),
});

export type VideoJobInput = z.infer<typeof VideoJobSchema>;
    jobId: z.string(),
    userId: z.string().optional(),
    orgId: z.string().optional(),
    prompt: z.string().min(1),
    resolution: z.string().optional(),
    aspectRatio: z.string().optional(),
    negativePrompt: z.string().optional(),
    seed: z.number().optional(),
    fps: z.number().optional(),
    cameraMovement: z.string().optional(),
    motionStrength: z.number().optional(),
    shotList: z.array(z.any()).optional(),
    firstFrame: z.string().optional(),
    lastFrame: z.string().optional(),
    timeOffset: z.number().optional(),
    ingredients: z.array(z.string()).optional(),
    duration: z.string().optional(), // e.g. "5s"
    durationSeconds: z.number().optional(),
});
