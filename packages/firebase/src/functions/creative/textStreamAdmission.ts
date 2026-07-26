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
