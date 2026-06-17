/**
 * Fallback Client — Disabled for security.
 *
 * Previously used the direct @google/genai SDK when App Check failed.
 * To prevent VITE_API_KEY leaks, this fallback is now disabled.
 * If App Check fails, requests will be blocked.
 */

import { AppErrorCode, AppException } from '@/shared/types/errors';

export async function initializeFallbackClient(...args: any[]): Promise<any> {
    throw new AppException(
        AppErrorCode.UNAUTHORIZED,
        'Firebase App Check validation failed. Insecure fallback to the raw Gemini SDK has been disabled for security.'
    );
}

export async function generateWithFallback(...args: any[]): Promise<any> {
    throw new AppException(
        AppErrorCode.UNAUTHORIZED,
        'Firebase App Check validation failed. Insecure fallback to the raw Gemini SDK has been disabled for security.'
    );
}

export async function streamWithFallback(...args: any[]): Promise<any> {
    throw new AppException(
        AppErrorCode.UNAUTHORIZED,
        'Firebase App Check validation failed. Insecure fallback to the raw Gemini SDK has been disabled for security.'
    );
}
