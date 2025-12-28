/**
 * Auth Handlers (Simplified)
 *
 * Auth is now handled directly via Firebase SDK in the renderer process.
 * signInWithPopup works natively in Electron's Chromium.
 *
 * We only keep logout handler to clear session data.
 */

import { ipcMain, BrowserWindow, session } from 'electron';
import { authStorage } from '../services/AuthStorage';

export function registerAuthHandlers() {
    // Login is now handled in renderer via Firebase signInWithPopup
    // No need for external browser + deep links

    ipcMain.handle('auth:logout', async () => {
        console.log('[Auth] Logout requested');
        try {
            await authStorage.deleteToken();
            const ses = session.defaultSession;
            await ses.clearStorageData({
                storages: ['cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
            });
            // Notify windows (for any cleanup needed)
            const wins = BrowserWindow.getAllWindows();
            wins.forEach(w => {
                if (!w.isDestroyed()) {
                    w.webContents.send('auth:logout-complete');
                }
            });
        } catch (e) {
            console.error("[Auth] Logout failed:", e);
        }
    });
}

// Deep link handling for auth is no longer needed
// Keep this export for backwards compatibility but it's a no-op
export function handleDeepLink(url: string) {
    console.log("[Auth] Deep link received (ignored - auth handled in renderer):", url);
}
