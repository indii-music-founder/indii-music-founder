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
