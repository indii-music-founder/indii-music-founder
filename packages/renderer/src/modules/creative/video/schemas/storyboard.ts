import { z } from "zod";

export const StoryboardSlotSchema = z.object({
    id: z.string(),
    barIndex: z.number().int().nonnegative(),
    startBar: z.number().int().nonnegative(),
    durationBars: z.number().int().positive().default(4), // default 4-bar clips
    startSeconds: z.number().nonnegative().optional(),
    durationSeconds: z.number().int().positive().max(60).optional(),
    sourceSceneNumber: z.number().int().positive().optional(),
    heading: z.string().optional(),
    description: z.string().optional(),
    cameraAngle: z.string().optional(),
    prompt: z.string(),
    negativePrompt: z.string().optional(),
    videoUrl: z.string().url().optional(),
    /** Immutable server-owned source identity; videoUrl is preview-only. */
    canonicalVideoUri: z.string().startsWith('gs://').optional(),
    isGenerating: z.boolean().default(false),
    progress: z.number().min(0).max(100).default(0),
    vocalConditioningAudioUrl: z.string().optional(),
    useVocalSync: z.boolean().default(false),
    useDaisyChain: z.boolean().default(true),
    driftScore: z.number().min(0).max(1).optional()
});

export const StoryboardProjectSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    audioUrl: z.string().optional(),
    bpm: z.number().positive().default(120),
    key: z.string().optional(),
    durationSeconds: z.number().nonnegative().default(0),
    source: z.enum(['audio-grid', 'screenwriter']).default('audio-grid'),
    concept: z.string().optional(),
    tone: z.enum(['cinematic', 'abstract', 'hype']).optional(),
    slots: z.array(StoryboardSlotSchema).default([])
});

export type StoryboardSlot = z.infer<typeof StoryboardSlotSchema>;
export type StoryboardProject = z.infer<typeof StoryboardProjectSchema>;
