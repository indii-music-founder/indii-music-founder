/**
 * Intelligence Model Configuration for Cloud Functions
 * 
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side INTELLIGENCE_MODELS config where applicable.
 * 
 * Nano Banana Model Tiers:
 *   LEGACY  → gemini-2.5-flash-image       (OG, high-volume / low-latency)
 *   FAST    → gemini-3.1-flash-image-preview (Nano Banana 2, speed + quality)
 *   PRO     → gemini-3-pro-image-preview     (Nano Banana Pro, highest fidelity)
 */

export const FUNCTION_INTELLIGENCE_MODELS = {
    IMAGE: {
        /** Nano Banana Pro — highest quality, 4K, advanced thinking */
        GENERATION: 'gemini-3-pro-image-preview',
        /** Nano Banana — fast + quality, grounding */
        FAST: 'gemini-2.5-flash-image',
        /** Nano Banana OG — legacy, high-volume / low-latency */
        LEGACY: 'gemini-2.5-flash-image',
    },
    TEXT: {
        FAST: 'gemini-3-flash-preview',
        LITE: 'gemini-3-flash-preview',
        PRO: 'gemini-3-pro-preview',
    },
    VIDEO: {
        GENERATION: 'veo-3.1-generate-001',
        PRO: 'veo-3.1-generate-001',
        FAST: 'veo-3.1-fast-generate-001',
        LITE: 'veo-3.1-lite-generate-001',
        /** Gemini Omni public preview — native generation and conversational editing. */
        OMNI: 'gemini-omni-flash-preview',
    },
    SPEECH: {
        GENERATION: 'gemini-3.1-flash-tts-preview',
    },
    AUDIO: {
        ANALYSIS: 'gemini-3-flash-preview', // Multimodal audio support
    }
} as const;

/**
 * Nano Banana Capability Registry
 * 
 * Maps each image model tier to its supported features.
 * When Google ships model updates, change THIS object and everything adapts.
 */
export const NANO_BANANA_CAPABILITIES = {
    'gemini-3-pro-image-preview': {
        tier: 'pro' as const,
        displayName: 'Nano Banana Pro',
        maxResolution: '4K',
        supportedResolutions: ['1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const,
        maxReferenceImages: 11,
        supportsThinkingControl: false,
        supportsGoogleSearch: true,
        supportsImageSearch: false,
        supportsCandidateCount: false,
        supportsInterleaved: true,
        defaultThinking: 'always_on',
    },
    'gemini-2.5-flash-image': {
        tier: 'fast' as const,
        displayName: 'Nano Banana',
        maxResolution: '1K',
        supportedResolutions: ['512', '1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'] as const,
        maxReferenceImages: 14,
        supportsThinkingControl: true,
        supportsGoogleSearch: true,
        supportsImageSearch: true,
        supportsCandidateCount: true,
        supportsInterleaved: true,
        defaultThinking: 'minimal',
    },
    'gemini-3.1-flash-image-preview': {
        tier: 'fast' as const,
        displayName: 'Nano Banana 2',
        maxResolution: '4K',
        supportedResolutions: ['512', '1K', '2K', '4K'] as const,
        supportedAspectRatios: ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'] as const,
        maxReferenceImages: 14,
        supportsThinkingControl: true,
        supportsGoogleSearch: true,
        supportsImageSearch: true,
        supportsCandidateCount: true,
        supportsInterleaved: true,
        defaultThinking: 'minimal',
    },
} as const;

/** Normalized membership tier name across the platform. */
export type NanoBananaTier = 'legacy' | 'fast' | 'pro';

/** Valid model identifiers specifically for image-related operations. */
export type NanoBananaModelId = typeof FUNCTION_INTELLIGENCE_MODELS.IMAGE[keyof typeof FUNCTION_INTELLIGENCE_MODELS.IMAGE];

/** Full type metadata for all registered Cloud Function Intelligence models. */
export type FunctionIntelligenceModels = typeof FUNCTION_INTELLIGENCE_MODELS;
