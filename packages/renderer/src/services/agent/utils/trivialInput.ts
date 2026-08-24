/**
 * Utility to identify short conversational/trivial inputs (greetings, acks, filler)
 * that should bypass heavy multi-step LLM classification, Evolas verdict generation,
 * and Swarm chunk fan-outs.
 */

const TRIVIAL_PATTERNS = [
    /^(hi|hey|hello|howdy|sup|what'?s up|yo)\b/,
    /^(thanks?|thank you|thx|ty|appreciated?)\b/,
    /^(ok|okay|got it|sounds good|perfect|great|cool|awesome|nice|alright)\b/,
    /^(bye|goodbye|cya|see ya|later|good night|have a good (one|day|night))\b/,
    /^(yes|no|yep|nope|yeah|nah|sure|absolutely|definitely|of course)\b/,
    /^(good (morning|afternoon|evening|day))\b/,
    /^(help|start|menu|options|what can you do)\b/,
    /^(test|testing|hello world|ping)\b/,
];

const DOMAIN_OR_ACTION_PATTERNS = [
    /^(should|can|how|why|what|where|who|when|which|is|are|do|does|will|would|could)\b/i,
    /\b(sign|contract|distribute|release|master|royalties|split|sync|pitch|upload|generate|create|build|render|track|audit|review|analyze|export|import|legal|finance|tax)\b/i,
];

export function isTrivialInput(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    // Any query containing domain actions or question words is not trivial
    if (DOMAIN_OR_ACTION_PATTERNS.some(p => p.test(trimmed))) {
        return false;
    }

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount > 6) return false;

    const lower = trimmed.toLowerCase();
    return TRIVIAL_PATTERNS.some(p => p.test(lower));
}
