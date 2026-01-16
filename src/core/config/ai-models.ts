import { z } from 'zod';

/**
 * AI Model Configuration
 *
 * CRITICAL: This file defines the ONLY approved AI models for this application.
 * See MODEL_POLICY.md for the full policy.
 */

// Approved model categories and IDs
export const APPROVED_MODELS = {
    TEXT_AGENT: 'gemini-3-pro-preview',
    TEXT_FAST: 'gemini-3-flash-preview',
    IMAGE_GEN: 'gemini-3-pro-image-preview',
    AUDIO_PRO: 'gemini-2.5-pro-tts',
    AUDIO_FLASH: 'gemini-2.5-flash-tts',
    VIDEO_GEN: 'veo-3.1-generate-preview',
    BROWSER_AGENT: 'gemini-2.5-pro-ui-checkpoint'
} as const;

export const AI_MODELS = {
    TEXT: {
        AGENT: APPROVED_MODELS.TEXT_AGENT,
        FAST: APPROVED_MODELS.TEXT_FAST,
    },
    IMAGE: {
        GENERATION: APPROVED_MODELS.IMAGE_GEN,
    },
    AUDIO: {
        PRO: APPROVED_MODELS.AUDIO_PRO,
        FLASH: APPROVED_MODELS.AUDIO_FLASH,
    },
    VIDEO: {
        GENERATION: APPROVED_MODELS.VIDEO_GEN,
        EDIT: APPROVED_MODELS.VIDEO_GEN
    },
    BROWSER: {
        AGENT: APPROVED_MODELS.BROWSER_AGENT,
    }
} as const;

// Zod schema for runtime validation
export const ModelIdSchema = z.enum(Object.values(APPROVED_MODELS) as [string, ...string[]]);

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
    },
    VIDEO: {
        MIN_TIMEOUT_MS: 120000,
        TIMEOUT_PER_SECOND_MS: 12000,
        MAX_TIMEOUT_MS: 600000,
        DEFAULT_DURATION_SECONDS: 8,
    }
} as const;

/**
 * Model Pricing (Approximate USD per 1M tokens or per generation)
 */
export const MODEL_PRICING = {
    [APPROVED_MODELS.TEXT_AGENT]: { input: 1.25, output: 3.75 },
    [APPROVED_MODELS.TEXT_FAST]: { input: 0.10, output: 0.40 },
    [APPROVED_MODELS.IMAGE_GEN]: { perGeneration: 0.02 },
    [APPROVED_MODELS.VIDEO_GEN]: { perGeneration: 0.05 },
    [APPROVED_MODELS.AUDIO_PRO]: { perGeneration: 0.01 },
    [APPROVED_MODELS.AUDIO_FLASH]: { perGeneration: 0.005 },
    [APPROVED_MODELS.BROWSER_AGENT]: { input: 1.25, output: 3.75 },
} as const;

/**
 * Calculate video generation timeout based on duration
 */
export function calculateVideoTimeout(durationSeconds: number): number {
    const { MIN_TIMEOUT_MS, TIMEOUT_PER_SECOND_MS, MAX_TIMEOUT_MS } = AI_CONFIG.VIDEO;
    const calculated = Math.max(MIN_TIMEOUT_MS, durationSeconds * TIMEOUT_PER_SECOND_MS);
    return Math.min(calculated, MAX_TIMEOUT_MS);
}

// ============================================================================
// RUNTIME VALIDATION
// ============================================================================

const FORBIDDEN_PATTERNS = [
    /gemini-1\./i,
    /gemini-2\.0/i,
    /^gemini-pro$/i,
    /gemini-pro-vision/i,
];

function validateModels(): void {
    const allModels = Object.values(APPROVED_MODELS);

    for (const modelId of allModels) {
        // Zod validation
        const result = ModelIdSchema.safeParse(modelId);
        if (!result.success) {
            throw new Error(`INTERNAL ERROR: Model ${modelId} not in APPROVED_MODELS list.`);
        }

        // Pattern validation
        for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(modelId)) {
                const errorMessage = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        FORBIDDEN MODEL DETECTED                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Model ID: ${modelId.padEnd(64)}║
║                                                                              ║
║  This model is BANNED by MODEL_POLICY.md.                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;
                console.error(errorMessage);
                throw new Error(`FORBIDDEN MODEL: ${modelId}. See MODEL_POLICY.md for approved models.`);
            }
        }
    }
}

// Run validation on module load
validateModels();

// Export type helpers
export type TextModel = typeof AI_MODELS.TEXT[keyof typeof AI_MODELS.TEXT];
export type ImageModel = typeof AI_MODELS.IMAGE[keyof typeof AI_MODELS.IMAGE];
export type VideoModel = typeof AI_MODELS.VIDEO[keyof typeof AI_MODELS.VIDEO];
export type BrowserModel = typeof AI_MODELS.BROWSER[keyof typeof AI_MODELS.BROWSER];
