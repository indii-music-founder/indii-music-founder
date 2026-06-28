"use strict";
// ============================================================================
// Content Part Types (Gemini SDK compatible)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTextPart = isTextPart;
exports.isInlineDataPart = isInlineDataPart;
exports.isFunctionCallPart = isFunctionCallPart;
exports.isFunctionResponsePart = isFunctionResponsePart;
// ============================================================================
// Type Guards for ContentPart Union
// ============================================================================
function isTextPart(part) {
    return 'text' in part;
}
function isInlineDataPart(part) {
    return 'inlineData' in part;
}
function isFunctionCallPart(part) {
    return 'functionCall' in part;
}
function isFunctionResponsePart(part) {
    return 'functionResponse' in part;
}
//# sourceMappingURL=ai.dto.js.map