import { SubscriptionTier } from '../../shared/subscription/types';
import { GEMINI_38_FLASH_STANDARD_NON_GLOBAL_PRICING } from '@indii/shared';

const FREE_MAX_OUTPUT_TOKENS = 1_024;
const PAID_MAX_OUTPUT_TOKENS = 8_192;

/** Clamp client hints to a server-owned tier limit; missing hints still cap output. */
export function clampTextStreamOutputTokens(value: unknown, tier: SubscriptionTier): number {
    const cap = tier === SubscriptionTier.FREE ? FREE_MAX_OUTPUT_TOKENS : PAID_MAX_OUTPUT_TOKENS;
    if (typeof value !== 'number' || !Number.isFinite(value)) return cap;
    return Math.min(cap, Math.max(1, Math.floor(value)));
}

const GEMINI_4_THINKING_LEVELS: Readonly<Partial<Record<string, readonly string[]>>> = {
    'gemini-4-neon': ['LOW', 'MEDIUM', 'HIGH', 'XHIGH'],
    'gemini-4-argon': ['LOW', 'MEDIUM', 'HIGH'],
    'gemini-4-carbon': ['LOW', 'MEDIUM', 'HIGH'],
    'gemini-4-hydrogen': ['LOW', 'MEDIUM', 'HIGH', 'XHIGH'],
};

/**
 * Server-side thinkingConfig alignment for Gemini 4 models (e.g. gemini-4-neon).
 * Strips unsupported legacy `thinkingBudget`, maps `MINIMAL` or `thinkingBudget: 0`
 * to `LOW`, and rejects unsupported thinking levels before Vertex AI rejects with 400.
 */
export function sanitizeTextStreamThinkingConfig(model: string, value: unknown): Record<string, unknown> | undefined {
    const supportedLevels = Object.prototype.hasOwnProperty.call(GEMINI_4_THINKING_LEVELS, model)
        ? GEMINI_4_THINKING_LEVELS[model]
        : undefined;
    if (!supportedLevels) {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const { thinkingBudget, thinkingLevel, ...preferences } = value as Record<string, unknown>;
    const level = typeof thinkingLevel === 'string' ? thinkingLevel.toUpperCase() : undefined;
    if (thinkingLevel !== undefined && (level === undefined || (!supportedLevels.includes(level) && level !== 'MINIMAL'))) {
        throw new Error(`Unsupported thinking level for ${model}; use ${supportedLevels.join(', ')}.`);
    }
    const supportedLevel = level !== undefined && supportedLevels.includes(level)
        ? level
        : level === 'MINIMAL' || thinkingBudget === 0
            ? 'LOW'
            : undefined;
    return { ...preferences, ...(supportedLevel ? { thinkingLevel: supportedLevel } : {}) };
}

/** Lower bound that a claimed reservation must cover before provider submission. */
export function minimumTextStreamReservationCost(contents: unknown, config: Record<string, unknown>, model: string): number {
    const serialized = JSON.stringify({ contents, systemInstruction: config.systemInstruction, tools: config.tools });
    if (typeof serialized !== 'string') throw new Error('Invalid stream request for cost estimation');
    const neon = model === 'gemini-4-neon';
    const argon = model === 'gemini-4-argon';
    const flashLite = model === 'gemini-3.1-flash-lite';
    const flash38 = model === 'gemini-3.8-flash';
    const flash = model === 'gemini-3-flash-preview' || model === 'gemini-2.5-flash';
    // Non-global regional Standard list prices; do not assume promotional credits.
    // Neon: $3.30/$16.50 regional ($3.00/$15.00 global); Argon: $4.40/$22.00.
    const inputRate = neon ? 3.30 : argon ? 4.40 : flash38 ? GEMINI_38_FLASH_STANDARD_NON_GLOBAL_PRICING.inputPerMillion : flashLite ? 0.04 : flash ? 0.15 : 1.25;
    const outputRate = neon ? 16.50 : argon ? 22 : flash38 ? GEMINI_38_FLASH_STANDARD_NON_GLOBAL_PRICING.outputPerMillion : flashLite ? 0.20 : flash ? 0.60 : 10;
    const outputTokens = config.maxOutputTokens;
    if (typeof outputTokens !== 'number' || !Number.isSafeInteger(outputTokens) || outputTokens < 1) {
        throw new Error('Invalid bounded stream output limit');
    }
    const estimate = (Math.ceil(serialized.length / 4) * inputRate + outputTokens * outputRate) / 1_000_000;
    return Math.max(0.001, Math.ceil(estimate * 100_000) / 100_000);
}

export function reservationCoversTextStreamCost(reserved: unknown, required: number): boolean {
    return typeof reserved === 'number' && Number.isFinite(reserved) && reserved + 0.000001 >= required;
}
