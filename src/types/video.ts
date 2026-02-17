import { z } from "zod";
import { VideoJobStatusSchema } from "@/modules/video/schemas";

export type VideoJobStatus = z.infer<typeof VideoJobStatusSchema>;

export interface VideoSafetyRating {
    category: string;
    threshold: string;
    blocked?: boolean;
    probability?: string;
}

export interface VideoJobOutput {
    url: string;
    metadata?: {
        mime_type?: string;
        quality?: 'pro' | 'flash';
        duration?: number;
        width?: number;
        height?: number;
        fps?: number;
        [key: string]: unknown;
    };
}

export interface VideoJob {
    id: string;
    userId: string;
    orgId?: string;
    prompt: string;
    status: VideoJobStatus;
    progress: number;
    error?: string;
    output?: VideoJobOutput;
    safety_ratings?: VideoSafetyRating[];
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
