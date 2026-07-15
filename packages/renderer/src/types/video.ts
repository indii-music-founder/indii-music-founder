import { z } from "zod";
import { VideoJobStatusSchema } from "@/modules/creative/video/schemas";

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
    // Legacy/Alias support for existing UI and services
    videoUrl?: string;
    url?: string;
    stitchError?: string;
    // Long-form/daisy-chain: URL of each completed segment, in order (ISSUE-878).
    // Presence signals a genuine multi-segment job — used to distinguish a real
    // long-form 'stitching' completion from a transient mid-render progress marker.
    segmentUrls?: string[];
    safety_ratings?: VideoSafetyRating[];
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
