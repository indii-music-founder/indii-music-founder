import log from 'electron-log';
import { ipcMain, BrowserWindow, session } from 'electron';
import { authStorage } from '../services/AuthStorage';

// ============================================================================
// SECURITY: Token Validation
// ============================================================================

/**
 * Validates that a JWT token has the expected structure and claims.
 * This is a basic structural validation - Firebase will do full cryptographic verification.
 */
function validateTokenStructure(token: string): { valid: boolean; error?: string } {
    if (!token || typeof token !== 'string') {
        return { valid: false, error: 'Token is empty or not a string' };
    }

    // JWT must have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { valid: false, error: 'Token does not have valid JWT structure (expected 3 parts)' };
    }

    try {
        // Decode the payload (middle part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

        // Validate required claims exist
        if (!payload.iss) {
            return { valid: false, error: 'Token missing issuer (iss) claim' };
        }

        // Validate issuer is from Google/Firebase
        const validIssuers = [
            'https://accounts.google.com',
            'accounts.google.com',
            'https://securetoken.google.com/indiios-v-1-1',
        ];

        if (!validIssuers.some(iss => payload.iss === iss || payload.iss.includes('securetoken.google.com'))) {
            return { valid: false, error: `Token has unexpected issuer: ${payload.iss}` };
        }

        // Check expiration
        if (payload.exp) {
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
                return { valid: false, error: 'Token has expired' };
            }
        }

        // Check audience for Firebase tokens
        if (payload.aud && !payload.aud.includes('indiios')) {
            // Allow Google OAuth tokens which have different audience
            if (!payload.iss.includes('accounts.google.com')) {
                return { valid: false, error: `Token has unexpected audience: ${payload.aud}` };
            }
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, error: `Failed to parse token payload: ${e}` };
    }
}

/**
 * Validates the deep link URL origin and structure
 */
function validateDeepLinkOrigin(url: string): { valid: boolean; error?: string } {
    try {
        const urlObj = new URL(url);

        // Must be our custom protocol
        if (urlObj.protocol !== 'indii-os:') {
            return { valid: false, error: `Invalid protocol: ${urlObj.protocol}` };
        }

        // Must be the auth callback path
        if (urlObj.hostname !== 'auth' || urlObj.pathname !== '/callback') {
            return { valid: false, error: `Unexpected path: ${urlObj.hostname}${urlObj.pathname}` };
        }

        // Check for suspicious parameters that shouldn't be there
        const suspiciousParams = ['redirect', 'next', 'url', 'goto', 'returnUrl'];
        for (const param of suspiciousParams) {
            if (urlObj.searchParams.has(param)) {
                return { valid: false, error: `Suspicious parameter detected: ${param}` };
            }
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, error: `Failed to parse URL: ${e}` };
    }
}

// In-memory storage for pending auth flows
const _pendingVerifier: string | null = null;

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

// Notify helper
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

function notifyBridgeWarning(message: string) {
    const wins = BrowserWindow.getAllWindows();
    log.warn(`[Auth] Notifying ${wins.length} window(s) of bridge fallback: ${message}`);
    wins.forEach(w => {
        if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
            try {
                w.webContents.send('auth:bridge-warning', { message });
            } catch (err) {
                log.warn(`[Auth] Failed to send auth bridge warning: ${err}`);
            }
        }
    });
}

