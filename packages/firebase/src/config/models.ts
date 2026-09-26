/**
 * Intelligence Model Configuration for Cloud Functions
 * 
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side INTELLIGENCE_MODELS config where applicable.
 * 
 * Nano Banana Model Tiers:
 *   LEGACY  → gemini-2.5-flash-image       (OG, high-volume / low-latency)
 *   FAST    → gemini-3.1-flash-image       (Nano Banana 2, GA model)
 *   PRO     → gemini-3-pro-image           (Nano Banana Pro, GA model)
 */

export const FUNCTION_INTELLIGENCE_MODELS = {
    IMAGE: {
        /** Nano Banana Pro — highest quality, 4K, advanced thinking */
        GENERATION: 'gemini-3-pro-image',
        /** Nano Banana 2 — fast + quality, 4K */
        FAST: 'gemini-3.1-flash-image',
        /** Nano Banana OG — legacy, high-volume / low-latency */
        LEGACY: 'gemini-2.5-flash-image',
    },
    TEXT: {
        FAST: 'gemini-3.8-flash',
        LITE: 'gemini-3.1-flash-lite',
        PRO: 'gemini-3.1-pro-preview',
    },
    VIDEO: {
        GENERATION: 'veo-3.1-generate-001',
        PRO: 'veo-3.1-generate-001',
        FAST: 'veo-3.1-fast-generate-001',
        LITE: 'veo-3.1-lite-generate-001',
        /** Gemini Omni 1.1 GA — resolution, interpolation, and extension. */
        OMNI: 'gemini-omni-1.1-flash',
    },
    SPEECH: {
        GENERATION: 'gemini-3.1-flash-tts-preview',
    },
    AUDIO: {
        ANALYSIS: 'gemini-3.8-flash', // Multimodal audio support via Gemini 3.8 Flash
    }
} as const;

/**
 * Nano Banana Capability Registry — canonical copy lives in @indii/shared
 * (packages/shared/src/modelCapabilities.ts, ISSUE-320). Re-exported here so
 * all Cloud Function consumers keep their existing import path.
 */
export { NANO_BANANA_CAPABILITIES } from '@indii/shared';

/** Normalized membership tier name across the platform. */
export type NanoBananaTier = 'legacy' | 'fast' | 'pro';

/** Valid model identifiers specifically for image-related operations. */
export type NanoBananaModelId = typeof FUNCTION_INTELLIGENCE_MODELS.IMAGE[keyof typeof FUNCTION_INTELLIGENCE_MODELS.IMAGE];

/** Full type metadata for all registered Cloud Function Intelligence models. */
export type FunctionIntelligenceModels = typeof FUNCTION_INTELLIGENCE_MODELS;
