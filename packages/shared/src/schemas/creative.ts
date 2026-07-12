import { z } from 'zod';
import { VideoJobDirectorSettingsSchema } from './videoJob';

export const BaseMediaRequestSchema = z.object({
    prompt: z.string().min(1),
    referenceUri: z.string().startsWith('gs://').optional(),
    referenceUris: z.array(z.string().startsWith('gs://')).max(14).optional(),
});

export const GenerateImageSchema = BaseMediaRequestSchema.extend({
    sessionId: z.string().optional(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
    model: z.enum(['lite', 'fast', 'pro', 'legacy']).default('fast'),
    imageSize: z.enum(['512', '0.5K', '1K', '2K', '4K', '1k', '2k', '4k']).optional(),
    thinkingLevel: z.enum(['none', 'minimal', 'low', 'medium', 'high']).optional(),
    useGoogleSearch: z.boolean().optional(),
    useImageSearch: z.boolean().optional(),
    useGrounding: z.boolean().optional(),
});

export const GenerateVideoSchema = BaseMediaRequestSchema.extend({
    mode: z.enum(['video_remix', 'temporal_inpaint']).optional(),
    skipCostCheck: z.boolean().optional(),
    sourceVideoUri: z.string().startsWith('gs://').optional(),
    firstFrameUri: z.string().startsWith('gs://').optional(),
    lastFrameUri: z.string().startsWith('gs://').optional(),
    maskFrameUri: z.string().startsWith('gs://').optional(),
    maskTrackUri: z.string().startsWith('gs://').optional(),
    frameRange: z.object({
        startFrame: z.number().int().min(0),
        endFrame: z.number().int().min(0),
    }).optional(),
    referenceUris: z.array(z.string().startsWith('gs://')).max(3).optional(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3']).default('16:9'),
    model: z.enum(['lite', 'fast', 'pro']).default('fast'),
    resolution: z.enum(['720p', '1080p', '4k', '1280x720', '1920x1080', '3840x2160']).default('720p'),
    durationSeconds: z.number().min(4).max(8).default(6),
    directorSettings: VideoJobDirectorSettingsSchema.optional(),
    personGeneration: z.enum(['allow_adult', 'dont_allow', 'allow_all']).optional(),
    negativePrompt: z.string().max(1000).optional(),
    seed: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
    enhancePrompt: z.boolean().optional(),
    costEstimate: z.number().optional(),
    costReservationId: z.string().optional(),
    parentId: z.string().optional(),
});

export const GenerateOmniRemixSchema = z.object({
    prompt: z.string().min(1),
    referenceVideoUri: z.string().startsWith('gs://'),
    audioUri: z.string().startsWith('gs://').optional(),
    referenceUris: z.array(z.string().startsWith('gs://')).max(8).optional(),
    costEstimate: z.number().optional(),
    costReservationId: z.string().optional(),
    // ISSUE-774: 'hybrid-veo' is retired — the UI no longer offers it and the
    // server no longer prices it differently (it never ran a second Veo
    // stage). Kept accepted here only so a client with a stale persisted
    // selection doesn't fail payload validation.
    pipelineMode: z.enum(['pure-omni', 'hybrid-veo']).default('pure-omni'),
    aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
    durationSeconds: z.number().min(4).max(12).default(8),
    parentId: z.string().optional(),
    posePreservation: z.number().min(0).max(1).optional(),
    beatPulse: z.number().min(0).max(1).optional(),
    characterXRay: z.boolean().optional(),
    synthIdEnabled: z.boolean().optional(),
    activePosePreset: z.string().max(64).optional(),
    selectedLanguage: z.string().max(16).optional(),
    lyricsText: z.string().max(2000).optional(),
    typographyStyle: z.enum(['cyberpunk', 'kinetic-neon', 'liquid-gold', 'minimal-infographic']).optional(),
    visualizerColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const GenerateAudioSchema = BaseMediaRequestSchema.extend({
    durationSeconds: z.number().min(5).max(120).default(30),
});

export type BaseMediaRequest = z.infer<typeof BaseMediaRequestSchema>;
export type GenerateImage = z.infer<typeof GenerateImageSchema>;
export type GenerateVideo = z.infer<typeof GenerateVideoSchema>;
export type GenerateOmniRemix = z.infer<typeof GenerateOmniRemixSchema>;
export type GenerateAudio = z.infer<typeof GenerateAudioSchema>;
