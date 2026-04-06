import { ipcMain, BrowserWindow, shell, session, app } from 'electron';
import { authStorage } from '../services/AuthStorage';
import { generatePKCECodeVerifier, generatePKCECodeChallenge } from '../utils/pkce';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LOG_FILE = path.join(process.cwd(), 'auth-debug.log');

function logToFile(msg: string) {
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [Auth] ${msg}\n`);
    } catch (e) {
        console.error('Failed to write to log file', e);
    }
}

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
const pendingVerifier: string | null = null;

// Rate limiting for auth attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
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
        logToFile(`Rate limit exceeded for ${identifier}`);
        return false;
    }

    return true;
}

// Notify helper
function notifyAuthSuccess(tokens: { idToken: string; accessToken?: string | null }) {
    const wins = BrowserWindow.getAllWindows();
    console.log(`[Auth] Notifying ${wins.length} window(s) of successful auth`);
    wins.forEach(w => {
        if (!w.isDestroyed()) {
            w.webContents.send('auth:user-update', tokens);
            if (w.isMinimized()) w.restore();
            w.focus();
        }
    });
}

function notifyAuthError(message: string) {
    const wins = BrowserWindow.getAllWindows();
    console.log(`[Auth] Notifying ${wins.length} window(s) of auth error: ${message}`);
    wins.forEach(w => {
        if (!w.isDestroyed()) {
            w.webContents.send('auth:error', { message });
        }
    });
}

export function registerAuthHandlers() {
    ipcMain.handle('auth:login-google', async () => {
        const LOGIN_BRIDGE_URL = process.env.VITE_LANDING_PAGE_URL || 'https://indiios-v-1-1.web.app/login-bridge';
        console.log("[Auth] Redirecting to Login Bridge:", LOGIN_BRIDGE_URL);
        await shell.openExternal(LOGIN_BRIDGE_URL);
    });

    ipcMain.handle('auth:logout', async () => {
        console.log('Logout requested');
        try {
            await authStorage.deleteToken();
            const ses = session.defaultSession;
            await ses.clearStorageData({
                storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
            });
            const wins = BrowserWindow.getAllWindows();
            wins.forEach(w => w.webContents.send('auth:user-update', null));
        } catch (e) {
            console.error("Logout failed:", e);
        }
    });
}

export function handleDeepLink(url: string) {
    logToFile(`handleDeepLink received URL: ${url}`);
    console.log("Deep link received:", url);

    // =========================================================================
    // SECURITY: Validate deep link origin and structure
    // =========================================================================
    const originValidation = validateDeepLinkOrigin(url);
    if (!originValidation.valid) {
        logToFile(`SECURITY: Deep link validation failed - ${originValidation.error}`);
        console.error('[Auth] SECURITY: Blocked invalid deep link:', originValidation.error);
        notifyAuthError('Invalid authentication callback');
        return;
    }

    // =========================================================================
    // SECURITY: Rate limiting
    // =========================================================================
    if (!checkRateLimit('deep-link')) {
        logToFile('SECURITY: Rate limit exceeded for deep link auth');
        console.error('[Auth] SECURITY: Too many auth attempts');
        notifyAuthError('Too many authentication attempts. Please wait.');
        return;
    }

    try {
        const urlObj = new URL(url);

        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
            logToFile(`Auth Error from URL: ${error}`);
            console.error("Auth Error:", error);
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
                logToFile(`SECURITY: ID token validation failed - ${tokenValidation.error}`);
                console.error('[Auth] SECURITY: Invalid ID token:', tokenValidation.error);
                notifyAuthError('Invalid authentication token received');
                return;
            }
            logToFile('ID token structure validated successfully');
        }

        if (accessToken) {
            // Access tokens from Google OAuth have different structure, basic check only
            if (accessToken.length < 20) {
                logToFile('SECURITY: Access token suspiciously short');
                console.error('[Auth] SECURITY: Invalid access token length');
                notifyAuthError('Invalid access token received');
                return;
            }
        }

        if (refreshToken) {
            logToFile(`Received Refresh Token (len: ${refreshToken.length})`);
            authStorage.saveToken(refreshToken).catch((err: unknown) => logToFile("[Auth] Failed to save refresh token: " + String(err)));
        }

        if (idToken) {
            logToFile(`Success: Tokens validated and accepted. ID: ${idToken.substring(0, 20)}..., Access: ${!!accessToken}`);
            console.log("Received and validated tokens via bridge flow, notifying renderer...");
            notifyAuthSuccess({ idToken, accessToken });
            return;
        }

        logToFile("No tokens or errors found in deep link.");
    } catch (e) {
        logToFile(`Exception in handleDeepLink: ${String(e)}`);
        console.error("Failed to parse deep link:", e);
        notifyAuthError('Invalid auth callback');
    }
}
