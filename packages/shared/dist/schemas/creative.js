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
    count: z.number().int().min(1).max(4).default(1),
    thinkingLevel: z.enum(['none', 'minimal', 'low', 'medium', 'high']).optional(),
    includeThoughts: z.boolean().optional(),
    responseFormat: z.enum(['image_only', 'image_and_text']).default('image_only'),
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
    inputManifest: z.array(z.object({
        role: z.enum(['first_frame', 'last_frame', 'ingredient', 'character_reference', 'whisk_reference']),
        uri: z.string().startsWith('gs://'),
    })).max(5).optional(),
});
export const OmniVideoTaskSchema = z.enum([
    'text_to_video',
    'image_to_video',
    'reference_to_video',
    'edit',
]);
export const OmniStoryboardFrameSchema = z.object({
    timestamp: z.number().min(0).max(10),
    prompt: z.string().trim().min(1).max(500),
});
export const GenerateOmniRemixSchema = z.object({
    prompt: z.string().trim().min(1).max(4000),
    task: OmniVideoTaskSchema.optional(),
    referenceVideoUri: z.string().startsWith('gs://').optional(),
    firstFrameUri: z.string().startsWith('gs://').optional(),
    audioUri: z.string().startsWith('gs://').optional(),
    referenceUris: z.array(z.string().startsWith('gs://')).max(8).optional(),
    previousInteractionId: z.string().trim().min(1).max(256).optional(),
    previousJobId: z.string().trim().min(1).max(256).optional(),
    storyboard: z.array(OmniStoryboardFrameSchema).max(12).optional(),
    costEstimate: z.number().optional(),
    costReservationId: z.string().optional(),
    // ISSUE-774: 'hybrid-veo' is retired — the UI no longer offers it and the
    // server no longer prices it differently (it never ran a second Veo
    // stage). Kept accepted here only so a client with a stale persisted
    // selection doesn't fail payload validation.
    pipelineMode: z.enum(['pure-omni', 'hybrid-veo']).default('pure-omni'),
    aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
    durationSeconds: z.number().min(3).max(10).default(8),
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
}).superRefine((data, ctx) => {
    const task = data.task
        ?? (data.previousInteractionId || data.referenceVideoUri
            ? 'edit'
            : data.firstFrameUri
                ? 'image_to_video'
                : data.referenceUris?.length
                    ? 'reference_to_video'
                    : 'text_to_video');
    if (task === 'edit' && !data.previousInteractionId && !data.referenceVideoUri) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['referenceVideoUri'],
            message: 'Edit mode requires a source video or previous interaction ID.',
        });
    }
    if (data.previousInteractionId && data.referenceVideoUri) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['referenceVideoUri'],
            message: 'Choose either a stored interaction or an uploaded source video for one edit request.',
        });
    }
    if (task !== 'edit' && (data.previousInteractionId || data.previousJobId || data.referenceVideoUri)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['task'],
            message: 'Previous interactions and source videos are valid only in edit mode.',
        });
    }
    if (task === 'text_to_video' && (data.firstFrameUri || data.referenceUris?.length)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['task'],
            message: 'Text-to-video mode cannot include image inputs.',
        });
    }
    if (data.previousInteractionId && !data.previousJobId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['previousJobId'],
            message: 'Stateful edits require the previous owned job ID.',
        });
    }
    if (data.previousJobId && !data.previousInteractionId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['previousInteractionId'],
            message: 'A previous job ID requires its provider interaction ID.',
        });
    }
    if (task === 'image_to_video' && !data.firstFrameUri) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['firstFrameUri'],
            message: 'Image-to-video mode requires a first-frame image.',
        });
    }
    if (task === 'reference_to_video' && !data.referenceUris?.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['referenceUris'],
            message: 'Reference-to-video mode requires at least one reference image.',
        });
    }
    if ((data.referenceUris?.length ?? 0) + (data.firstFrameUri ? 1 : 0) > 8) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['referenceUris'],
            message: 'Omni accepts at most eight images across the first frame and references.',
        });
    }
    for (const [index, frame] of (data.storyboard ?? []).entries()) {
        if (frame.timestamp > data.durationSeconds) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['storyboard', index, 'timestamp'],
                message: 'Storyboard timestamps cannot exceed the target duration.',
            });
        }
    }
});
export const TTSVoiceSchema = z.enum([
    'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe',
    'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux',
    'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck', 'Pulcherrima',
    'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel',
    'Vindemiatrix', 'Zephyr', 'Zubenelgenubi',
]);
/** Durable single-speaker TTS request. requestId makes callable retries idempotent. */
export const GenerateAudioSchema = z.object({
    prompt: z.string().trim().min(1).max(10000),
    voice: TTSVoiceSchema.default('Kore'),
    requestId: z.string().uuid(),
});
