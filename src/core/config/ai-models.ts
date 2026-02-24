import { z } from 'zod';

/**
 * AI Model Configuration
 *
 * CRITICAL: This file defines the ONLY approved AI models for this application.
 * See MODEL_POLICY.md for the full policy.
 */

// Approved model categories and IDs
export const APPROVED_MODELS = {
    TEXT_AGENT: 'gemini-3.1-pro-preview',
    TEXT_FAST: 'gemini-3-flash-preview',
    IMAGE_GEN: 'gemini-3-pro-image-preview',
    IMAGE_FAST: 'gemini-3-pro-image-preview',
    AUDIO_PRO: 'gemini-3.1-pro-preview',
    AUDIO_FLASH: 'gemini-3-flash-preview',
    AUDIO_TTS: 'gemini-2.5-pro-preview-tts',
    VIDEO_PRO: 'veo-3.1-generate-preview',
    VIDEO_FAST: 'veo-3.1-fast-generate-preview',
    VIDEO_GEN: 'veo-3.1-generate-preview', // Alias for backward compatibility
    BROWSER_AGENT: 'gemini-3.1-pro-preview',
    EMBEDDING_DEFAULT: 'models/embedding-001'
} as const;

export const AI_MODELS = {
    TEXT: {
        AGENT: APPROVED_MODELS.TEXT_AGENT,
        FAST: APPROVED_MODELS.TEXT_FAST,
    },
    IMAGE: {
        GENERATION: APPROVED_MODELS.IMAGE_GEN,
        FAST: APPROVED_MODELS.IMAGE_FAST,
    },
    AUDIO: {
        PRO: APPROVED_MODELS.AUDIO_PRO,
        FLASH: APPROVED_MODELS.AUDIO_FLASH,
        TTS: APPROVED_MODELS.AUDIO_TTS,
    },
    VIDEO: {
        PRO: APPROVED_MODELS.VIDEO_PRO,
        FAST: APPROVED_MODELS.VIDEO_FAST,
        EDIT: APPROVED_MODELS.VIDEO_PRO,
        GENERATION: APPROVED_MODELS.VIDEO_PRO // Backward compatibility
    },
    BROWSER: {
        AGENT: APPROVED_MODELS.BROWSER_AGENT,
    },
    EMBEDDING: {
        DEFAULT: APPROVED_MODELS.EMBEDDING_DEFAULT,
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
    MEDIA_RESOLUTION: {
        DEFAULT: 'MEDIA_RESOLUTION_HIGH',
        LOW: 'MEDIA_RESOLUTION_LOW'
    },
    IMAGE: {
        DEFAULT: {
            imageConfig: { imageSize: '4K' }, // Nano Banana Pro supports up to 4K
            mediaResolution: 'MEDIA_RESOLUTION_HIGH',
            maxReferenceImages: 14
        },
        FAST: {
            imageConfig: { imageSize: '1K' }, // Nano Banana Flash supports up to 1K
            mediaResolution: 'MEDIA_RESOLUTION_LOW',
            maxReferenceImages: 8
        }
    },
    VIDEO: {
        MIN_TIMEOUT_MS: 120000,
        TIMEOUT_PER_SECOND_MS: 12000,
        MAX_TIMEOUT_MS: 600000,
        DEFAULT_DURATION_SECONDS: 8,
        RESOLUTIONS: {
            SD: '720p',
            HD: '1080p',
            UHD: '4k'
        }
    }
} as const;

/**
 * Model Pricing (USD per 1M tokens) 
 * 
 * Data sourced from Nano Banana series specifications:
 * - Pro: $120.00 / 1M Output
 * - Flash: $30.00 / 1M Output
 */
export const MODEL_PRICING = {
    'gemini-3.1-pro-preview': { input: 2.50, output: 7.50 },
    'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
    'gemini-3-pro-image-preview': { output: 120.00, resolution: "4K", capacity: 14 },
    'veo-3.1-generate-preview': {
        perSecond: 0.20,     // 720p/1080p Video Only
        perSecond4K: 0.40,   // 4K Video Only
        audioAddOn: 0.20     // Flat add-on for audio (up to 1080p)
    },
    'veo-3.1-fast-generate-preview': {
        perSecond: 0.10,     // 720p/1080p Video Only
        perSecond4K: 0.30,   // 4K Video Only
        audioAddOn: 0.05     // Flat add-on for audio
    },
    'gemini-2.5-pro-preview-tts': { input: 0.60, output: 4.00 },
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

const FORBIDDEN_PATTERNS: RegExp[] = [
    /gemini-1\./i,            // Block all legacy 1.x models
    /gemini-2\.0/i,           // Block 2.0 models — allow 2.5.x (TTS, image, pro, flash)
    /imagen-3/i,
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
export type AudioModel = typeof AI_MODELS.AUDIO[keyof typeof AI_MODELS.AUDIO];
export type VideoModel = typeof AI_MODELS.VIDEO[keyof typeof AI_MODELS.VIDEO];
export type BrowserModel = typeof AI_MODELS.BROWSER[keyof typeof AI_MODELS.BROWSER];

/**
 * Reverse lookup to find the configuration key for a given model ID.
 * Used by RemoteConfig to find overrides.
 */
export function getModelKey(modelId: string): keyof typeof APPROVED_MODELS | undefined {
    const entry = Object.entries(APPROVED_MODELS).find(([_, value]) => value === modelId);
    return entry ? (entry[0] as keyof typeof APPROVED_MODELS) : undefined;
}
