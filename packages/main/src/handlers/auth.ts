import log from 'electron-log';
import { ipcMain, BrowserWindow, session } from 'electron';
import { authStorage } from '../services/AuthStorage';
import { AuthService, type AuthTokens } from '@shared';

// ============================================================================
// SECURITY: Rate Limiting
// ============================================================================

// Rate limiting for auth attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    
    // Cleanup stale entries
    for (const [key, record] of authAttempts.entries()) {
        if (now - record.lastAttempt > AUTH_WINDOW_MS) {
            authAttempts.delete(key);
        }
    }

    const record = authAttempts.get(identifier);

    if (!record) {
        authAttempts.set(identifier, { count: 1, lastAttempt: now });
        return true;
    }

    // Reset if window has passed
    if (now - record.lastAttempt > AUTH_WINDOW_MS) {
        authAttempts.set(identifier, { count: 1, lastAttempt: now });
        return true;
    }

    // Increment and check
    record.count++;
    record.lastAttempt = now;

    if (record.count > MAX_AUTH_ATTEMPTS) {
        log.warn(`[Auth] Rate limit exceeded for ${identifier}`);
        return false;
    }

    return true;
}

/** @internal - For testing only */
export function __resetAuthRateLimit() {
    authAttempts.clear();
    consumedHandoffCodes.clear();
    inFlightHandoffCodes.clear();
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function notifyAuthSuccess(tokens: { idToken: string; accessToken?: string | null }) {
    const wins = BrowserWindow.getAllWindows();
    log.info(`[Auth] Notifying ${wins.length} window(s) of successful auth`);
    wins.forEach(w => {
        if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
            try {
                w.webContents.send('auth:user-update', tokens);
            } catch (err) {
                log.warn(`[Auth] Failed to send auth success: ${err}`);
            }
            if (w.isMinimized()) w.restore();
            w.focus();
        }
    });
}

function notifyAuthError(message: string) {
    const wins = BrowserWindow.getAllWindows();
    log.info(`[Auth] Notifying ${wins.length} window(s) of auth error: ${message}`);
    wins.forEach(w => {
        if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
            try {
                w.webContents.send('auth:error', { message });
            } catch (err) {
                log.warn(`[Auth] Failed to send auth error: ${err}`);
            }
        }
    });
}

// ============================================================================
// HANDOFF LOGIC
// ============================================================================

const consumedHandoffCodes = new Map<string, number>();
const inFlightHandoffCodes = new Set<string>();
const CONSUMED_CODE_TTL_MS = 5 * 60 * 1000;

function markCodeAsConsumed(code: string) {
    const now = Date.now();
    consumedHandoffCodes.set(code, now);

    // Occasional cleanup
    for (const [existingCode, consumedAt] of consumedHandoffCodes.entries()) {
        if (now - consumedAt > CONSUMED_CODE_TTL_MS) {
            consumedHandoffCodes.delete(existingCode);
        }
    }
}

async function redeemDesktopHandoffCode(code: string): Promise<AuthTokens | null> {
    if (!code || code.length < 8) {
        throw new Error('Invalid handoff code');
    }

    if (consumedHandoffCodes.has(code)) {
        throw new Error('Handoff code already redeemed');
    }

    if (inFlightHandoffCodes.has(code)) {
        throw new Error('Handoff code redemption already in progress');
    }

    const endpoint = process.env.AUTH_HANDOFF_REDEEM_URL;
    if (!endpoint) {
        log.warn('[Auth] AUTH_HANDOFF_REDEEM_URL is not configured; skipping handoff redemption');
        return null;
    }

    inFlightHandoffCodes.add(code);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });

        if (!response.ok) {
            if (response.status === 409) throw new Error('Handoff code already redeemed');
            if (response.status === 410 || response.status === 400) throw new Error('Handoff code expired or invalid');
            throw new Error(`Failed to redeem handoff code (${response.status})`);
        }

        const payload = (await response.json()) as AuthTokens;
        if (!payload.idToken) throw new Error('Redeemed payload missing ID token');

        markCodeAsConsumed(code);
        inFlightHandoffCodes.delete(code);
        return payload;
    } catch (error) {
        if (!consumedHandoffCodes.has(code)) {
            inFlightHandoffCodes.delete(code);
        }
        throw error;
    }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

