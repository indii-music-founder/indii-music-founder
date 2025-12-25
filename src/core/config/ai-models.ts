/**
 * AI Model Configuration
 *
 * This file defines the AI models used throughout the application.
 * Models are selected based on capability and availability.
 *
 * Current Models (Dec 2025):
 * - gemini-2.0-flash-exp: Latest experimental model with thinking support
 * - gemini-1.5-flash: Fast stable model for quick tasks
 * - imagen-3.0-generate-001: Image generation
 * - veo-2.0-generate-001: Video generation (via Vertex AI)
 */

export const AI_MODELS = {
    TEXT: {
        // Primary reasoning model - gemini-2.0-flash-exp has thinking support
        AGENT: 'gemini-2.0-flash-exp',
        // Fast model for routing and simple tasks
        FAST: 'gemini-1.5-flash',
    },
    IMAGE: {
        // Image generation model (Imagen 3)
        GENERATION: 'imagen-3.0-generate-001',
    },
    AUDIO: {
        // TTS models (when available)
        PRO: 'gemini-2.5-pro-tts',
        FLASH: 'gemini-2.5-flash-tts',
    },
    VIDEO: {
        // Video generation model (Vertex AI)
        GENERATION: 'veo-2.0-generate-001',
        EDIT: 'veo-2.0-generate-001'
    }
} as const;

export const AI_CONFIG = {
    THINKING: {
        HIGH: {
            thinkingConfig: { thinkingLevel: "HIGH" }
        },
        LOW: {
            thinkingConfig: { thinkingLevel: "LOW" }
        }
    },
    IMAGE: {
        DEFAULT: {
            imageConfig: { imageSize: '2K' }
        }
    }
} as const;

// Log configured models in development
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.log('[AI_MODELS] Configured models:', AI_MODELS);
}

// Export type helpers for type-safe model usage
export type TextModel = typeof AI_MODELS.TEXT[keyof typeof AI_MODELS.TEXT];
export type ImageModel = typeof AI_MODELS.IMAGE[keyof typeof AI_MODELS.IMAGE];
export type VideoModel = typeof AI_MODELS.VIDEO[keyof typeof AI_MODELS.VIDEO];
