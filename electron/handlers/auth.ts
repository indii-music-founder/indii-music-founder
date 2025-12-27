import { ipcMain, BrowserWindow, shell, session, app } from 'electron';
import { authStorage } from '../services/AuthStorage';
import { generatePKCECodeVerifier, generatePKCECodeChallenge } from '../utils/pkce';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'auth-debug.log');

function logToFile(msg: string) {
    try {
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [Auth] ${msg}\n`);
    } catch (e) {
        console.error('Failed to write to log file', e);
    }
}

// In-memory storage for pending auth flows
const pendingVerifier: string | null = null;

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
    try {
        const urlObj = new URL(url);

        if (urlObj.protocol !== 'indii-os:') {
            logToFile(`Error: Invalid protocol ${urlObj.protocol}`);
            console.error('Blocked deep link with invalid protocol:', urlObj.protocol);
            return;
        }

        if (urlObj.hostname !== 'auth' || urlObj.pathname !== '/callback') {
            logToFile(`Warning: Unexpected host/path ${urlObj.hostname}${urlObj.pathname}`);
            console.warn('Blocked deep link with unexpected host/path:', urlObj.toString());
            return;
        }

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

        if (refreshToken) {
            logToFile(`Received Refresh Token (len: ${refreshToken.length})`);
            authStorage.saveToken(refreshToken).catch(err => console.error("Failed to save refresh token:", err));
        }
        if (idToken) {
            logToFile(`Success: Tokens found. ID: ${idToken.substring(0, 10)}..., Access: ${!!accessToken}`);
            console.log("Received tokens via bridge flow, notifying renderer...");
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
