/**
 * App Check Detection & Fallback Mode
 *
 * Utilities for detecting App Check errors and checking configuration.
 * Extracted from FirebaseAIService.ts for cleaner separation.
 */

import { env } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Checks if an error indicates App Check is not properly configured.
 * When this happens, we should fall back to direct Gemini SDK.
 */
export function isAppCheckError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
        msg.includes('installations/request-failed') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('permission-denied') ||
        msg.includes('app-check-token') ||
        msg.includes('The caller does not have permission') ||
        msg.includes('403') ||
        msg.includes('unauthenticated') ||
        msg.toLowerCase().includes('verification failed')
    );
}

/**
 * Check if App Check is configured in the environment.
 * If not, we should use direct Gemini SDK from the start.
 */
export function isAppCheckConfigured(): boolean {
    // Force fallback in dev mode unless a debug token is explicitly set
    // This allows localhost to work without App Check emulation
    logger.debug('[FirebaseAIService] App Check Debug:', {
        DEV: env.DEV,
        debugToken: env.appCheckDebugToken,
        key: env.appCheckKey
    });

    if (env.DEV && !env.appCheckDebugToken) {
        logger.warn('[FirebaseAIService] DEV mode detected without Debug Token. Disabling App Check.');
        return false;
    }
    return !!(env.appCheckKey || env.appCheckDebugToken);
}
