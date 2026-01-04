/**
 * InputSanitizer
 * Utilities for sanitizing and validating inputs before sending to AI models.
 * Helps prevent injection attacks and reduces token usage from malformed input.
 */

export class InputSanitizer {
    private static readonly MAX_PROMPT_LENGTH = 100000; // Reasonable limit for checking, though models support more
    private static readonly CONTROL_CHARS_REGEX = /[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g;
    private static readonly DANGEROUS_TAGS_REGEX = /<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>|<(script|style|iframe|object|embed|form)[^>]*\/?>/gi;

    /**
     * Sanitizes a string prompt.
     * - Trims whitespace
     * - Removes control characters
     * - Strips dangerous HTML tags
     * - Enforces max length (truncates)
     */
    static sanitize(input: string): string {
        if (!input) return '';

        // 1. Remove dangerous tags first
        let clean = input.replace(this.DANGEROUS_TAGS_REGEX, '');

        // 2. Remove control characters (keep newlines/tabs)
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
