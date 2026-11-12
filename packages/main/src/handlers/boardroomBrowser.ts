import log from 'electron-log';
import { BrowserWindow, WebContentsView, ipcMain, session, shell, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { validateSafeUrlAsync } from '../utils/network-security';

export interface BoardroomBrowserState {
    url: string;
    title: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    error: string | null;
}

const BoundsSchema = z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    visible: z.boolean().default(true),
}).strict();

const NavigateSchema = z.object({
    url: z.string().trim().min(1).max(4096),
}).strict();

const AttachSchema = z.object({
    initialUrl: z.string().trim().max(4096).optional(),
}).strict();

class BoardroomBrowserController {
    private view: WebContentsView | null = null;
    private pageRevision = 0;
    private ownerWindow: BrowserWindow | null = null;
    private partitionSession = session.fromPartition('persist:boardroom-browser');

    private currentState: BoardroomBrowserState = {
        url: 'https://artists.spotify.com',
        title: 'Spotify for Artists',
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        error: null,
    };

    constructor() {
        // Harden the partition session
        this.partitionSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
        this.partitionSession.setPermissionCheckHandler(() => false);
        // Validate page requests as well as frame navigations and redirects:
        // scripts and fetches can otherwise reach private network destinations.
        this.partitionSession.webRequest.onBeforeRequest(
            (details, callback) => {
                // WebSocket URLs use the same network hosts as HTTP(S).
                const checkUrl = details.url.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
                if (!/^https?:/i.test(checkUrl)) {
                    callback({ cancel: false });
                    return;
                }
                let settled = false;
                const finish = (cancel: boolean) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);
                    callback({ cancel });
                };
                const timeout = setTimeout(() => finish(true), 5_000);
                void validateSafeUrlAsync(checkUrl).then(
                    () => finish(false),
                    () => finish(true),
                );
            },
        );
    }

    private emitState() {
        if (!this.ownerWindow || this.ownerWindow.isDestroyed()) return;
        try {
            this.ownerWindow.webContents.send('boardroom-browser:state-changed', { ...this.currentState });
        } catch (err) {
            log.warn('[BoardroomBrowser] Failed to emit state:', err);
        }
    }

    private updateState(partial: Partial<BoardroomBrowserState>) {
        this.currentState = { ...this.currentState, ...partial };
        this.emitState();
    }

    private normalizeUrl(input: string): string {
        const trimmed = input.trim();
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
            return trimmed;
        }
        // If user typed a search query or bare domain
        if (trimmed.includes('.') && !trimmed.includes(' ')) {
            return `https://${trimmed}`;
        }
        return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }

    public async attach(event: IpcMainInvokeEvent, rawInput: unknown): Promise<{ success: boolean; state: BoardroomBrowserState }> {
        const input = AttachSchema.parse(rawInput || {});
        const targetUrl = this.normalizeUrl(input.initialUrl || this.currentState.url || 'https://artists.spotify.com');

        await validateSafeUrlAsync(targetUrl);

        const parentWin = BrowserWindow.fromWebContents(event.sender);
        if (!parentWin) {
            throw new Error('Parent window not found for Boardroom browser.');
        }

        this.ownerWindow = parentWin;

        if (!this.view) {
            this.view = new WebContentsView({
                webPreferences: {
                    session: this.partitionSession,
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true,
                    webSecurity: true,
                },
            });

            const wc = this.view.webContents;

            wc.on('did-start-loading', () => {
                this.pageRevision += 1;
                this.updateState({ isLoading: true, error: null });
            });

            wc.on('did-stop-loading', () => {
                this.updateState({
                    isLoading: false,
                    canGoBack: wc.canGoBack(),
                    canGoForward: wc.canGoForward(),
                });
            });

            wc.on('did-navigate', (_e, url) => {
                this.updateState({
                    url,
                    canGoBack: wc.canGoBack(),
                    canGoForward: wc.canGoForward(),
                    error: null,
                });
            });

            wc.on('did-navigate-in-page', (_e, url) => {
                this.pageRevision += 1;
                this.updateState({
                    url,
                    canGoBack: wc.canGoBack(),
                    canGoForward: wc.canGoForward(),
                });
            });

            wc.on('page-title-updated', (_e, title) => {
                this.updateState({ title });
            });

            wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
                // Subframe failures and superseded navigations do not invalidate the page.
                if (errorCode === -3 || !isMainFrame) return;
                this.updateState({
                    isLoading: false,
                    error: `${errorDescription} (${errorCode}) for ${validatedURL}`,
                });
            });

            // Prevent opening unexpected popups; load in same view or open in external OS browser
            wc.setWindowOpenHandler(({ url }) => {
                // Always deny a new window, then validate before navigating the
                // existing view. HTTP scheme alone does not exclude private hosts.
                const revision = this.pageRevision;
                void validateSafeUrlAsync(url)
                    .then(() => {
                        if (this.view?.webContents === wc && this.pageRevision === revision) return wc.loadURL(url);
                    })
                    .catch(() => log.warn('[BoardroomBrowser] Blocked unsafe popup navigation.'));
                return { action: 'deny' };
            });

            // Restrict will-navigate to safe HTTP/HTTPS only
            wc.on('will-navigate', (e, targetNavUrl) => {
                try {
                    const parsed = new URL(targetNavUrl);
                    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                        e.preventDefault();
                    }
                } catch {
                    e.preventDefault();
                }
            });

            // Add view to window content view
            parentWin.contentView.addChildView(this.view);
            // Default 0x0 hidden until setBounds is called
            this.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
            this.view.setVisible(false);
        }

        // Navigate to target if different or not loaded
        if (this.view.webContents.getURL() !== targetUrl) {
            await this.view.webContents.loadURL(targetUrl);
        }

        return { success: true, state: { ...this.currentState } };
    }

    public setBounds(event: IpcMainInvokeEvent, rawInput: unknown): { success: boolean } {
        const input = BoundsSchema.parse(rawInput);
        if (!this.view || !this.ownerWindow) {
            return { success: false };
        }

        this.view.setBounds({
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
        });
        this.view.setVisible(input.visible && input.width > 0 && input.height > 0);
        return { success: true };
    }

    public async navigate(event: IpcMainInvokeEvent, rawInput: unknown): Promise<{ success: boolean; url: string }> {
        const input = NavigateSchema.parse(rawInput);
        const targetUrl = this.normalizeUrl(input.url);

        await validateSafeUrlAsync(targetUrl);

        if (!this.view) {
            await this.attach(event, { initialUrl: targetUrl });
            return { success: true, url: targetUrl };
        }

        await this.view.webContents.loadURL(targetUrl);
        return { success: true, url: targetUrl };
    }

    public goBack(event: IpcMainInvokeEvent): { success: boolean } {
        if (this.view && this.view.webContents.canGoBack()) {
            this.view.webContents.goBack();
            return { success: true };
        }
        return { success: false };
    }

    public goForward(event: IpcMainInvokeEvent): { success: boolean } {
        if (this.view && this.view.webContents.canGoForward()) {
            this.view.webContents.goForward();
            return { success: true };
        }
        return { success: false };
    }

    public reload(event: IpcMainInvokeEvent): { success: boolean } {
        if (this.view) {
            this.view.webContents.reload();
            return { success: true };
        }
        return { success: false };
    }

    public async captureContext(event: IpcMainInvokeEvent): Promise<{ success: boolean; data: { url: string; title: string; text: string } }> {
        if (!this.view) {
            throw new Error('Boardroom browser view is not active.');
        }

        if (this.currentState.isLoading || this.currentState.error) {
            throw new Error('Page is loading or failed to load; its content cannot be captured.');
        }

        const revision = this.pageRevision;
        const view = this.view;
        const data = await view.webContents.executeJavaScript(`(() => {
            return {
                title: document.title || '',
                url: window.location.href || '',
                text: (document.body ? document.body.innerText : '').slice(0, 40000)
            };
        })()`) as { url: string; title: string; text: string };

        if (this.view !== view || this.pageRevision !== revision || this.currentState.isLoading || this.currentState.error) {
            throw new Error('Page changed while its content was being captured.');
        }
        return { success: true, data };
    }

    public detach(event: IpcMainInvokeEvent): { success: boolean } {
        if (this.view && this.ownerWindow && !this.ownerWindow.isDestroyed()) {
            try {
                this.view.setVisible(false);
                this.ownerWindow.contentView.removeChildView(this.view);
            } catch (err) {
                log.warn('[BoardroomBrowser] Error removing child view:', err);
            }
        }
        this.pageRevision += 1;
        this.view = null;
        this.ownerWindow = null;
        return { success: true };
    }

    public openExternal(event: IpcMainInvokeEvent, rawUrl?: string): { success: boolean } {
        const target = rawUrl?.trim() || this.currentState.url;
        if (target) {
            void shell.openExternal(target);
            return { success: true };
        }
        return { success: false };
    }
}

