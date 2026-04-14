/**
 * AI Model Configuration for Cloud Functions
 * 
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side AI_MODELS config where applicable.
 * 
 * Nano Banana Model Tiers:
 *   LEGACY  → gemini-2.5-flash-image       (OG, high-volume / low-latency)
 *   FAST    → gemini-3.1-flash-image-preview (Nano Banana 2, speed + quality)
 *   PRO     → gemini-3-pro-image-preview     (Nano Banana Pro, highest fidelity)
 */

export const FUNCTION_AI_MODELS = {
    IMAGE: {
        /** Nano Banana Pro — highest quality, 4K, advanced thinking */
        GENERATION: 'gemini-3-pro-image-preview',
        /** Nano Banana 2 — fast + quality, grounding, 4K */
        FAST: 'gemini-3.1-flash-image-preview',
        /** Nano Banana OG — legacy, high-volume / low-latency */
        LEGACY: 'gemini-2.5-flash-image',
    },
    TEXT: {
        FAST: 'gemini-3-flash-preview',
        PRO: 'gemini-3-pro-preview',
    },
    VIDEO: {
        GENERATION: 'veo-3.1-generate-preview',
        PRO: 'veo-3.1-generate-preview', // Alias for internal consistency
        FAST: 'veo-3.1-fast-generate-preview',
    },
    SPEECH: {
        GENERATION: 'gemini-2.5-pro-tts',
    },
    AUDIO: {
        ANALYSIS: 'gemini-3-pro-preview', // Multimodal audio support
    }
} as const;

/**
 * Nano Banana Capability Registry
 * 
 * Maps each image model tier to its supported features.
 * When Google ships model updates, change THIS object and everything adapts.
 */
export const NANO_BANANA_CAPABILITIES = {
    [FUNCTION_AI_MODELS.IMAGE.GENERATION]: {
        tier: 'pro' as const,
        displayName: 'Nano Banana Pro',
        maxResolution: '4K',
        supportedResolutions: ['1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const,
        maxReferenceImages: 11, // 6 objects + 5 characters
        supportsThinkingControl: false, // Always on, no level control
        supportsGoogleSearch: true,
        supportsImageSearch: false, // Flash only
        supportsCandidateCount: false, // Pro only supports 1
        supportsInterleaved: true,
        defaultThinking: 'always_on',
    },
    [FUNCTION_AI_MODELS.IMAGE.FAST]: {
        tier: 'fast' as const,
        displayName: 'Nano Banana 2',
        maxResolution: '4K',
        supportedResolutions: ['512', '1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'] as const,
        maxReferenceImages: 14, // 10 objects + 4 characters
        supportsThinkingControl: true, // minimal / high
        supportsGoogleSearch: true,
        supportsImageSearch: true, // Flash only
        supportsCandidateCount: true,
        supportsInterleaved: true,
        defaultThinking: 'minimal',
    },
    [FUNCTION_AI_MODELS.IMAGE.LEGACY]: {
        tier: 'legacy' as const,
        displayName: 'Nano Banana',
        maxResolution: '1K',
        supportedResolutions: ['512', '1K'] as const,
        supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'] as const,
        maxReferenceImages: 0,
        supportsThinkingControl: false,
        supportsGoogleSearch: false,
        supportsImageSearch: false,
        supportsCandidateCount: true,
        supportsInterleaved: true,
        defaultThinking: 'none',
    },
} as const;

export type NanoBananaTier = 'legacy' | 'fast' | 'pro';
export type NanoBananaModelId = typeof FUNCTION_AI_MODELS.IMAGE[keyof typeof FUNCTION_AI_MODELS.IMAGE];
export type FunctionAIModels = typeof FUNCTION_AI_MODELS;
