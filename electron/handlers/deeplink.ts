import { BrowserWindow } from 'electron';
import log from 'electron-log';

/**
 * Handle deep link URLs (indii-os://...)
 */
export function handleDeepLink(url: string, mainWindow: BrowserWindow | null) {
    if (!mainWindow) return;

    try {
        log.info(`[Main] Dispatching deep link to renderer: ${url}`);

        // Ensure window is visible
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();

        // Send to renderer for custom routing logic
        mainWindow.webContents.send('deeplink:received', url);

    } catch (err) {
        log.error(`[Main] Error handling deep link: ${err}`);
    }
}
