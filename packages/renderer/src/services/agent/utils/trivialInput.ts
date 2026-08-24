/**
 * Utility to identify short conversational/trivial inputs (greetings, acks, filler)
 * that should bypass heavy multi-step LLM classification, Evolas verdict generation,
 * and Swarm chunk fan-outs.
 */

const TRIVIAL_PATTERNS = [
    /^(hi|hey|hello|howdy|sup|what'?s up|yo)(\s+(team|there|everyone|all|indii|conductor|guys|folks|table))?[!.,?]*$/i,
    /^(how are you|how'?s it going|what'?s new|how do you do)[!.,?]*$/i,
    /^(thanks?|thank you|thx|ty|appreciated?)[!.,?]*$/i,
    /^(ok|okay|got it|sounds good|perfect|great|cool|awesome|nice|alright)[!.,?]*$/i,
    /^(bye|goodbye|cya|see ya|see you( later)?|talk soon|ttyl|later|good night|have a good (one|day|night))[!.,?]*$/i,
    /^(yes|no|yep|nope|yeah|nah|sure|absolutely|definitely|of course)[!.,?]*$/i,
    /^(good (morning|afternoon|evening|day))[!.,?]*$/i,
    /^(go ahead|tell me more|continue)[!.,?]*$/i,
    /^(help|start|menu|options|what can you do)[!.,?]*$/i,
    /^(test|testing|hello world|ping)[!.,?]*$/i,
];

const DOMAIN_OR_ACTION_PATTERNS = [
    /^(should|can|why|where|who|when|which|is|are|do|does|will|would|could)\b/i,
    /\b(sign|contract|distribute|release|master|royalties|split|sync|pitch|upload|generate|create|build|render|track|audit|review|analyze|export|import|legal|finance|tax|keeper)\b/i,
];

export function isTrivialInput(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    // Check exact trivial patterns first
    const lower = trimmed.toLowerCase();
    if (TRIVIAL_PATTERNS.some(p => p.test(lower))) {
        return true;
    }

    // Any query containing domain actions or question words is not trivial
    if (DOMAIN_OR_ACTION_PATTERNS.some(p => p.test(trimmed))) {
        return false;
    }

    return false;
}
