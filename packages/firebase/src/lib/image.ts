import { z } from "zod";

// ============================================================================
// SHARED ENUMS & TYPES
// ============================================================================

/**
 * All 14 aspect ratios supported by Gemini 3.1 Flash Image.
 * Pro supports a subset (10): excludes 1:4, 4:1, 1:8, 8:1.
 * Legacy supports a subset (9): excludes 1:4, 4:1, 1:8, 8:1, 21:9.
 */
const AspectRatioEnum = z.enum([
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
    "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
]);

/**
 * Image resolution sizes.
 * IMPORTANT: API requires UPPERCASE "K" — lowercase "1k" is rejected.
 * The schema accepts either case and normalizes to uppercase.
 * - "512": Flash + Legacy only
 * - "1K": All tiers
 * - "2K": Fast + Pro only
 * - "4K": Fast + Pro only
 */
const ImageSizeEnum = z.string()
    .transform(v => v.toUpperCase())
    .pipe(z.enum(["512", "1K", "2K", "4K"]));

/**
 * Nano Banana model tier selector.
 * - "legacy": gemini-2.5-flash-image (OG, high-volume)
 * - "fast": gemini-3.1-flash-image-preview (Nano Banana 2, balanced)
 * - "pro": gemini-3-pro-image-preview (Nano Banana Pro, highest fidelity)
 */
const ModelTierEnum = z.enum(["legacy", "fast", "pro"]);

/**
 * Thinking level control (Flash models only — Pro always thinks).
 * Thinking tokens are billed regardless of the level or includeThoughts setting.
 */
const ThinkingLevelEnum = z.enum(["minimal", "high"]);

/**
 * Controls what responseModalities the API returns.
 * - "image_only": ["IMAGE"] — raw image output, no text
 * - "image_and_text": ["TEXT", "IMAGE"] — interleaved narration + images
 */
const ResponseFormatEnum = z.enum(["image_only", "image_and_text"]);

/**
 * Inline image data — base64 encoded with MIME type.
 * Used for reference images, source images, masks.
 */
const InlineImageSchema = z.object({
    mimeType: z.string(),
    data: z.string(), // Base64 encoded
});

/**
 * Conversation history entry for multi-turn editing.
 * Each entry maps to a role/parts pair in the Gemini contents array.
 */
const ConversationTurnSchema = z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(z.object({
        text: z.string().optional(),
        inlineData: z.object({
            mimeType: z.string(),
            data: z.string(),
        }).optional(),
        thought: z.boolean().optional(),
        thoughtSignature: z.string().optional(),
    })),
});

// ============================================================================
// GENERATE IMAGE REQUEST
// ============================================================================

