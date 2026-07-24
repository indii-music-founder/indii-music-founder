import { z } from 'zod';
export declare const AudioProfilePresetSchema: z.ZodEnum<["Natural", "Clean", "Studio", "Rescue"]>;
export declare const AudioFilterOperationSchema: z.ZodObject<{
    operation: z.ZodEnum<["high_pass", "hum_reduction", "denoise", "compressor", "deess", "dereverb", "true_peak_normalize", "ducking"]>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    parameters: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
}, "strict", z.ZodTypeAny, {
    operation: "high_pass" | "hum_reduction" | "denoise" | "compressor" | "deess" | "dereverb" | "true_peak_normalize" | "ducking";
    enabled: boolean;
    parameters: Record<string, string | number | boolean>;
}, {
    operation: "high_pass" | "hum_reduction" | "denoise" | "compressor" | "deess" | "dereverb" | "true_peak_normalize" | "ducking";
    parameters: Record<string, string | number | boolean>;
    enabled?: boolean | undefined;
}>;
export declare const AmbienceBlendModeSchema: z.ZodEnum<["master_only", "blend_ambience", "guide_only"]>;
export declare const AudioRecipeSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"audio-recipe.v1">;
    recipeId: z.ZodString;
    ownerUid: z.ZodString;
    organizationId: z.ZodString;
    projectId: z.ZodString;
    preset: z.ZodEnum<["Natural", "Clean", "Studio", "Rescue"]>;
    ambienceMode: z.ZodDefault<z.ZodEnum<["master_only", "blend_ambience", "guide_only"]>>;
    ambienceMixLevelDb: z.ZodDefault<z.ZodNumber>;
    duckingMusicLevelDb: z.ZodDefault<z.ZodNumber>;
    targetLufs: z.ZodDefault<z.ZodNumber>;
    filters: z.ZodArray<z.ZodObject<{
        operation: z.ZodEnum<["high_pass", "hum_reduction", "denoise", "compressor", "deess", "dereverb", "true_peak_normalize", "ducking"]>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        parameters: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
    }, "strict", z.ZodTypeAny, {
        operation: "high_pass" | "hum_reduction" | "denoise" | "compressor" | "deess" | "dereverb" | "true_peak_normalize" | "ducking";
        enabled: boolean;
        parameters: Record<string, string | number | boolean>;
    }, {
        operation: "high_pass" | "hum_reduction" | "denoise" | "compressor" | "deess" | "dereverb" | "true_peak_normalize" | "ducking";
        parameters: Record<string, string | number | boolean>;
        enabled?: boolean | undefined;
    }>, "many">;
    createdAt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    createdAt: string;
    schemaVersion: "audio-recipe.v1";
    projectId: string;
    ownerUid: string;
    organizationId: string;
    recipeId: string;
    preset: "Natural" | "Clean" | "Studio" | "Rescue";
    ambienceMode: "master_only" | "blend_ambience" | "guide_only";
    ambienceMixLevelDb: number;
    duckingMusicLevelDb: number;
    targetLufs: number;
    filters: {
        operation: "high_pass" | "hum_reduction" | "denoise" | "compressor" | "deess" | "dereverb" | "true_peak_normalize" | "ducking";
        enabled: boolean;
        parameters: Record<string, string | number | boolean>;
    }[];
}, {
    createdAt: string;
    schemaVersion: "audio-recipe.v1";
    projectId: string;
    ownerUid: string;
    organizationId: string;
    recipeId: string;
    preset: "Natural" | "Clean" | "Studio" | "Rescue";
    filters: {
        operation: "high_pass" | "hum_reduction" | "denoise" | "compressor" | "deess" | "dereverb" | "true_peak_normalize" | "ducking";
        parameters: Record<string, string | number | boolean>;
        enabled?: boolean | undefined;
    }[];
    ambienceMode?: "master_only" | "blend_ambience" | "guide_only" | undefined;
    ambienceMixLevelDb?: number | undefined;
    duckingMusicLevelDb?: number | undefined;
    targetLufs?: number | undefined;
}>;
export type AudioProfilePreset = z.infer<typeof AudioProfilePresetSchema>;
export type AudioFilterOperation = z.infer<typeof AudioFilterOperationSchema>;
export type AmbienceBlendMode = z.infer<typeof AmbienceBlendModeSchema>;
export type AudioRecipe = z.infer<typeof AudioRecipeSchema>;
//# sourceMappingURL=audioRecipe.d.ts.map