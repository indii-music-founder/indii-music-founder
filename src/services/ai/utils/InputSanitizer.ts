/**
 * InputSanitizer
 * Utilities for sanitizing and validating inputs before sending to AI models.
 * Helps prevent injection attacks and reduces token usage from malformed input.
 */

export class InputSanitizer {
    private static readonly MAX_PROMPT_LENGTH = 100000; // Reasonable limit for checking, though models support more
    // eslint-disable-next-line no-control-regex
    private static readonly CONTROL_CHARS_REGEX = /[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g;
    private static readonly DANGEROUS_TAGS_REGEX = /<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>|<(script|style|iframe|object|embed|form)[^>]*\/?>/gi;

    // PII & Secret Regexes
    // eslint-disable-next-line no-useless-escape
    private static readonly CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
    private static readonly KEY_VALUE_SECRET_REGEX = /\b(password|passwd|api_key|access_token|secret_key|private_key)(\s*[:=]\s*)([^\s]+)/gi;
    private static readonly STRIPE_KEY_REGEX = /\b(sk_live_[0-9a-zA-Z]+)\b/g;

    /**
     * Sanitizes a string prompt.
     * - Trims whitespace
     * - Removes control characters
     * - Strips dangerous HTML tags
     * - Redacts PII (Credit Cards, Secrets)
     * - Enforces max length (truncates)
     */
    static sanitize(input: string): string {
        if (!input) return '';

        // 1. Remove dangerous tags first
        let clean = input.replace(this.DANGEROUS_TAGS_REGEX, '');

        // 2. Redact PII
        clean = this.redactPII(clean);

        // 3. Remove control characters (keep newlines/tabs)
        clean = clean.replace(this.CONTROL_CHARS_REGEX, '');

        // 3. Trim
        clean = clean.trim();

        // 4. Length check (truncate)
        if (clean.length > this.MAX_PROMPT_LENGTH) {
            console.warn(`[InputSanitizer] Input truncated from ${clean.length} to ${this.MAX_PROMPT_LENGTH}`);
            clean = clean.substring(0, this.MAX_PROMPT_LENGTH);
        }

        return clean;
    }

    /**
     * Validates input against constraints.
     * Returns { valid: boolean, error?: string }
     */
    static validate(input: string): { valid: boolean; error?: string } {
        if (!input || input.trim().length === 0) {
            return { valid: false, error: 'Input cannot be empty.' };
        }

        if (input.length > this.MAX_PROMPT_LENGTH) {
            return { valid: false, error: `Input exceeds maximum length of ${this.MAX_PROMPT_LENGTH} characters.` };
        }

        return { valid: true };
    }

    /**
     * Redacts PII and sensitive keys from the input.
     */
    private static redactPII(input: string): string {
        let redacted = input;

        // Redact Credit Cards
        redacted = redacted.replace(this.CREDIT_CARD_REGEX, '[REDACTED_CREDIT_CARD]');

        // Redact Key-Value Secrets (e.g. password: ***)
        redacted = redacted.replace(this.KEY_VALUE_SECRET_REGEX, '$1$2[REDACTED_SECRET]');

        // Redact Standalone Tokens (e.g. sk_live_***)
        redacted = redacted.replace(this.STRIPE_KEY_REGEX, '[REDACTED_SECRET]');

        return redacted;
    }

    /**
     * Basic check for potential prompt injection patterns.
     * This is a heuristic and not a complete firewall.
     */
    static containsInjectionPatterns(input: string): boolean {
        const lower = input.toLowerCase();
        const injectionPatterns = [
            'ignore previous instructions',
            'ignore all previous instructions',
            'you are no longer',
            'system override',
            'developer mode on'
        ];

        return injectionPatterns.some(pattern => lower.includes(pattern));
    }
}
