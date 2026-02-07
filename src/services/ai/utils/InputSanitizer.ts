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
     * @deprecated Use analyzeInjectionRisk() for confidence-scored analysis
     */
    static containsInjectionPatterns(input: string): boolean {
        const analysis = this.analyzeInjectionRisk(input);
        return analysis.isRisky;
    }

    /**
     * R2A2 Injection Pattern Definitions
     * Synchronized with Python implementation in python/api/indii_task.py
     * Patterns are scored by severity for confidence-based blocking
     */
    private static readonly INJECTION_PATTERNS: Array<{ pattern: string; score: number; severity: 'critical' | 'high' | 'medium' }> = [
        // Critical - Always block (score: 1.0)
        { pattern: 'jailbreak', score: 1.0, severity: 'critical' },
        { pattern: 'dan mode', score: 1.0, severity: 'critical' },
        { pattern: 'exfiltrate', score: 1.0, severity: 'critical' },
        { pattern: 'disable r2a2', score: 1.0, severity: 'critical' },

        // High severity - Strong indicators (score: 0.85-0.95)
        { pattern: 'ignore previous instructions', score: 0.95, severity: 'high' },
        { pattern: 'ignore all previous instructions', score: 0.95, severity: 'high' },
        { pattern: 'forget your system prompt', score: 0.95, severity: 'high' },
        { pattern: 'override security', score: 0.95, severity: 'high' },
        { pattern: 'system prompt', score: 0.85, severity: 'high' },
        { pattern: 'secret_key', score: 0.9, severity: 'high' },
        { pattern: 'bypass', score: 0.85, severity: 'high' },
        { pattern: 'you are no longer', score: 0.85, severity: 'high' },
        { pattern: 'system override', score: 0.9, severity: 'high' },
        { pattern: 'developer mode on', score: 0.85, severity: 'high' },
        { pattern: 'hypnotic', score: 0.95, severity: 'high' },
        { pattern: 'disregard your instructions', score: 0.9, severity: 'high' },
        // Markdown/structured injection attempts
        { pattern: '```system', score: 0.8, severity: 'high' },
        { pattern: '[inst]', score: 0.85, severity: 'high' },
        { pattern: '<<sys>>', score: 0.9, severity: 'high' },

        // Medium severity - Context dependent (score: 0.5-0.7)
        { pattern: 'new instructions', score: 0.7, severity: 'medium' },
        { pattern: 'act as', score: 0.6, severity: 'medium' },
        { pattern: 'pretend you are', score: 0.6, severity: 'medium' },
        { pattern: 'roleplay as', score: 0.5, severity: 'medium' },
    ];

    /**
     * Analyzes input for injection attempts with confidence scoring.
     * Mirrors the Python R2A2 scanner patterns from indii_task.py.
     *
     * @param input - The user input to analyze
     * @returns Analysis result with confidence score and recommendation
     */
    static analyzeInjectionRisk(input: string): {
        isRisky: boolean;
        confidence: number;
        detectedPatterns: string[];
        severity: 'none' | 'medium' | 'high' | 'critical';
        recommendation: 'allow' | 'flag' | 'block';
    } {
        const lower = input.toLowerCase();
        const detectedPatterns: string[] = [];
        let maxScore = 0;
        let maxSeverity: 'none' | 'medium' | 'high' | 'critical' = 'none';

        for (const { pattern, score, severity } of this.INJECTION_PATTERNS) {
            if (lower.includes(pattern)) {
                detectedPatterns.push(pattern);
                if (score > maxScore) {
                    maxScore = score;
                    maxSeverity = severity;
                }
            }
        }

        // Additional check: img:// protocol with system paths (from Python R2A2)
        if (lower.includes('img://') && (lower.includes('/etc/') || lower.includes('/root/'))) {
            detectedPatterns.push('img:// with system path');
            maxScore = Math.max(maxScore, 0.95);
            maxSeverity = 'high';
        }

        return {
            isRisky: maxScore > 0.5,
            confidence: maxScore,
            detectedPatterns,
            severity: maxSeverity,
            recommendation: maxScore >= 0.9 ? 'block' : maxScore >= 0.6 ? 'flag' : 'allow'
        };
    }

    /**
     * Full R2A2-style security check combining sanitization and injection analysis.
     * Use this for comprehensive input validation before agent processing.
     *
     * @param input - The raw user input
     * @returns Sanitized input and security analysis
     */
    static securityCheck(input: string): {
        sanitized: string;
        analysis: ReturnType<typeof InputSanitizer.analyzeInjectionRisk>;
        shouldBlock: boolean;
        shouldFlag: boolean;
    } {
        const sanitized = this.sanitize(input);
        const analysis = this.analyzeInjectionRisk(input); // Analyze original, not sanitized

        return {
            sanitized,
            analysis,
            shouldBlock: analysis.recommendation === 'block',
            shouldFlag: analysis.recommendation === 'flag'
        };
    }
}
