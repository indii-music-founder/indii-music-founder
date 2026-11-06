import { SubscriptionTier } from '../../shared/subscription/types';

const FREE_MAX_OUTPUT_TOKENS = 1_024;
const PAID_MAX_OUTPUT_TOKENS = 8_192;

/** Clamp client hints to a server-owned tier limit; missing hints still cap output. */
export function clampTextStreamOutputTokens(value: unknown, tier: SubscriptionTier): number {
    const cap = tier === SubscriptionTier.FREE ? FREE_MAX_OUTPUT_TOKENS : PAID_MAX_OUTPUT_TOKENS;
    const requested = Number(value);
    if (!Number.isFinite(requested)) return cap;
    return Math.min(cap, Math.max(1, Math.floor(requested)));
}

/** Lower bound that a claimed reservation must cover before provider submission. */
export function minimumTextStreamReservationCost(contents: unknown, config: Record<string, unknown>, model: string): number {
    const serialized = JSON.stringify({ contents, systemInstruction: config.systemInstruction, tools: config.tools });
    if (typeof serialized !== 'string') throw new Error('Invalid stream request for cost estimation');
    const argon = model === 'gemini-4-argon';
    const flashLite = model === 'gemini-3.1-flash-lite';
    const flash = model === 'gemini-3.8-flash' || model === 'gemini-3-flash-preview' || model === 'gemini-2.5-flash';
    // Non-global Standard Argon list price; do not assume promotional credits.
    // https://cloud.google.com/model-garden/pricing (verified 2026-11-05).
    const inputRate = argon ? 4.40 : flashLite ? 0.04 : flash ? 0.15 : 1.25;
    const outputRate = argon ? 22 : flashLite ? 0.20 : flash ? 0.60 : 10;
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
