import { logger } from '@/utils/logger';

/**
 * Model Pricing — Source of Truth for AI Cost Economics
 * ======================================================
 *
 * WHY THIS EXISTS:
 * Token *counts* alone cannot answer "what does a user cost me per month?".
 * Input and output tokens are priced differently (output is typically ~4-8x input),
 * and image/video/speech models are priced per-unit, not per-token. This module is
 * the single place that converts raw usage into estimated USD, broken down per model,
 * so pricing decisions can be grounded in real unit economics instead of guesswork.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️  RATES MUST BE VERIFIED AGAINST GOOGLE'S CURRENT PRICING.              │
 * │                                                                           │
 * │ These are PREVIEW models (gemini-3.x, veo-3.1). Published list prices     │
 * │ change and preview pricing is volatile. The numbers below are documented  │
 * │ baselines, NOT authoritative. Treat estimates as a real-time proxy; the   │
 * │ GCP Billing export remains ground truth for actual spend.                 │
 * │                                                                           │
 * │ To reconcile: compare the rollup from TokenUsageService.getCostSummary()  │
 * │ against the GCP Billing → Reports for the same window, then adjust rates. │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * SOURCE: https://ai.google.dev/gemini-api/docs/pricing  and  Vertex AI pricing.
 */

/** ISO date the rates below were last reconciled. Bump this whenever rates change. */
export const PRICING_LAST_VERIFIED = '2026-06-01';

/** Token-priced models: separate input/output rates per 1,000,000 tokens. */
interface TokenPricing {
    kind: 'token';
    /** USD per 1M input (prompt) tokens. */
    inputPerMillion: number;
    /** USD per 1M output (candidate) tokens. */
    outputPerMillion: number;
}

/** Image-generation models: flat rate per generated image (plus optional prompt-token cost). */
interface ImagePricing {
    kind: 'image';
    /** USD per generated image. */
    perImage: number;
    /** Optional USD per 1M prompt tokens (text portion of the request). */
    inputPerMillion?: number;
}

/** Video-generation models: priced per second of generated footage. */
interface VideoPricing {
    kind: 'video';
    /** USD per second of generated video. */
    perSecond: number;
}

/** Text-to-speech models: priced per 1M characters of input text. */
interface SpeechPricing {
    kind: 'tts';
    /** USD per 1M input characters. */
    perMillionChars: number;
}

export type ModelPricing = TokenPricing | ImagePricing | VideoPricing | SpeechPricing;

/**
 * Per-model pricing table. Keys are the exact model IDs used across the app
 * (see `packages/renderer/src/core/config/intelligence-models.ts` APPROVED_MODELS
 * and `packages/firebase/src/config/models.ts` FUNCTION_INTELLIGENCE_MODELS).
 *
 * Keep this list exhaustive: any model ID that flows through TokenUsageService
 * should have an entry, otherwise cost falls back to a conservative default.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
    // ── Text ────────────────────────────────────────────────────────────────
    'gemini-3.1-pro-preview': { kind: 'token', inputPerMillion: 1.25, outputPerMillion: 10.0 },
    'gemini-3-flash-preview': { kind: 'token', inputPerMillion: 0.30, outputPerMillion: 2.50 },
    'gemini-3.1-flash-lite': { kind: 'token', inputPerMillion: 0.10, outputPerMillion: 0.40 },

    // ── Embeddings ────────────────────────────────────────────────────────────
    'gemini-embedding-001': { kind: 'token', inputPerMillion: 0.15, outputPerMillion: 0.0 },

    // ── Image generation (Nano Banana family) ─────────────────────────────────
    // Image gen reports prompt tokens via usageMetadata; the output is billed per image.
    'gemini-3-pro-image-preview': { kind: 'image', perImage: 0.12, inputPerMillion: 1.25 },
    'gemini-3.1-flash-image-preview': { kind: 'image', perImage: 0.039, inputPerMillion: 0.30 },
    'gemini-2.5-flash-image': { kind: 'image', perImage: 0.039, inputPerMillion: 0.30 },

    // ── Speech (TTS) ──────────────────────────────────────────────────────────
    'gemini-2.5-pro-tts': { kind: 'tts', perMillionChars: 16.0 },

    // ── Video (Veo) ───────────────────────────────────────────────────────────
    'veo-3.1-generate-preview': { kind: 'video', perSecond: 0.40 },
    'veo-3.1-fast-generate-preview': { kind: 'video', perSecond: 0.15 },
    'veo-3.1-lite-generate-preview': { kind: 'video', perSecond: 0.10 },
};

/**
 * Conservative fallback for an unrecognized model ID. We deliberately do NOT
 * return 0 — silently costing nothing would hide real spend and defeat the
 * entire purpose of this module. We assume a mid-tier text rate and log loudly
 * so the missing model gets added to MODEL_PRICING.
 */
