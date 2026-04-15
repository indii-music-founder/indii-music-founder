import { z } from 'zod';
import { logger } from '@/utils/logger';

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
    IMAGE_GEN: 'gemini-3-pro-preview',           // Native image gen via responseModalities
    IMAGE_FAST: 'gemini-3-flash-preview',         // Fast image gen via responseModalities
    // Direct mode — bleeding-edge preview models for client-side SDK calls
    DIRECT_PRO: 'gemini-3-pro-image-preview',      // Nano Banana Pro — highest quality, 4K, 14 ref images
    DIRECT_FAST: 'gemini-3.1-flash-image-preview',  // Nano Banana 2 — fast + Pro quality, 4K, grounding
    DIRECT_LEGACY: 'gemini-2.5-flash-image',        // Nano Banana OG — high-volume, low-latency
    AUDIO_PRO: 'gemini-3-pro-preview',
    AUDIO_FLASH: 'gemini-3-flash-preview',
    AUDIO_TTS: 'gemini-2.5-pro-tts',
    VIDEO_PRO: 'veo-3.1-generate-preview',
    VIDEO_FAST: 'veo-3.1-fast-generate-preview',   // Fast mode — lower latency, lower cost
    VIDEO_LITE: 'veo-3.1-lite-generate-preview',   // Lite mode — lowest cost, good quality
    VIDEO_GEN: 'veo-3.1-generate-preview',    // Alias for backward compatibility
    BROWSER_AGENT: 'gemini-3-pro-preview',
    EMBEDDING_DEFAULT: 'gemini-embedding-001'
} as const;

export const AI_MODELS = {
    TEXT: {
        AGENT: APPROVED_MODELS.TEXT_AGENT,
        FAST: APPROVED_MODELS.TEXT_FAST,
    },
    IMAGE: {
        GENERATION: APPROVED_MODELS.IMAGE_GEN,
        FAST: APPROVED_MODELS.IMAGE_FAST,
        DIRECT_PRO: APPROVED_MODELS.DIRECT_PRO,
        DIRECT_FAST: APPROVED_MODELS.DIRECT_FAST,
        DIRECT_LEGACY: APPROVED_MODELS.DIRECT_LEGACY,
    },
    AUDIO: {
        PRO: APPROVED_MODELS.AUDIO_PRO,
        FLASH: APPROVED_MODELS.AUDIO_FLASH,
        TTS: APPROVED_MODELS.AUDIO_TTS,
    },
    VIDEO: {
        PRO: APPROVED_MODELS.VIDEO_PRO,
        FAST: APPROVED_MODELS.VIDEO_FAST,
        LITE: APPROVED_MODELS.VIDEO_LITE,
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
    TEXT: {
        /** Default maxOutputTokens for Pro model — safety cap for cost control */
        MAX_OUTPUT_TOKENS_AGENT: 8192,
        /** Default maxOutputTokens for Flash model — lower cap for fast tasks */
        MAX_OUTPUT_TOKENS_FAST: 4096,
        /** Default maxOutputTokens applied to all calls unless overridden */
        MAX_OUTPUT_TOKENS_DEFAULT: 8192,
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
            imageConfig: { imageSize: '1K' }, // Nano Banana 2 (Flash) supports up to 1K
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
    },
    EMBEDDING: {
        DIMENSIONS: 768, // MRL: supported values are 768, 1536, or 3072
    }
} as const;

/**
 * Model Pricing (USD per 1M tokens for text; per second for video)
 *
 * gemini-2.5-pro:   $1.25 input / $10.00 output per 1M tokens
 * gemini-2.5-flash: $0.15 input /  $0.60 output per 1M tokens
 */
export const MODEL_PRICING = {
    'gemini-3-pro-preview': { input: 1.25, output: 10.00 },
    'gemini-3-flash-preview': { input: 0.15, output: 0.60 },
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
    'veo-3.1-lite-generate-preview': {
        perSecond: 0.05,     // 720p/1080p Video Only — lowest cost tier
        audioAddOn: 0.02     // Flat add-on for audio
    },
    'gemini-2.5-pro-tts': { input: 0.60, output: 4.00 },
    // Direct mode image models (token-based pricing, same tier as text)
    'gemini-3-pro-image-preview': { input: 1.25, output: 10.00 },
    'gemini-3.1-flash-image-preview': { input: 0.15, output: 0.60 },
    // Nano Banana OG (legacy tier)
    'gemini-2.5-flash-image': { input: 0.10, output: 0.40 },
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
    /gemini-2\.0/i,           // Block 2.0 models — allow 2.5.x (TTS + Nano Banana OG)
    /imagen/i,                // Block all Imagen models (replaced by Nano Banana)
    // NOTE: gemini-2.5-flash-image (Nano Banana OG) is ALLOWED for high-volume/low-latency
    // NOTE: gemini-3-pro-image-preview and gemini-3.1-flash-image-preview are ALLOWED (Direct mode)
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
                logger.error(errorMessage);
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
