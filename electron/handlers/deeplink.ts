import { BrowserWindow } from 'electron';
import log from 'electron-log';

// Item 379: SSRF protection — reject deep links that resolve to private ranges
const PRIVATE_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|::1)$/i;

function isDeepLinkSafe(url: string): boolean {
    try {
        const parsed = new URL(url);
        // Only allow indii-os:// protocol
        if (parsed.protocol !== 'indii-os:') return false;
        // Block any hostname that looks like an internal IP
        const host = parsed.hostname;
        if (host && PRIVATE_HOSTNAMES.test(host)) return false;
        // Sanitize path: only alphanumeric, hyphens, slashes, and query params
        if (!/^[a-zA-Z0-9\-_/?.=&%]*$/.test(parsed.pathname + (parsed.search || ''))) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * Handle deep link URLs (indii-os://...)
 */
export function handleDeepLink(url: string, mainWindow: BrowserWindow | null) {
    if (!mainWindow) return;

    try {
        // Item 379: Validate deep link before processing
        if (!isDeepLinkSafe(url)) {
            log.warn(`[Main] Blocked unsafe deep link: ${url}`);
            return;
        }

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
