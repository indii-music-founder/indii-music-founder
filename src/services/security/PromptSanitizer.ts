/**
 * PromptSanitizer — Item 250
 *
 * Sanitizes user-provided text before sending to Gemini to prevent
 * prompt injection and jailbreak attacks.
 *
 * Defenses:
 * 1. Strip known jailbreak trigger phrases (role-play, DAN, ignore instructions)
 * 2. Limit prompt length to prevent token flooding
 * 3. Detect and redact potential system prompt exfiltration attempts
 * 4. Normalize whitespace / control characters
 * 5. Block attempts to inject conflicting system instructions
 */

export interface SanitizeResult {
    sanitized: string;
    wasModified: boolean;
    blocked: boolean;
    reasons: string[];
}

// Known jailbreak and injection patterns
const JAILBREAK_PATTERNS: { pattern: RegExp; label: string }[] = [
    // DAN / character roleplay jailbreaks
    { pattern: /\bDAN\b/gi, label: 'DAN jailbreak pattern' },
    { pattern: /do\s+anything\s+now/gi, label: 'DAN jailbreak pattern' },
    { pattern: /jailbreak/gi, label: 'jailbreak keyword' },
    // Instruction override attempts
    { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|constraints?)/gi, label: 'instruction override' },
    { pattern: /disregard\s+(all\s+)?(previous|prior|above)/gi, label: 'instruction disregard' },
    { pattern: /forget\s+(everything|all)\s+(i\s+said|above|before)/gi, label: 'context reset attempt' },
    // Prompt injection via delimiter attacks
    { pattern: /<\|im_start\|>|<\|im_end\|>/gi, label: 'ChatML injection' },
    { pattern: /###\s*(system|instruction|prompt)/gi, label: 'markdown injection' },
    { pattern: /\[SYSTEM\]|\[INST\]|\[\/INST\]/gi, label: 'Llama injection tokens' },
    // Exfiltration attempts
    { pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|configuration)/gi, label: 'prompt exfiltration' },
    { pattern: /print\s+(your\s+)?(full\s+)?(system\s+)?(prompt|instructions?)/gi, label: 'prompt exfiltration' },
    { pattern: /what\s+(are|is)\s+(your\s+)?(system\s+)?(prompt|instructions?|directives?)/gi, label: 'prompt exfiltration' },
    // Token smuggling
    { pattern: /base64\s*:\s*[A-Za-z0-9+/]{20,}/gi, label: 'base64 smuggling' },
    // Persona hijacking
    { pattern: /you\s+are\s+now\s+(an?\s+)?(unrestricted|uncensored|evil|malicious)/gi, label: 'persona hijack' },
    { pattern: /pretend\s+(you\s+(are|have)\s+no\s+(restrictions?|limits?|rules?))/gi, label: 'persona hijack' },
    { pattern: /act\s+as\s+(an?\s+)?(unrestricted|uncensored|evil|malicious)\s+ai/gi, label: 'persona hijack' },
    // Developer mode / bypass
    { pattern: /developer\s+mode\s+(on|enabled?|activated?)/gi, label: 'developer mode bypass' },
    { pattern: /enable\s+(developer|god|admin|root)\s+mode/gi, label: 'mode bypass attempt' },
];

// Patterns that should cause hard rejection (not just stripping)
const BLOCK_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /\bsynthetize\s+(drugs?|poison|explosives?|weapons?)\b/gi, label: 'harmful synthesis request' },
    { pattern: /how\s+to\s+(make|build|create)\s+(bomb|explosive|weapon|malware|ransomware)/gi, label: 'harmful content request' },
    { pattern: /\b(CSAM|child\s+pornography|child\s+sexual)\b/gi, label: 'CSAM keyword' },
];

const MAX_PROMPT_LENGTH = 32_000; // ~8k tokens at 4 chars/token
const MAX_LINE_LENGTH = 2000;

export class PromptSanitizer {
    /**
     * Sanitize a user prompt before sending to AI.
     * Returns the cleaned prompt and metadata about what was modified.
     */
    static sanitize(prompt: string): SanitizeResult {
        const reasons: string[] = [];
        let sanitized = prompt;
        let blocked = false;

        // 1. Check for hard-block patterns (return immediately, don't process further)
        for (const { pattern, label } of BLOCK_PATTERNS) {
            if (pattern.test(sanitized)) {
                return {
                    sanitized: '[CONTENT BLOCKED: This request contains prohibited content and cannot be processed.]',
                    wasModified: true,
                    blocked: true,
                    reasons: [`Blocked: ${label}`],
                };
            }
        }

        // 2. Normalize control characters (strip null bytes, DEL, non-printable)
        const originalLength = sanitized.length;
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        if (sanitized.length !== originalLength) {
            reasons.push('Stripped control characters');
        }

        // 3. Strip jailbreak patterns (replace with empty string, leave surrounding text)
        for (const { pattern, label } of JAILBREAK_PATTERNS) {
            const before = sanitized;
            sanitized = sanitized.replace(pattern, '');
            if (sanitized !== before) {
                reasons.push(`Stripped ${label}`);
            }
        }

        // 4. Enforce max line length (prevent repetitive token flooding)
        const lines = sanitized.split('\n');
        const trimmedLines = lines.map(line => {
            if (line.length > MAX_LINE_LENGTH) {
                reasons.push('Truncated long line');
                return line.slice(0, MAX_LINE_LENGTH) + '...';
            }
            return line;
        });
        sanitized = trimmedLines.join('\n');

        // 5. Enforce total prompt length
        if (sanitized.length > MAX_PROMPT_LENGTH) {
            sanitized = sanitized.slice(0, MAX_PROMPT_LENGTH) + '\n[Prompt truncated for safety]';
            reasons.push('Truncated to max length');
        }

        // 6. Clean up excessive whitespace from stripping
        sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n').trim();

        return {
            sanitized,
            wasModified: sanitized !== prompt || reasons.length > 0,
            blocked,
            reasons,
        };
    }

    /**
     * Sanitize a prompt and throw if it's blocked.
     * Convenience method for use in AI service entry points.
     */
    static sanitizeOrThrow(prompt: string): string {
        const result = this.sanitize(prompt);
        if (result.blocked) {
            throw new Error(`Prompt blocked by safety filter: ${result.reasons.join(', ')}`);
        }
        return result.sanitized;
    }

    /**
     * Check if a prompt contains injection patterns without modifying it.
     * Useful for logging and monitoring.
     */
    static analyze(prompt: string): { hasJailbreakAttempt: boolean; hasBlockedContent: boolean; patterns: string[] } {
        const patterns: string[] = [];

        for (const { pattern, label } of BLOCK_PATTERNS) {
            if (pattern.test(prompt)) patterns.push(`[BLOCKED] ${label}`);
        }
        for (const { pattern, label } of JAILBREAK_PATTERNS) {
            if (pattern.test(prompt)) patterns.push(`[JAILBREAK] ${label}`);
        }

        return {
            hasJailbreakAttempt: patterns.some(p => p.includes('[JAILBREAK]')),
            hasBlockedContent: patterns.some(p => p.includes('[BLOCKED]')),
            patterns,
        };
    }
}
