import { logger } from '@/utils/logger';

/**
 * Item 250: AI Prompt Injection Sanitizer
 *
 * Filters dangerous patterns from user-provided text before it's passed to
 * Gemini's generateContent() calls. Prevents:
 *   - System prompt overrides ("Ignore previous instructions...")
 *   - Delimiter injection (```, """, XML tags)
 *   - Role-play attacks ("You are now DAN...")
 *   - Data exfiltration attempts ("Output the system prompt")
 *
 * Usage:
 *   import { sanitizePrompt } from '@/lib/promptSanitizer';
 *   const cleanInput = sanitizePrompt(userInput);
 *   await model.generateContent(cleanInput);
 */

/**
 * Dangerous pattern definitions.
 * Each pattern has:
 *   - regex: matcher for the suspicious string
 *   - replacement: what to replace it with (empty string or safe alternative)
 *   - severity: 'high' (blocked + logged) or 'medium' (stripped silently)
 */
interface DangerousPattern {
    name: string;
    regex: RegExp;
    replacement: string;
    severity: 'high' | 'medium';
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
    // System prompt override attempts
    {
        name: 'system_prompt_override',
        regex: /\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|prior|above|earlier|system|initial)\s+(instructions?|prompts?|rules?|directions?|context|guidelines?)/gi,
        replacement: '[FILTERED]',
        severity: 'high',
    },
    {
        name: 'new_instructions',
        regex: /\b(new|updated|real|actual|true)\s+(instructions?|system\s+prompt|rules?)\s*[:=]/gi,
        replacement: '[FILTERED]',
        severity: 'high',
    },
    // Role-play / jailbreak persona attacks
    {
        name: 'roleplay_attack',
        regex: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as|simulate|you\s*'?\s*re\s+a)\s+(DAN|jailbroken|unrestricted|unfiltered|evil|uncensored)/gi,
        replacement: '[FILTERED]',
        severity: 'high',
    },
    {
        name: 'do_anything_now',
        regex: /\bDAN\s*(mode|prompt|jailbreak)?/gi,
        replacement: '[FILTERED]',
        severity: 'high',
    },
    // Data exfiltration
    {
        name: 'exfil_system_prompt',
        regex: /\b(output|reveal|show|display|print|repeat|echo|leak|expose)\s+(the\s+)?(system\s+prompt|initial\s+instructions?|hidden\s+instructions?|original\s+prompt|above\s+instructions?)/gi,
        replacement: '[FILTERED]',
        severity: 'high',
    },
    {
        name: 'exfil_api_keys',
        regex: /\b(output|reveal|show|display|print|leak)\s+(the\s+)?(api\s*key|secret|token|password|credential|env\s*var)/gi,
        replacement: '[FILTERED]',
        severity: 'high',
    },
    // Delimiter injection (used to break out of user context)
    {
        name: 'triple_backtick_injection',
        regex: /```\s*(system|assistant|function|tool)\b/gi,
        replacement: '` ` `',
        severity: 'medium',
    },
    {
        name: 'xml_tag_injection',
        regex: /<\s*\/?\s*(system|instructions?|prompt|context|tool_code|function_call)\s*>/gi,
        replacement: '[TAG_REMOVED]',
        severity: 'medium',
    },
    // Markdown heading injection (used to simulate new sections)
    {
        name: 'heading_injection',
        regex: /^#{1,3}\s*(System|Instructions?|Context|Rules?)\s*$/gim,
        replacement: '',
        severity: 'medium',
    },
    // Encoded prompt injection via base64
    {
        name: 'base64_payload_hint',
        regex: /\b(decode|base64|atob)\s*\(\s*['"]([A-Za-z0-9+/=]{20,})['"]\s*\)/gi,
        replacement: '[ENCODED_CONTENT_REMOVED]',
        severity: 'high',
    },
];

export interface SanitizationResult {
    /** The cleaned text, safe for model input */
    sanitizedText: string;
    /** Whether any patterns were detected */
    wasModified: boolean;
    /** Names of detected patterns (for audit logging) */
    detectedPatterns: string[];
    /** Count of total replacements made */
    replacementCount: number;
}

/**
 * Sanitize user-provided text before sending to Gemini.
 *
 * @param input - Raw user text
 * @returns Sanitized result with metadata
 */
export function sanitizePrompt(input: string): SanitizationResult {
    // Strip zero-width characters used to bypass regex matching
    let sanitized = input.replace(/[\u200B-\u200D\uFEFF]/g, '');
    const detectedPatterns: string[] = [];
    let replacementCount = 0;

    for (const pattern of DANGEROUS_PATTERNS) {
        const matches = sanitized.match(pattern.regex);
        if (matches && matches.length > 0) {
            detectedPatterns.push(pattern.name);
            replacementCount += matches.length;

            if (pattern.severity === 'high') {
                logger.warn(`[PromptSanitizer] HIGH severity prompt injection detected: "${pattern.name}" (${matches.length} matches)`);
            }

            sanitized = sanitized.replace(pattern.regex, pattern.replacement);
        }
    }

    // Trim excessive whitespace left by removals
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

    return {
        sanitizedText: sanitized,
        wasModified: detectedPatterns.length > 0,
        detectedPatterns,
        replacementCount,
    };
}

/**
 * Quick helper — returns just the clean string.
 * Use `sanitizePrompt()` if you need the metadata.
 */
export function cleanUserInput(input: string): string {
    return sanitizePrompt(input).sanitizedText;
}
