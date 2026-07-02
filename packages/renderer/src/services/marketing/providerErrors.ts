/**
 * Typed errors for marketing provider integrations (ISSUE-667).
 *
 * When a provider Cloud Function is not deployed or a provider account is not
 * configured, services throw this instead of returning fabricated fallback
 * states (queued blasts, 'pending' statuses, zero-filled analytics).
 */

export class MarketingProviderUnavailableError extends Error {
    readonly code = 'marketing/provider-unavailable';
    readonly provider: string;

    constructor(provider: string, detail: string, options?: { cause?: unknown }) {
        super(`${provider} integration unavailable: ${detail}`, options);
        this.name = 'MarketingProviderUnavailableError';
        this.provider = provider;
    }
}

export const isProviderUnavailable = (e: unknown): e is MarketingProviderUnavailableError =>
    e instanceof MarketingProviderUnavailableError;
