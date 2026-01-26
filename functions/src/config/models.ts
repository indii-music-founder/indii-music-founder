/**
 * AI Model Configuration for Cloud Functions
 * 
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side AI_MODELS config where applicable.
 */

export const FUNCTION_AI_MODELS = {
    IMAGE: {
        GENERATION: 'gemini-3-pro-image-preview',
        FAST: 'gemini-3-pro-image-preview', // Force Pro Image (Imagen 3) as Flash Text cannot generate images
    },
    TEXT: {
        FAST: 'gemini-3-flash-preview',
        PRO: 'gemini-3-pro-preview',
    },
    VIDEO: {
        GENERATION: 'veo-3.1-generate-preview',
        FAST: 'veo-2.0-generate-001',
    },
    SPEECH: {
        GENERATION: 'gemini-2.5-pro-tts',
    }
} as const;

export type FunctionAIModels = typeof FUNCTION_AI_MODELS;
