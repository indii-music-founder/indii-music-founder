/**
 * Electron Auto-Updater
 *
 * Uses electron-updater to check for and apply updates from GitHub Releases.
 * Updates are downloaded in the background and installed on next app restart.
 *
 * Events are forwarded to the renderer via IPC for UI notifications.
 */
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

// electron-updater is an optional dependency - gracefully handle if missing
let autoUpdater: typeof import('electron-updater').autoUpdater | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const updaterModule = require('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
} catch {
    log.info('[Updater] electron-updater not available - auto-updates disabled');
}

export function setupAutoUpdater(): void {
    if (!autoUpdater) return;

    // Configure
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    // Item 324: Explicitly reject pre-release builds and downgrade attempts
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    // Check for updates on startup and every 4 hours
    const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

    autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
        log.warn('[Updater] Initial update check failed:', err.message);
    });

    setInterval(() => {
        autoUpdater!.checkForUpdatesAndNotify().catch((err: Error) => {
            log.warn('[Updater] Periodic update check failed:', err.message);
        });
    }, CHECK_INTERVAL_MS);

    // Forward update events to renderer
    autoUpdater.on('checking-for-update', () => {
        log.info('[Updater] Checking for update...');
        sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info: unknown) => {
        const updateInfo = info as Record<string, unknown>;
        log.info(`[Updater] Update available: ${updateInfo.version}`);
        sendToRenderer('updater:available', { version: updateInfo.version as string });
    });

    autoUpdater.on('update-not-available', () => {
        log.info('[Updater] No update available');
        sendToRenderer('updater:not-available');
    });

    autoUpdater.on('download-progress', (progress: unknown) => {
        const p = progress as Record<string, unknown>;
        log.info(`[Updater] Download: ${(p.percent as number).toFixed(1)}%`);
        sendToRenderer('updater:progress', {
            percent: p.percent as number,
            bytesPerSecond: p.bytesPerSecond as number,
            transferred: p.transferred as number,
            total: p.total as number,
        });
    });

    autoUpdater.on('update-downloaded', (info: unknown) => {
        const updateInfo = info as Record<string, unknown>;
        log.info(`[Updater] Update downloaded: ${updateInfo.version}`);
        sendToRenderer('updater:downloaded', { version: updateInfo.version as string });
    });

    autoUpdater.on('error', (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error('[Updater] Error:', message);
        sendToRenderer('updater:error', { message });
    });

    // IPC handlers for renderer control
    ipcMain.handle('updater:check', async () => {
        if (!autoUpdater) return { available: false };
        try {
            const result = await autoUpdater.checkForUpdates();
            return { available: !!result?.updateInfo, version: result?.updateInfo?.version };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { available: false, error: message };
        }
    });

    ipcMain.handle('updater:install', () => {
        if (autoUpdater) {
            autoUpdater.quitAndInstall(false, true);
        }
    });

    ipcMain.handle('updater:set-channel', (_event: unknown, channel: 'stable' | 'beta') => {
        if (!autoUpdater) return;
        autoUpdater.allowPrerelease = channel === 'beta';
        autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest';
        log.info(`[Updater] Channel changed to: ${channel}`);
    });
}

function sendToRenderer(channel: string, data?: Record<string, unknown>): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    }
}
