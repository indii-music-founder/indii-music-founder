/**
 * AI Model Configuration
 *
 * CRITICAL: This file defines the ONLY approved AI models for this application.
 * See MODEL_POLICY.md for the full policy.
 *
 * FORBIDDEN MODELS (will cause runtime errors):
 * - gemini-1.5-flash, gemini-1.5-pro (and all 1.x variants)
 * - gemini-2.0-flash, gemini-2.0-pro (and all 2.0 variants)
 * - gemini-pro, gemini-pro-vision (legacy)
 *
 * APPROVED MODELS ONLY:
 * - gemini-3-pro-preview (complex reasoning)
 * - gemini-3-flash-preview (fast tasks)
 * - gemini-3-pro-image-preview (image generation)
 * - gemini-3-pro-image-preview (image generation)
 * - veo-3.1-generate-preview (video generation)
 * - gemini-2.5-pro-ui-checkpoint (browser actuation)
 */

export const AI_MODELS = {
    TEXT: {
        AGENT: 'gemini-3-pro-preview', // Upgraded for better reasoning
        // Faster model for routing and simple tasks
        FAST: 'gemini-3-flash-preview',
    },
    IMAGE: {
        // Main image generation model (Nano Banana Pro)
        GENERATION: 'gemini-3-pro-image-preview',
    },
    AUDIO: {
        // Upgraded TTS models (Stable)
        PRO: 'gemini-2.5-pro-tts',
        FLASH: 'gemini-2.5-flash-tts',
    },
    VIDEO: {
        // Video generation model
        GENERATION: 'veo-3.1-generate-preview',
        EDIT: 'veo-3.1-generate-preview'
    },
    BROWSER: {
        // Model optimized for browser interaction and UI control
        AGENT: 'gemini-2.5-pro-ui-checkpoint',
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

// ============================================================================
// RUNTIME VALIDATION - DO NOT REMOVE
// This validation runs on module load and will crash the app if forbidden
// models are detected. This is INTENTIONAL to prevent silent degradation.
// ============================================================================

const FORBIDDEN_PATTERNS = [
    /gemini-1\./i,      // All Gemini 1.x models
    /gemini-2\.0/i,     // All Gemini 2.0 models
    /^gemini-pro$/i,    // Legacy gemini-pro
    /gemini-pro-vision/i, // Legacy vision model
];

function validateModels(): void {
    const allModels: string[] = [];

    // Collect all model IDs from the config
    Object.values(AI_MODELS).forEach(category => {
        Object.values(category).forEach(modelId => {
            if (typeof modelId === 'string') {
                allModels.push(modelId);
            }
        });
    });

    // Check each model against forbidden patterns
    for (const modelId of allModels) {
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(modelId)) {
                const errorMessage = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        FORBIDDEN MODEL DETECTED                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Model ID: ${modelId.padEnd(64)}║
║                                                                              ║
║  This model is BANNED by MODEL_POLICY.md.                                    ║
║                                                                              ║
║  APPROVED MODELS ONLY:                                                       ║
║    - gemini-3-pro-preview (complex reasoning)                                ║
║    - gemini-3-flash-preview (fast tasks)                                     ║
║    - gemini-3-pro-image-preview (image generation)                           ║
║    - gemini-2.5-pro-tts (advanced audio)                                     ║
║    - gemini-2.5-flash-tts (fast audio)                                       ║
║    - gemini-2.5-flash-tts (fast audio)                                       ║
║    - veo-3.1-generate-preview (video generation)                             ║
║    - gemini-2.5-pro-ui-checkpoint (browser actuation)                        ║
║                                                                              ║
║  DO NOT use gemini-1.5-*, gemini-2.0-*, or legacy gemini-pro models.         ║
║                                                                              ║
║  Fix: Update src/core/config/ai-models.ts to use approved models only.       ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;
                console.error(errorMessage);
                throw new Error(`FORBIDDEN MODEL: ${modelId}. See MODEL_POLICY.md for approved models.`);
            }
        }
    }

    // Log successful validation in development
    if (import.meta.env?.DEV) {
        console.log('[AI_MODELS] Model policy validation passed. All models are approved.');
    }
}

// Run validation on module load
validateModels();

// Export type helpers for type-safe model usage
export type TextModel = typeof AI_MODELS.TEXT[keyof typeof AI_MODELS.TEXT];
export type ImageModel = typeof AI_MODELS.IMAGE[keyof typeof AI_MODELS.IMAGE];
export type VideoModel = typeof AI_MODELS.VIDEO[keyof typeof AI_MODELS.VIDEO];
export type BrowserModel = typeof AI_MODELS.BROWSER[keyof typeof AI_MODELS.BROWSER];