export const boardroomBrowserController = new BoardroomBrowserController();

export function registerBoardroomBrowserHandlers(): void {
    ipcMain.handle('boardroom-browser:attach', async (event, rawInput) => {
        try {
            validateSender(event);
            return await boardroomBrowserController.attach(event, rawInput);
        } catch (error) {
            log.error('[BoardroomBrowser] Attach failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:set-bounds', async (event, rawInput) => {
        try {
            validateSender(event);
            return boardroomBrowserController.setBounds(event, rawInput);
        } catch (error) {
            log.error('[BoardroomBrowser] setBounds failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:navigate', async (event, rawInput) => {
        try {
            validateSender(event);
            return await boardroomBrowserController.navigate(event, rawInput);
        } catch (error) {
            log.error('[BoardroomBrowser] Navigate failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:go-back', async (event) => {
        try {
            validateSender(event);
            return boardroomBrowserController.goBack(event);
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:go-forward', async (event) => {
        try {
            validateSender(event);
            return boardroomBrowserController.goForward(event);
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:reload', async (event) => {
        try {
            validateSender(event);
            return boardroomBrowserController.reload(event);
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:capture-context', async (event) => {
        try {
            validateSender(event);
            return await boardroomBrowserController.captureContext(event);
        } catch (error) {
            log.error('[BoardroomBrowser] captureContext failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:detach', async (event) => {
        try {
            validateSender(event);
            return boardroomBrowserController.detach(event);
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('boardroom-browser:open-external', async (event, rawUrl) => {
        try {
            validateSender(event);
            return boardroomBrowserController.openExternal(event, rawUrl);
        } catch (error) {
            return { success: false, error: String(error) };
        }
    });
}
