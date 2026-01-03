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
