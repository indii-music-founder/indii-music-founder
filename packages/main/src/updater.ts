/**
 * Electron Auto-Updater
 *
 * Uses electron-updater to check for and apply updates from GitHub Releases or Firebase Hosting.
 * Updates are downloaded in the background and installed on next app restart.
 *
 * Events are forwarded to the renderer via IPC for UI notifications and custom dialogs.
 */
import { BrowserWindow, ipcMain, Notification, app } from 'electron';
import path from 'path';
import log from 'electron-log';
import Store from 'electron-store';

// Initialize configuration store
interface IUpdaterStore {
    get(key: string, defaultValue: unknown): unknown;
    set(key: string, value: unknown): void;
}
const store = new Store() as unknown as IUpdaterStore;

// electron-updater is an optional dependency - gracefully handle if missing
let autoUpdater: typeof import('electron-updater').autoUpdater | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const updaterModule = require('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
} catch {
    log.info('[Updater] electron-updater not available - auto-updates disabled');
}

/**
 * Configure the autoUpdater feed URL and settings based on user preferences.
 */
export function applyUpdaterConfig(source: 'github' | 'firebase', channel: 'stable' | 'beta'): void {
    if (!autoUpdater) return;

    autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest';
    autoUpdater.allowPrerelease = channel === 'beta';

    if (source === 'firebase') {
        const url = (process.env.VITE_UPDATER_FIREBASE_URL || 'https://indii-music-founder.web.app/updates/').trim();
        autoUpdater.setFeedURL({
            provider: 'generic',
            url,
            channel: autoUpdater.channel
        });
        log.info(`[Updater] Set feed URL to Firebase Hosting: ${url} (channel: ${autoUpdater.channel})`);
    } else {
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'the-walking-agency-det',
            repo: 'indii-music',
            releaseType: 'release',
            channel: autoUpdater.channel
        });
        log.info(`[Updater] Set feed URL to GitHub: the-walking-agency-det/indii-music (channel: ${autoUpdater.channel})`);
    }
}

/**
 * Trigger system notification to alert users
 */
function showUpdaterNotification(title: string, body: string, onClick?: () => void): void {
    if (Notification.isSupported()) {
        try {
            const notification = new Notification({
                title,
                body,
                icon: path.join(app.getAppPath(), 'public/icon-192.png'),
                silent: false,
            });
            if (onClick) {
                notification.on('click', onClick);
            }
            notification.show();
        } catch (err) {
            log.warn('[Updater] Failed to show system notification:', err);
        }
    }
}

export function setupAutoUpdater(): void {
    if (!autoUpdater) return;

    // Configure basic autoUpdater settings
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    // Load persisted settings
    const savedSource = store.get('updater-source', 'github') as 'github' | 'firebase';
    const savedChannel = store.get('updater-channel', 'stable') as 'stable' | 'beta';
    
    applyUpdaterConfig(savedSource, savedChannel);

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

    // Forward update events to renderer & trigger system-level user alerts
    autoUpdater.on('checking-for-update', () => {
        log.info('[Updater] Checking for update...');
        sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info: unknown) => {
        const updateInfo = info as Record<string, unknown>;
        const version = (updateInfo.version as string) || 'Unknown';
        log.info(`[Updater] Update available: ${version}`);
        sendToRenderer('updater:available', { version });

        showUpdaterNotification(
            'indii Update Available',
            `Version ${version} is available. Downloading now in the background...`
        );
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
        const version = (updateInfo.version as string) || 'Unknown';
        log.info(`[Updater] Update downloaded: ${version}`);
        sendToRenderer('updater:downloaded', { version });

        showUpdaterNotification(
            'indii Update Ready to Install',
            `Version ${version} has been downloaded. Click here to restart and install now.`,
            () => {
                log.info('[Updater] User clicked update downloaded notification, applying update...');
                autoUpdater?.quitAndInstall(false, true);
            }
        );
    });

    autoUpdater.on('error', (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error('[Updater] Error:', message);
        sendToRenderer('updater:error', { message });
    });
}

let handlersRegistered = false;

export function registerUpdaterHandlers(): void {
    if (handlersRegistered) return;
    handlersRegistered = true;

    // IPC handlers for renderer control - registered unconditionally
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

    ipcMain.handle('updater:set-channel', (_event: any, channel: 'stable' | 'beta') => {
        if (autoUpdater) {
            store.set('updater-channel', channel);
            const currentSource = store.get('updater-source', 'github') as 'github' | 'firebase';
            applyUpdaterConfig(currentSource, channel);
            log.info(`[Updater] Channel set and persisted to: ${channel}`);
        }
    });

    ipcMain.handle('updater:set-source', (_event: any, source: 'github' | 'firebase') => {
        if (autoUpdater) {
            store.set('updater-source', source);
            const currentChannel = store.get('updater-channel', 'stable') as 'stable' | 'beta';
            applyUpdaterConfig(source, currentChannel);
            log.info(`[Updater] Update source set and persisted to: ${source}`);
        }
    });

    ipcMain.handle('updater:get-config', () => {
        const currentChannel = store.get('updater-channel', 'stable') as 'stable' | 'beta';
        const currentSource = store.get('updater-source', 'github') as 'github' | 'firebase';
        return {
            channel: currentChannel,
            source: currentSource,
            isAvailable: !!autoUpdater
        };
    });
}

function sendToRenderer(channel: string, data?: Record<string, unknown>): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            try {
                win.webContents.send(channel, data);
            } catch (err) {
                log.warn(`[Updater] Failed to send ${channel} to renderer: ${err}`);
            }
        }
    }
}
