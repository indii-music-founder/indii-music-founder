import { z } from 'zod';

// Scene Detection
export const DetectedSceneSchema = z.object({
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    description: z.string(),
    dominantColors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    keyObjects: z.array(z.string()),
});

export const SceneDetectionSchema = z.object({
    scenes: z.array(DetectedSceneSchema),
    suggestedCuts: z.array(z.object({
        timestamp: z.number().min(0),
        reason: z.string(),
    })),
});

// Auto-Captioning
export const CaptionSchema = z.object({
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    text: z.string(),
    speaker: z.string().optional(),
    confidence: z.number().min(0).max(1),
});

export const AutoCaptionSchema = z.object({
    captions: z.array(CaptionSchema),
    language: z.string(),
});

// Highlight Reel
export const HighlightSchema = z.object({
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    score: z.number().min(0).max(1),
    reason: z.string(),
    suggestedTransition: z.enum(['cut', 'fade', 'wipe']),
});

export const HighlightReelSchema = z.object({
    highlights: z.array(HighlightSchema),
    recommendedOrder: z.array(z.number().int()),
    totalDuration: z.number().min(0),
});

// Metadata Extraction
export const VideoMetadataSchema = z.object({
    duration: z.number().min(0),
    resolution: z.object({
        width: z.number().int().min(1),
        height: z.number().int().min(1),
    }),
    fps: z.number().min(1),
    hasAudio: z.boolean(),
    dominantColors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)),
    suggestedTags: z.array(z.string()),
});

// Type exports
export type DetectedScene = z.infer<typeof DetectedSceneSchema>;
export type SceneDetection = z.infer<typeof SceneDetectionSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type AutoCaption = z.infer<typeof AutoCaptionSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type HighlightReel = z.infer<typeof HighlightReelSchema>;
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;