export function registerAuthHandlers() {
    ipcMain.handle('auth:login-google', async () => {
        // NOTE: Explicitly disconnected from the external landing/login bridge.
        // Auth should occur in-renderer via Firebase signInWithPopup to avoid
        // cross-app handoff failures and stuck loading states.
        log.warn('[Auth] auth:login-google IPC called, but external login bridge is disabled. Use renderer Firebase auth flow.');
        return { ok: false, reason: 'external-login-bridge-disabled' };
    });

    ipcMain.handle('auth:complete-native-google', async (_event, payload: { idToken?: string; accessToken?: string | null; error?: string }) => {
        if (payload?.error) {
            notifyAuthError(payload.error);
            return;
        }

        if (!payload?.idToken) {
            notifyAuthError('Native Google login did not provide an ID token.');
            return;
        }

        const tokenValidation = AuthService.validateTokenStructure(payload.idToken);
        if (!tokenValidation.valid) {
            notifyAuthError(tokenValidation.error || 'Invalid authentication token received');
            return;
        }

        notifyAuthSuccess({ idToken: payload.idToken, accessToken: payload.accessToken });
    });

    ipcMain.handle('auth:logout', async () => {
        log.info('Logout requested');
        try {
            await authStorage.deleteToken();
            const ses = session.defaultSession;
            await ses.clearStorageData({
                storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
            });
            const wins = BrowserWindow.getAllWindows();
            wins.forEach(w => {
                if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
                    try {
                        w.webContents.send('auth:user-update', null);
                    } catch (err) {
                        log.warn(`[Auth] Failed to send logout update: ${err}`);
                    }
                }
            });
        } catch (e) {
            log.error("Logout failed:", e instanceof Error ? e.message : String(e));
        }
    });
}

// ============================================================================
// DEEP LINK HANDLING
// ============================================================================

export async function handleDeepLink(url: string) {
    log.info(`[Auth] handleDeepLink received URL: ${url}`);

    const originValidation = AuthService.validateDeepLinkOrigin(url);
    if (!originValidation.valid) {
        log.error(`[Auth] SECURITY: Blocked invalid deep link - ${originValidation.error}`);
        notifyAuthError('Invalid authentication callback');
        return;
    }

    if (!checkRateLimit('deep-link')) {
        log.error('[Auth] SECURITY: Rate limit exceeded for deep link auth');
        notifyAuthError('Too many authentication attempts. Please wait.');
        return;
    }

    try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
            log.error(`[Auth] Error from URL: ${error}`);
            notifyAuthError(error);
            return;
        }

        let idToken: string | null = null;
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        if (!code) {
            const legacyIdToken = urlObj.searchParams.get('idToken');
            const legacyAccessToken = urlObj.searchParams.get('accessToken');
            const legacyRefreshToken = urlObj.searchParams.get('refreshToken');
            
            if (legacyIdToken || legacyAccessToken) {
                if (!AuthService.isLegacyCallbackEnabled(process.env)) {
                    log.warn('[Auth] Legacy token query parameters are disabled; expected one-time code');
                    notifyAuthError('Authentication link is out of date. Please sign in again.');
                    return;
                }

                log.warn('[Auth] Using temporary legacy token callback compatibility mode');
                idToken = legacyIdToken;
                accessToken = legacyAccessToken;
                refreshToken = legacyRefreshToken;
            } else {
                log.info('[Auth] No code found in callback URL');
                return;
            }
        } else {
            const redeemed = await redeemDesktopHandoffCode(code);
            if (redeemed) {
                idToken = redeemed.idToken;
                accessToken = redeemed.accessToken ?? null;
                refreshToken = redeemed.refreshToken ?? null;
            } else if (AuthService.isLegacyCallbackEnabled(process.env)) {
                log.warn('[Auth] Falling back to legacy callback tokens because redemption failed or was skipped');
                idToken = urlObj.searchParams.get('idToken');
                accessToken = urlObj.searchParams.get('accessToken');
                refreshToken = urlObj.searchParams.get('refreshToken');
                if (!idToken) {
                    notifyAuthError('Authentication handoff is not configured correctly.');
                    return;
                }
            } else {
                notifyAuthError('Authentication handoff failed. Please contact support.');
                return;
            }
        }

        // Final Security Checks
        if (idToken) {
            const tokenValidation = AuthService.validateTokenStructure(idToken);
            if (!tokenValidation.valid) {
                log.error(`[Auth] SECURITY: ID token validation failed - ${tokenValidation.error}`);
                notifyAuthError('Invalid authentication token received');
                return;
            }
            log.info('[Auth] ID token structure validated successfully');
        }

        if (accessToken && accessToken.length < 20) {
            log.error('[Auth] SECURITY: Access token suspiciously short');
            notifyAuthError('Invalid access token received');
            return;
        }

        if (refreshToken) {
            log.info(`[Auth] Received Refresh Token (len: ${refreshToken.length})`);
            authStorage.saveToken(refreshToken).catch((err: unknown) => 
                log.error("[Auth] Failed to save refresh token: ", err instanceof Error ? err.message : String(err))
            );
        }

        if (idToken) {
            log.info(`[Auth] Success: Tokens validated and accepted. ID: ${idToken.substring(0, 20)}..., Access: ${!!accessToken}`);
            notifyAuthSuccess({ idToken, accessToken });
        } else {
            log.info('[Auth] No tokens or errors found in deep link.');
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid auth callback';
        if (message === 'Handoff code redemption already in progress') {
            log.info('[Auth] Duplicate deep link ignored: redemption already in progress');
            return;
        }
        log.error(`[Auth] Exception in handleDeepLink: ${String(e)}`);
        notifyAuthError(message);
    }
}
