import { ipcMain, BrowserWindow, shell, session } from 'electron';
import { authStorage } from '../services/AuthStorage';
import { generatePKCECodeVerifier, generatePKCECodeChallenge } from '../utils/pkce';

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
    console.log("Deep link received:", url);
    try {
        const urlObj = new URL(url);

        if (urlObj.protocol !== 'indii-os:') {
            console.error('Blocked deep link with invalid protocol:', urlObj.protocol);
            return;
        }

        if (urlObj.hostname !== 'auth' || urlObj.pathname !== '/callback') {
            console.warn('Blocked deep link with unexpected host/path:', urlObj.toString());
            return;
        }

        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
            console.error("Auth Error:", error);
            notifyAuthError(error);
            return;
        }

        const idToken = urlObj.searchParams.get('idToken');
        const accessToken = urlObj.searchParams.get('accessToken');
        const refreshToken = urlObj.searchParams.get('refreshToken');

        if (refreshToken) {
            authStorage.saveToken(refreshToken).catch(err => console.error("Failed to save refresh token:", err));
        }
        if (idToken) {
            console.log("Received tokens via bridge flow, notifying renderer...");
            console.log(`[Auth] ID Token length: ${idToken.length}`);
            console.log(`[Auth] Access Token present: ${!!accessToken}, length: ${accessToken?.length || 0}`);
            notifyAuthSuccess({ idToken, accessToken });
            return;
        }

        // PKCE Flow logic omitted for brevity as it seemed unused in main.ts logic (implicit flow preferred via bridge), 
        // but restoring if needed:
        if (code && pendingVerifier) {
            // ... PKCE exchange logic ...
            // Simplified for now assuming Bridge Flow is primary.
            // If the user needs PKCE, we can add the exchange logic back here. 
            // For now, let's keep it safe.
            console.log("PKCE Code received but flow not fully implemented in refactor yet.");
        }
    } catch (e) {
        console.error("Failed to parse deep link:", e);
        notifyAuthError('Invalid auth callback');
    }
}
