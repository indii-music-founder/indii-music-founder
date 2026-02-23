import { firebaseAI } from './FirebaseAIService';

/**
 * GenAI Unified Facade
 * 
 * This is the canonical entry point for all Generative AI operations in the application.
 * It wraps FirebaseAIService, providing rate limiting, request coalescing, and
 * environment-agnostic generation with automatic fallback to direct Gemini SDK.
 * 
 * @example
 * import { GenAI } from '@/services/ai/GenAI';
 * const result = await GenAI.generateText("Hello AI!");
 */
export const GenAI = firebaseAI;

// Re-export types for convenience
export type { FirebaseAIService as GenAIClass } from './FirebaseAIService';
