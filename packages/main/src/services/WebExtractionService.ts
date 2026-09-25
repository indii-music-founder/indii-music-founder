import { BrowserWindow, session } from 'electron';
import { validateSafeUrlAsync } from '../utils/network-security';

export interface WebExtractionResult {
    finalUrl: string;
    title: string;
    text: string;
    fetchedAt: string;
}

/**
 * One-shot, read-only extraction from a public web page.
 *
 * Each request gets a non-persistent Electron session. No cookies, screenshots,
 * input events, or page actions are exposed to callers. Every HTTP(S) request
 * made by the page is checked before Chromium is allowed to issue it, which
 * includes redirect targets and subresources.
 */
export class WebExtractionService {
    private static readonly SESSION_PARTITION = 'web_extract';
    private static readonly NAVIGATION_TIMEOUT_MS = 15_000;
    private static readonly MAX_REDIRECTS = 10;
    private static readonly MAX_TEXT_LENGTH = 40_000;
    private extractionQueue: Promise<void> = Promise.resolve();

    async extract(url: string): Promise<WebExtractionResult> {
        const operation = this.extractionQueue.then(() => this.extractOne(url));
        this.extractionQueue = operation.then(() => undefined, () => undefined);
        return operation;
    }

    private async extractOne(url: string): Promise<WebExtractionResult> {
        const initialUrl = new URL(url);
        if (initialUrl.username || initialUrl.password) {
            throw new Error('URLs containing embedded credentials are not allowed.');
        }

        await validateSafeUrlAsync(initialUrl.href);

        // One dedicated in-memory session is serialized and cleared before/after
        // each request. Electron retains partition sessions for the app lifetime;
        // reusing one bounded partition avoids an unbounded per-request session leak.
        const pageSession = session.fromPartition(WebExtractionService.SESSION_PARTITION, { cache: false });
        await Promise.all([pageSession.clearStorageData(), pageSession.clearCache()]);
        pageSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
        pageSession.setPermissionCheckHandler(() => false);
        const downloadListener = (_event: Electron.Event, item: Electron.DownloadItem) => item.cancel();
        pageSession.on('will-download', downloadListener);

        const requestListener = (details: { url: string }, callback: (response: { cancel?: boolean }) => void) => {
            let requestUrl: URL;
            try {
                requestUrl = new URL(details.url);
            } catch {
                callback({ cancel: true });
                return;
            }

            if (!isHttpUrl(requestUrl.href)) {
                callback({ cancel: true });
                return;
            }

            void validateSafeUrlAsync(requestUrl.href).then(
                () => callback({ cancel: false }),
                () => callback({ cancel: true }),
            );
        };
        pageSession.webRequest.onBeforeRequest(
            { urls: ['<all_urls>'] },
            requestListener,
        );

        let redirectCount = 0;
        const navigationListener = (event: Electron.Event, targetUrl: string) => {
            if (!isHttpUrl(targetUrl)) event.preventDefault();
        };
        const redirectListener = (event: Electron.Event, targetUrl: string) => {
            redirectCount += 1;
            if (redirectCount > WebExtractionService.MAX_REDIRECTS || !isHttpUrl(targetUrl)) {
                event.preventDefault();
            }
        };
        let window: BrowserWindow | undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            window = new BrowserWindow({
                show: false,
                width: 1280,
                height: 800,
                webPreferences: {
                    session: pageSession,
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true,
                    webSecurity: true,
                },
            });
            window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
            window.webContents.on('will-navigate', navigationListener);
            window.webContents.on('will-redirect', redirectListener);

            await Promise.race([
                window.loadURL(initialUrl.href),
                new Promise<never>((_resolve, reject) => {
                    timeout = setTimeout(
                        () => reject(new Error('Web extraction timed out.')),
                        WebExtractionService.NAVIGATION_TIMEOUT_MS,
                    );
                }),
            ]);

            if (redirectCount > WebExtractionService.MAX_REDIRECTS) {
                throw new Error('Web extraction stopped after too many redirects.');
            }

            const finalUrl = window.webContents.getURL();
            await validateSafeUrlAsync(finalUrl);
            const page = await window.webContents.executeJavaScript(`({
                title: document.title || '',
                text: document.body?.innerText || ''
            })`) as { title: string; text: string };

            return {
                finalUrl,
                title: page.title.slice(0, 500),
                text: page.text.slice(0, WebExtractionService.MAX_TEXT_LENGTH),
                fetchedAt: new Date().toISOString(),
            };
        } finally {
            if (timeout) clearTimeout(timeout);
            if (window && !window.isDestroyed()) {
                window.webContents.removeListener('will-navigate', navigationListener);
                window.webContents.removeListener('will-redirect', redirectListener);
            }
            if (window && !window.isDestroyed()) window.destroy();
            pageSession.removeListener('will-download', downloadListener);
            pageSession.webRequest.onBeforeRequest(null);
            pageSession.setPermissionRequestHandler(null);
            pageSession.setPermissionCheckHandler(null);
            await Promise.allSettled([
                pageSession.clearStorageData(),
                pageSession.clearCache(),
            ]);
        }
    }
}

export const webExtractionService = new WebExtractionService();

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
    } catch {
        return false;
    }
}
