"use strict";
/**
 * AI Model Configuration for Cloud Functions
 *
 * Centralized model IDs to avoid hardcoding and ensure consistency.
 * These should align with the client-side AI_MODELS config where applicable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUNCTION_AI_MODELS = void 0;
exports.FUNCTION_AI_MODELS = {
    IMAGE: {
        GENERATION: 'gemini-2.5-pro',
        FAST: 'gemini-2.5-flash',
    },
    TEXT: {
        FAST: 'gemini-2.5-flash',
        PRO: 'gemini-2.5-pro',
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
        ANALYSIS: 'gemini-2.5-pro', // Multimodal audio support
    }
};
//# sourceMappingURL=models.js.map