import { firebaseAI } from './FirebaseIntelligenceService';

/**
 * AutonomousGenAI Unified Facade
 * 
 * This is the canonical entry point for all Generative Autonomous operations in the application.
 * It wraps FirebaseIntelligenceService, providing rate limiting, request coalescing, and
 * environment-agnostic generation with automatic fallback to direct Gemini SDK.
 * 
 * @example
 * import { AutonomousGenAI } from '@/services/intelligence/AutonomousGenAI';
 * const result = await AutonomousGenAI.generateText("Hello AI!");
 */
export const AutonomousGenAI = firebaseAI;

// Re-export types for convenience
export type { FirebaseIntelligenceService as AutonomousGenAIClass } from './FirebaseIntelligenceService';