export const GenerateImageRequestSchema = z.object({
    /** The text prompt describing what to generate */
    prompt: z.string().min(1, "Prompt is required"),

    /** Output aspect ratio. Default: "1:1" */
    aspectRatio: AspectRatioEnum.nullish(),

    /** Number of images to generate (1-4). Pro always returns 1. */
    count: z.number().int().min(1).max(4).nullish().default(1),

    /** Reference images for composition/style (up to 14 for Flash, 11 for Pro) */
    images: z.array(InlineImageSchema).max(14).nullish(),

    /** Model tier to use. Default: "fast" */
    model: ModelTierEnum.nullish().default("fast"),

    /** Output resolution. Must be uppercase. Default: "1K" */
    imageSize: ImageSizeEnum.nullish().default("1K"),

    // --- Gemini 3 Advanced Configuration ---

    /**
     * Thinking level control (Flash only — Pro always thinks at max).
     * Thinking tokens are billed regardless of setting.
     */
    thinkingLevel: ThinkingLevelEnum.nullish(),

    /**
     * Whether to include the model's thinking process in the response.
     * Parts with `thought: true` will be included.
     * Thinking tokens are billed regardless of this setting.
     */
    includeThoughts: z.boolean().nullish(),

    /**
     * Enable Google Search grounding.
     * The model will use real-time search results to inform generation.
     * Response will include `groundingMetadata` with source URLs.
     */
    useGoogleSearch: z.boolean().nullish(),

    /**
     * Enable Image Search grounding (Flash only — Pro rejects this).
     * Adds visual search alongside web search for reference.
     * Requires useGoogleSearch to also be true.
     */
    useImageSearch: z.boolean().nullish(),

    /**
     * Controls what the API returns.
     * - "image_only" (default): Only image data
     * - "image_and_text": Interleaved text narration + images
     */
    responseFormat: ResponseFormatEnum.nullish(),

    // --- Multi-Turn Editing (Stateless) ---

    /**
     * Previous conversation history for multi-turn editing.
     * The client stores the full exchange and sends it back each turn.
     * The Cloud Function passes it through as the `contents` array.
     */
    conversationHistory: z.array(ConversationTurnSchema).nullish(),

    /**
     * Thought signature from a previous response.
     * Must be circulated back exactly as received for multi-turn continuity.
     * Failure to pass this may cause the response to fail.
     */
    thoughtSignature: z.string().nullish(),

    // --- Legacy compatibility fields ---

    /** @deprecated Use `thinkingLevel` instead. Kept for backward compat. */
    thinking: z.boolean().nullish().default(false),

    /** @deprecated Use `useGoogleSearch` instead. Kept for backward compat. */
    useGrounding: z.boolean().nullish().default(false),
});

// ============================================================================
// EDIT IMAGE REQUEST
// ============================================================================

export const EditImageRequestSchema = z.object({
    /** Base image to edit (Base64) */
    image: z.string().min(1, "Base image is required"),

    /** MIME type of the base image */
    imageMimeType: z.string().default("image/png"),

    /** Optional binary mask for inpainting (Base64) */
    mask: z.string().nullish(),

    /** MIME type of the mask */
    maskMimeType: z.string().nullish(),

    /** Edit instruction prompt */
    prompt: z.string().min(1, "Prompt is required"),

    /** Single reference image (Base64) — legacy field, prefer `referenceImages` */
    referenceImage: z.string().nullish(),

    /** MIME type of the single reference image */
    refMimeType: z.string().nullish(),

    /** Model ID override (full model string or tier) */
    model: z.string().nullish(),

    /** Thought signature from previous edit for multi-turn continuity */
    thoughtSignature: z.string().nullish(),

    // --- New Gemini 3 fields ---

    /** Multiple reference images for multi-image composition edits */
    referenceImages: z.array(InlineImageSchema).max(14).nullish(),

    /** Output aspect ratio for the edited image */
    aspectRatio: AspectRatioEnum.nullish(),

    /** Output resolution for the edited image */
    imageSize: ImageSizeEnum.nullish(),

    /** Thinking level (Flash models only) */
    thinkingLevel: ThinkingLevelEnum.nullish(),

    /** Whether to include thoughts in the response */
    includeThoughts: z.boolean().nullish(),

    /** Enable Google Search grounding for edits */
    useGoogleSearch: z.boolean().nullish(),

    /** Response format control */
    responseFormat: ResponseFormatEnum.nullish(),

    /** Previous conversation history for iterative editing sessions */
    conversationHistory: z.array(ConversationTurnSchema).nullish(),
});

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;
export type EditImageRequest = z.infer<typeof EditImageRequestSchema>;
export type AspectRatio = z.infer<typeof AspectRatioEnum>;
export type ImageSize = z.infer<typeof ImageSizeEnum>;
export type ModelTier = z.infer<typeof ModelTierEnum>;
export type ThinkingLevel = z.infer<typeof ThinkingLevelEnum>;
export type ResponseFormat = z.infer<typeof ResponseFormatEnum>;
export type InlineImage = z.infer<typeof InlineImageSchema>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
