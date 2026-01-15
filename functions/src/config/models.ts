/**
 * AI Model Configuration for Cloud Functions
 * 
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side AI_MODELS config where applicable.
 */

export const FUNCTION_AI_MODELS = {
    IMAGE: {
        GENERATION: 'gemini-3-pro-image-preview',
    },
    TEXT: {
        FAST: 'gemini-3-flash-preview',
        PRO: 'gemini-3-pro-preview',
    }
} as const;

export type FunctionAIModels = typeof FUNCTION_AI_MODELS;
