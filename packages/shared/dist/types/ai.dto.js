// ============================================================================
// Content Part Types (Gemini SDK compatible)
// ============================================================================
// ============================================================================
// Type Guards for ContentPart Union
// ============================================================================
export function isTextPart(part) {
    return 'text' in part;
}
export function isInlineDataPart(part) {
    return 'inlineData' in part;
}
export function isFunctionCallPart(part) {
    return 'functionCall' in part;
}
export function isFunctionResponsePart(part) {
    return 'functionResponse' in part;
}