const UNKNOWN_MODEL_FALLBACK: TokenPricing = {
    kind: 'token',
    inputPerMillion: 1.25,
    outputPerMillion: 10.0,
};

/** Usage quantities for a single AI call. Only the fields relevant to the model's pricing kind are used. */
export interface UsageUnits {
    /** Prompt/input tokens reported by usageMetadata.promptTokenCount. */
    inputTokens?: number;
    /** Candidate/output tokens reported by usageMetadata.candidatesTokenCount. */
    outputTokens?: number;
    /** Number of images generated (image models). */
    images?: number;
    /** Seconds of video generated (video models). */
    seconds?: number;
    /** Characters of input text (TTS models). */
    characters?: number;
}

/** Look up the pricing entry for a model, falling back conservatively (and loudly) if unknown. */
export function getModelPricing(model: string): ModelPricing {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
        logger.warn(
            `[ModelPricing] No pricing entry for model "${model}". ` +
            `Using conservative fallback ($${UNKNOWN_MODEL_FALLBACK.inputPerMillion}/$${UNKNOWN_MODEL_FALLBACK.outputPerMillion} per 1M). ` +
            `Add it to MODEL_PRICING to get an accurate estimate.`
        );
        return UNKNOWN_MODEL_FALLBACK;
    }
    return pricing;
}

/**
 * Estimate the USD cost of a single AI call.
 *
 * The calculation is driven by the model's pricing `kind`:
 *  - token: (inputTokens · inputRate + outputTokens · outputRate) / 1M
 *  - image: images · perImage  (+ prompt-token cost if rate is defined)
 *  - video: seconds · perSecond
 *  - tts:   characters · perMillionChars / 1M
 *
 * Returns a non-negative number. Missing units are treated as 0 (e.g. a token
 * model called with only inputTokens still produces a valid estimate).
 *
 * @param model  Exact model ID (e.g. 'gemini-3.1-pro-preview').
 * @param units  Usage quantities for this call.
 * @returns Estimated cost in USD.
 */
export function estimateCostUsd(model: string, units: UsageUnits): number {
    const pricing = getModelPricing(model);
    const inputTokens = Math.max(0, units.inputTokens ?? 0);
    const outputTokens = Math.max(0, units.outputTokens ?? 0);

    switch (pricing.kind) {
        case 'token': {
            const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
            const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
            return inputCost + outputCost;
        }
        case 'image': {
            const images = Math.max(0, units.images ?? 0);
            const imageCost = images * pricing.perImage;
            const promptCost = pricing.inputPerMillion
                ? (inputTokens / 1_000_000) * pricing.inputPerMillion
                : 0;
            return imageCost + promptCost;
        }
        case 'video': {
            const seconds = Math.max(0, units.seconds ?? 0);
            return seconds * pricing.perSecond;
        }
        case 'tts': {
            const characters = Math.max(0, units.characters ?? 0);
            return (characters / 1_000_000) * pricing.perMillionChars;
        }
        default: {
            // Exhaustiveness guard: if a new pricing kind is added without a branch,
            // TypeScript flags this at compile time and we fail safe to 0 at runtime.
            const _exhaustive: never = pricing;
            logger.error('[ModelPricing] Unhandled pricing kind', _exhaustive);
            return 0;
        }
    }
}

/**
 * Firestore map keys cannot contain '.' (it denotes a nested field path), and
 * model IDs like 'gemini-3.1-pro-preview' contain dots. Sanitize to a safe key
 * for use in per-model cost breakdown maps.
 */
export function sanitizeModelKey(model: string): string {
    return model.replace(/[.#$/[\]]/g, '_');
}
