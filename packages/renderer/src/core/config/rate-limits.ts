/**
 * Rate Limit Configuration
 * Defines quota limits for AI usage tiers.
 */

export const RATE_LIMITS = {
    FREE_TIER: {
        MAX_TOKENS_PER_DAY: 100_000,
        MAX_REQUESTS_PER_MINUTE: 10
    },
    PRO_TIER: {
        MAX_TOKENS_PER_DAY: 1_000_000,
        MAX_REQUESTS_PER_MINUTE: 60
    }
};

export const TIER_CONFIG = {
    DEFAULT_TIER: 'FREE_TIER' as keyof typeof RATE_LIMITS
};
