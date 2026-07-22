import { z } from 'zod';

const IdentifierSchema = z.string().trim().min(1).max(256);

export const AudioProfilePresetSchema = z.enum([
    'Natural',
    'Clean',
    'Studio',
    'Rescue',
]);

export const AudioFilterOperationSchema = z.object({
    operation: z.enum([
        'high_pass',
        'hum_reduction',
        'denoise',
        'compressor',
        'deess',
        'dereverb',
        'true_peak_normalize',
        'ducking',
    ]),
    enabled: z.boolean().default(true),
    parameters: z.record(z.union([z.string(), z.number(), z.boolean()])),
}).strict();

export const AmbienceBlendModeSchema = z.enum([
    'master_only',
    'blend_ambience',
    'guide_only',
]);

export const AudioRecipeSchema = z.object({
    schemaVersion: z.literal('audio-recipe.v1'),
    recipeId: IdentifierSchema,
    ownerUid: IdentifierSchema,
    organizationId: IdentifierSchema,
    projectId: IdentifierSchema,
    preset: AudioProfilePresetSchema,
    ambienceMode: AmbienceBlendModeSchema.default('master_only'),
    ambienceMixLevelDb: z.number().min(-60).max(0).default(-18),
    duckingMusicLevelDb: z.number().min(-60).max(0).default(-12),
    targetLufs: z.number().min(-30).max(-6).default(-16),
    filters: z.array(AudioFilterOperationSchema),
    createdAt: z.string().datetime(),
}).strict();

export type AudioProfilePreset = z.infer<typeof AudioProfilePresetSchema>;
export type AudioFilterOperation = z.infer<typeof AudioFilterOperationSchema>;
export type AmbienceBlendMode = z.infer<typeof AmbienceBlendModeSchema>;
export type AudioRecipe = z.infer<typeof AudioRecipeSchema>;