export function registerAuthHandlers() {
    ipcMain.handle('auth:login-google', async () => {
        // NOTE: Explicitly disconnected from the external landing/login bridge.
        // Auth should occur in-renderer via Firebase signInWithPopup to avoid
        // cross-app handoff failures and stuck loading states.
        log.warn('[Auth] auth:login-google IPC called, but external login bridge is disabled. Use renderer Firebase auth flow.');
        return { ok: false, reason: 'external-login-bridge-disabled' };
        const enableBridgeFallback = process.env.INDIIOS_ENABLE_LOGIN_BRIDGE === 'true';
        const LOGIN_BRIDGE_URL = process.env.VITE_LANDING_PAGE_URL;

        if (enableBridgeFallback && LOGIN_BRIDGE_URL) {
            const bridgeWarning = 'Google login is using the web login bridge fallback.';
            log.warn(`[Auth] ${bridgeWarning} URL: ${LOGIN_BRIDGE_URL}`);
            notifyBridgeWarning(bridgeWarning);
            await shell.openExternal(LOGIN_BRIDGE_URL);
            return { mode: 'bridge' };
        }

        if (enableBridgeFallback && !LOGIN_BRIDGE_URL) {
            const errorMessage = 'Web login bridge fallback is enabled but VITE_LANDING_PAGE_URL is missing.';
            log.error(`[Auth] ${errorMessage}`);
            notifyAuthError(errorMessage);
            return { mode: 'error', message: errorMessage };
        }

        log.info('[Auth] Starting native desktop Google OAuth flow.');
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => {
            if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
                try {
                    w.webContents.send('auth:begin-native-google');
                } catch (err) {
                    log.warn(`[Auth] Failed to signal native Google auth start: ${err}`);
                }
            }
        });

        return { mode: 'native' };
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

        const tokenValidation = validateTokenStructure(payload.idToken);
        if (!tokenValidation.valid) {
            notifyAuthError('Invalid authentication token received');
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
            log.error("Logout failed:", e);
        }
    });
}

export function handleDeepLink(url: string) {
    log.info(`[Auth] handleDeepLink received URL: ${url}`);

    // =========================================================================
    // SECURITY: Validate deep link origin and structure
    // =========================================================================
    const originValidation = validateDeepLinkOrigin(url);
    if (!originValidation.valid) {
        log.error(`[Auth] SECURITY: Blocked invalid deep link - ${originValidation.error}`);
        notifyAuthError('Invalid authentication callback');
        return;
    }

    // =========================================================================
    // SECURITY: Rate limiting
    // =========================================================================
    if (!checkRateLimit('deep-link')) {
        log.error('[Auth] SECURITY: Rate limit exceeded for deep link auth');
        notifyAuthError('Too many authentication attempts. Please wait.');
        return;
    }

    try {
        const urlObj = new URL(url);

        const _code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
            log.error(`[Auth] Error from URL: ${error}`);
            notifyAuthError(error);
            return;
        }

        const idToken = urlObj.searchParams.get('idToken');
        const accessToken = urlObj.searchParams.get('accessToken');
        const refreshToken = urlObj.searchParams.get('refreshToken');

        // =====================================================================
        // SECURITY: Validate token structure before accepting
        // =====================================================================
        if (idToken) {
            const tokenValidation = validateTokenStructure(idToken);
            if (!tokenValidation.valid) {
                log.error(`[Auth] SECURITY: ID token validation failed - ${tokenValidation.error}`);
                notifyAuthError('Invalid authentication token received');
                return;
            }
            log.info('[Auth] ID token structure validated successfully');
        }

        if (accessToken) {
            // Access tokens from Google OAuth have different structure, basic check only
            if (accessToken.length < 20) {
                log.error('[Auth] SECURITY: Access token suspiciously short');
                notifyAuthError('Invalid access token received');
                return;
            }
        }

        if (refreshToken) {
            log.info(`[Auth] Received Refresh Token (len: ${refreshToken.length})`);
            authStorage.saveToken(refreshToken).catch((err: unknown) => log.error("[Auth] Failed to save refresh token: ", err));
        }

        if (idToken) {
            log.info(`[Auth] Success: Tokens validated and accepted. ID: ${idToken.substring(0, 20)}..., Access: ${!!accessToken}`);
            notifyAuthSuccess({ idToken, accessToken });
            return;
        }

        log.info("[Auth] No tokens or errors found in deep link.");
    } catch (e) {
        log.error(`[Auth] Exception in handleDeepLink: ${String(e)}`);
        notifyAuthError('Invalid auth callback');
    }
}
