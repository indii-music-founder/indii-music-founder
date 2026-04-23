import { logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export type ArmorViolationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ArmorViolation {
    category: string;
    pattern: string;
    severity: ArmorViolationSeverity;
    message: string;
}

export interface ModelArmorPolicy {
    /** Regex patterns that should block a prompt from being sent */
    blockedInputPatterns: RegExp[];
    /** Regex patterns that should be redacted from model output */
    outputRedactionPatterns: RegExp[];
    /** Content safety categories to enforce (e.g. harassment, violence) */
    contentSafetyThresholds: Record<string, 'block' | 'warn' | 'allow'>;
    /** Whether to enforce data leakage prevention on output */
    enableDLP: boolean;
}

// ============================================================================
// DEFAULT POLICY — Production-Grade Pattern Library
// ============================================================================

/**
 * Creates a fresh default policy.
 *
 * IMPORTANT: Every call returns fresh RegExp instances to avoid
 * the JavaScript `/g` flag `lastIndex` state mutation bug.
 * RegExp objects with `/g` are stateful — `.test()` advances `lastIndex`,
 * causing subsequent `.test()` calls on the same regex to fail.
 * By creating fresh instances each invocation we guarantee zero cross-call leakage.
 */
export const getDefaultPolicy = (): ModelArmorPolicy => ({
    blockedInputPatterns: [
        // --- Prompt Injection: Direct Override ---
        /ignore previous instructions/i,
        /ignore all prior instructions/i,
        /disregard your instructions/i,
        /forget your system prompt/i,
        /you are now DAN/i,
        /you are no longer bound/i,
        /enter developer mode/i,
        /act as an? unrestricted/i,
        /jailbreak/i,

        // --- Prompt Injection: System Prompt Exfiltration ---
        /repeat your (system )?instructions/i,
        /what is your (system )?prompt/i,
        /print your (system )?prompt/i,
        /output your (system )?prompt/i,
        /show me your (system )?instructions/i,
        /reveal your (system )?prompt/i,

        // --- Prompt Injection: Delimiter / Context Manipulation ---
        /\[SYSTEM\]/i,
        /\[INST\]/i,
        /<\|im_start\|>/i,
        /<<SYS>>/i,
        /### Instruction:/i,

        // --- Prompt Injection: Encoding Tricks ---
        /base64 decode/i,
        /ROT13/i,
    ],
    outputRedactionPatterns: [
        // --- API Keys & Tokens ---
        /sk-[a-zA-Z0-9]{32,}/g,              // OpenAI keys
        /AIza[0-9A-Za-z\-_]{35}/g,           // Google API keys
        /ghp_[a-zA-Z0-9]{36}/g,              // GitHub tokens
        /gho_[a-zA-Z0-9]{36}/g,              // GitHub OAuth tokens
        /github_pat_[a-zA-Z0-9_]{22,}/g,     // GitHub fine-grained PATs
        /AKIA[0-9A-Z]{16}/g,                 // AWS Access Key IDs
        /sk_live_[a-zA-Z0-9]{24,}/g,         // Stripe live secret keys
        /sk_test_[a-zA-Z0-9]{24,}/g,         // Stripe test secret keys
        /rk_live_[a-zA-Z0-9]{24,}/g,         // Stripe restricted keys
        /whsec_[a-zA-Z0-9]{32,}/g,           // Stripe webhook secrets
        /xoxb-[0-9]{10,}-[a-zA-Z0-9]{24}/g,  // Slack bot tokens
        /xoxp-[0-9]{10,}-[a-zA-Z0-9]{24}/g,  // Slack user tokens

        // --- PII: Identity Documents ---
        /\b\d{3}-\d{2}-\d{4}\b/g,            // US Social Security Numbers (XXX-XX-XXXX)
        /\b\d{9}\b/g,                         // SSN without dashes (9 consecutive digits — high false-positive, but DLP-critical)

        // --- PII: Financial ---
        /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,  // Visa card numbers
        /\b5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Mastercard numbers
        /\b3[47]\d{13}\b/g,                   // Amex card numbers

        // --- PII: Contact Information ---
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, // Email addresses

        // --- Cryptographic Secrets ---
        /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, // Private key headers
        /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWTs (header.payload.signature)

        // --- Database / Connection Strings ---
        /mongodb(\+srv)?:\/\/[^\s]+/g,        // MongoDB connection strings
        /postgres(ql)?:\/\/[^\s]+/g,          // PostgreSQL connection strings
        /mysql:\/\/[^\s]+/g,                  // MySQL connection strings
    ],
    contentSafetyThresholds: {
        'harassment': 'block',
        'hate_speech': 'block',
        'sexually_explicit': 'block',
        'dangerous_content': 'block',
    },
    enableDLP: true,
});

// ============================================================================
// MODEL ARMOR SERVICE
// ============================================================================

export class ModelArmor {
    /**
     * Scan an input prompt for prompt injection and content policy violations.
     *
     * @param prompt - The raw user or tool prompt to scan
     * @param policy - The active ModelArmorPolicy
     * @returns Whether the prompt is allowed, the reason if blocked, and the sanitized prompt
     */
    static async scanInput(prompt: string, policy: ModelArmorPolicy): Promise<{
        allowed: boolean;
        reason?: string;
        sanitizedPrompt?: string;
        violations?: ArmorViolation[];
    }> {
        logger.debug('[ModelArmor] Scanning input...');
        const violations: ArmorViolation[] = [];

        for (const pattern of policy.blockedInputPatterns) {
            // CRITICAL: Reset lastIndex before every test to avoid /g state leakage.
            // Even though input patterns currently don't use /g, this is defensive.
            pattern.lastIndex = 0;

            if (pattern.test(prompt)) {
                const violation: ArmorViolation = {
                    category: 'prompt_injection',
                    pattern: pattern.toString(),
                    severity: 'critical',
                    message: `Prompt contains blocked pattern: ${pattern.toString()}`,
                };
                violations.push(violation);
                logger.warn(`[ModelArmor] Input blocked: ${violation.message}`);
            }
        }

        if (violations.length > 0) {
            return {
                allowed: false,
                reason: violations.map(v => v.message).join('; '),
                violations,
            };
        }

        return {
            allowed: true,
            sanitizedPrompt: prompt,
        };
    }

    /**
     * Scan model output for data leakage (DLP) and redact sensitive content.
     *
     * IMPLEMENTATION NOTE on the `/g` regex bug:
     * JavaScript RegExp objects with the `/g` flag maintain internal `lastIndex` state.
     * Calling `.test()` advances `lastIndex`, so a subsequent `.replace()` on the same
     * regex instance (or a second `.test()` call) may miss matches.
     *
     * Solution: We create a FRESH RegExp from the pattern's source and flags for
     * the `.replace()` call, and always reset `lastIndex` before `.test()`.
     *
     * @param response - The raw model output to scan
     * @param policy - The active ModelArmorPolicy
     * @returns Whether the output is clean, the redacted response, and any violations found
     */
    static async scanOutput(response: string, policy: ModelArmorPolicy): Promise<{
        allowed: boolean;
        redactedResponse?: string;
        violations?: ArmorViolation[];
    }> {
        logger.debug('[ModelArmor] Scanning output...');

        let redactedResponse = response;
        const violations: ArmorViolation[] = [];

        if (policy.enableDLP) {
            for (const pattern of policy.outputRedactionPatterns) {
                // CRITICAL FIX: Reset lastIndex before .test() to neutralize /g state mutation.
                pattern.lastIndex = 0;

                if (pattern.test(redactedResponse)) {
                    const patternStr = pattern.toString();
                    logger.warn(`[ModelArmor] Output contains sensitive data: ${patternStr}`);

                    violations.push({
                        category: 'data_leakage',
                        pattern: patternStr,
                        severity: this.classifyDLPSeverity(pattern),
                        message: `DLP violation: sensitive data matched ${patternStr}`,
                    });

                    // CRITICAL FIX: Create a FRESH RegExp for the replace operation.
                    // The .test() call above advanced `lastIndex` on the original regex.
                    // Using a fresh instance guarantees all matches are caught by .replace().
                    const freshPattern = new RegExp(pattern.source, pattern.flags);
                    redactedResponse = redactedResponse.replace(freshPattern, '[REDACTED_BY_MODEL_ARMOR]');
                }
            }
        }

        return {
            allowed: violations.length === 0,
            redactedResponse,
            violations: violations.length > 0 ? violations : undefined,
        };
    }

    /**
     * Classify DLP violation severity based on the pattern type.
     * Private keys and SSNs are critical; API keys are high; emails are medium.
     */
    private static classifyDLPSeverity(pattern: RegExp): ArmorViolationSeverity {
        const source = pattern.source;

        // Critical: Private keys, SSNs, credit cards
        if (source.includes('PRIVATE KEY') || source.includes('\\d{3}-\\d{2}-\\d{4}')) {
            return 'critical';
        }

        // High: API keys, tokens, JWTs, connection strings
        if (
            source.includes('sk-') ||
            source.includes('AIza') ||
            source.includes('ghp_') ||
            source.includes('AKIA') ||
            source.includes('sk_live') ||
            source.includes('eyJ') ||
            source.includes('mongodb') ||
            source.includes('postgres')
        ) {
            return 'high';
        }

        // Medium: Emails, Slack tokens
        if (source.includes('@') || source.includes('xox')) {
            return 'medium';
        }

        return 'low';
    }
}
