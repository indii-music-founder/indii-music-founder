/**
 * AI Model Configuration for Cloud Functions
 * 
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side AI_MODELS config where applicable.
 */

export const FUNCTION_AI_MODELS = {
    IMAGE: {
        GENERATION: 'gemini-3-pro-image-preview',
        FAST: 'gemini-2.5-flash-image',
    },
    TEXT: {
        FAST: 'gemini-3-flash-preview',
        PRO: 'gemini-3-pro-preview',
    },
    VIDEO: {
        GENERATION: 'veo-3.1-generate-preview',
    },
    SPEECH: {
        GENERATION: 'gemini-2.5-pro-tts',
    }
} as const;

export type FunctionAIModels = typeof FUNCTION_AI_MODELS;
