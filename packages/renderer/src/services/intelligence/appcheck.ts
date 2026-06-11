/**
 * App Check Detection & Fallback Mode
 *
 * Utilities for detecting App Check errors and checking configuration.
 * Extracted from FirebaseIntelligenceService.ts for cleaner separation.
 */

import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

/**
 * Checks if an error indicates App Check is not properly configured.
 * When this happens, we should fall back to direct Gemini SDK.
 */
export function isAppCheckError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    const lowerMsg = msg.toLowerCase();
    return (
        msg.includes('installations/request-failed') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('permission-denied') ||
        msg.includes('app-check-token') ||
        msg.includes('The caller does not have permission') ||
        msg.includes('403') ||
        msg.includes('unauthenticated') ||
        msg.includes('Missing or insufficient permissions') ||
        lowerMsg.includes('verification failed') ||
        lowerMsg.includes('failed to fetch') ||
        lowerMsg.includes('fetch')
    );
}

/**
 * Check if App Check is configured in the environment.
 * If not, we should use direct Gemini SDK from the start.
 */
export function isAppCheckConfigured(): boolean {
    // Force fallback in dev mode unless a debug token is explicitly set
    // This allows localhost to work without App Check emulation
    logger.debug('[FirebaseIntelligenceService] App Check Debug:', {
        DEV: env.DEV,
        debugToken: env.appCheckDebugToken,
        key: env.appCheckKey
    });

    // Escape hatch for E2E testing to force fallback to direct Gemini SDK
    if (isFirebaseE2EMockEnabled()) {
        logger.info('[FirebaseIntelligenceService] FIREBASE_E2E_MOCK is true. Disabling App Check for testing fallback.');
        return false;
    }

    // Escape hatch for Vertex AI / Fine-Tuned Agent development
    if (import.meta.env.VITE_USE_VERTEX === 'true' || import.meta.env.VITE_USE_FINE_TUNED_AGENTS === 'true') {
        logger.info('[FirebaseIntelligenceService] VITE_USE_VERTEX or VITE_USE_FINE_TUNED_AGENTS is true. Forcing App Check activation to attempt Vertex connection.');
        return true;
    }

    if (env.DEV && !env.appCheckDebugToken) {
        logger.warn('[FirebaseIntelligenceService] DEV mode detected without Debug Token. Disabling App Check.');
        return false;
    }
    return !!(env.appCheckKey || env.appCheckDebugToken);
}
