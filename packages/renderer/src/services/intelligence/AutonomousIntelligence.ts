import { firebaseAI } from './FirebaseIntelligenceService';

/**
 * AutonomousIntelligence Unified Facade
 * 
 * This is the canonical entry point for all Autonomous Intelligence operations in the application.
 * It wraps FirebaseIntelligenceService, providing rate limiting, request coalescing, and
 * environment-agnostic generation with automatic fallback to direct Gemini SDK.
 * 
 * @example
 * import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
 * const result = await AutonomousIntelligence.generateText("Hello!");
 */
export const AutonomousIntelligence = firebaseAI;

// Re-export types for convenience
export type { FirebaseIntelligenceService as AutonomousIntelligenceClass } from './FirebaseIntelligenceService';

/**
 * Safely extracts text from an intelligence response object.
 * Handles different SDK formats (method vs property) and catches candidate/safety errors.
 */
export function getResponseText(response: any): string {
    if (!response) return '';
    
    // Normalize to the response container
    const res = response.response || response;
    if (!res) return '';

    // 1. Try calling text() if it's a function
    if (typeof res.text === 'function') {
        try {
            return res.text();
        } catch (_e) {
            // text() can throw if candidates are empty or blocked by safety settings
        }
    }

    // 2. Try accessing text if it's a string property
    if (typeof res.text === 'string') {
        return res.text;
    }

    // 3. Fallback to candidate parts extraction
    const candidateText = res.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidateText === 'string') {
        return candidateText;
    }

    // 4. Try structure { parts: [{ text }] }
    const partsText = res.content?.parts?.[0]?.text;
    if (typeof partsText === 'string') {
        return partsText;
    }

    return '';
}

