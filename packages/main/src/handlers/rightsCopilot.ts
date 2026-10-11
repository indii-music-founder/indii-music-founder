import log from 'electron-log';
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, shell } from 'electron';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import type { PortalTarget, BrowserCopilotSessionStatus } from '@indii/shared';

// Domain allowlist mapping each official music rights portal to its valid hostnames
export const PORTAL_ALLOWED_DOMAINS: Record<PortalTarget, string[]> = {
    loc_copyright: ['eco.copyright.gov', 'copyright.gov'],
    the_mlc: ['portal.themlc.com', 'themlc.com'],
    bmi: ['online.bmi.com', 'bmi.com'],
    ascap: ['members.ascap.com', 'ascap.com'],
    soundexchange: ['soundexchange.com', 'licensee.soundexchange.com', 'sportal.soundexchange.com'],
    hfa: ['harryfox.com', 'songfile.com'],
};

export const PORTAL_DEFAULT_URLS: Record<PortalTarget, string> = {
    loc_copyright: 'https://eco.copyright.gov/eService_enu/',
    the_mlc: 'https://portal.themlc.com/',
    bmi: 'https://online.bmi.com/',
    ascap: 'https://members.ascap.com/',
    soundexchange: 'https://sportal.soundexchange.com/',
    hfa: 'https://www.harryfox.com/',
};

const LaunchSessionSchema = z.object({
    portalTarget: z.enum(['loc_copyright', 'the_mlc', 'bmi', 'ascap', 'soundexchange', 'hfa']),
    manifestId: z.string().min(1).max(256),
    targetUrl: z.string().url().optional(),
}).strict();

const CloseSessionSchema = z.object({
    sessionId: z.string().optional(),
}).strict();

export interface ActiveCopilotState {
    sessionId: string;
    portalTarget: PortalTarget;
    manifestId: string;
    status: BrowserCopilotSessionStatus;
    window: BrowserWindow | null;
    createdAtMs: number;
}

class RightsCopilotController {
    private activeSession: ActiveCopilotState | null = null;

    public isUrlAllowedForPortal(targetUrl: string, portalTarget: PortalTarget): boolean {
        try {
            const parsed = new URL(targetUrl);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
            const allowedHosts = PORTAL_ALLOWED_DOMAINS[portalTarget] || [];
            return allowedHosts.some(allowed => 
                parsed.hostname === allowed || parsed.hostname.endsWith(`.${allowed}`)
            );
        } catch {
            return false;
        }
    }

    public async launchSession(
        event: IpcMainInvokeEvent,
        rawInput: unknown
    ): Promise<{ success: boolean; sessionId: string; portalUrl: string }> {
        const input = LaunchSessionSchema.parse(rawInput);
        const { portalTarget, manifestId, targetUrl } = input;

        const officialUrl = targetUrl && this.isUrlAllowedForPortal(targetUrl, portalTarget)
            ? targetUrl
            : PORTAL_DEFAULT_URLS[portalTarget];

        // Close any existing copilot session window cleanly
        if (this.activeSession?.window && !this.activeSession.window.isDestroyed()) {
            this.activeSession.window.close();
            this.activeSession = null;
        }

        const sessionId = `copilot_${portalTarget}_${Date.now()}`;
        const parentWindow = BrowserWindow.fromWebContents(event.sender);

        const copilotWindow = new BrowserWindow({
            width: 1200,
            height: 900,
            title: `indii Rights Copilot — ${portalTarget.toUpperCase()}`,
            parent: parentWindow || undefined,
            modal: false,
            webPreferences: {
                partition: `persist:rights-copilot-${portalTarget}`,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
                webSecurity: true,
            },
        });

        this.activeSession = {
            sessionId,
            portalTarget,
            manifestId,
            status: 'navigating',
            window: copilotWindow,
            createdAtMs: Date.now(),
        };

        // Enforce URL navigation security: block navigation outside official portal domain
        copilotWindow.webContents.on('will-navigate', (navEvent, url) => {
            if (!this.isUrlAllowedForPortal(url, portalTarget)) {
                log.warn(`[RightsCopilot] Blocked navigation outside portal scope: ${url}`);
                navEvent.preventDefault();
            }
        });

        // Block popup windows outside allowed domains; open external links in system browser
        copilotWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (this.isUrlAllowedForPortal(url, portalTarget)) {
                return { action: 'allow' };
            }
            log.info(`[RightsCopilot] Opening external link in OS browser: ${url}`);
            void shell.openExternal(url);
            return { action: 'deny' };
        });

        copilotWindow.on('closed', () => {
            log.info(`[RightsCopilot] Copilot window closed for session: ${sessionId}`);
            if (this.activeSession?.sessionId === sessionId) {
                this.activeSession = null;
            }
            if (!event.sender.isDestroyed()) {
                event.sender.send('rightsCopilot:session-status-changed', {
                    sessionId,
                    status: 'idle',
                });
            }
        });

        await copilotWindow.loadURL(officialUrl);
        this.activeSession.status = 'awaiting_user_auth';

        if (!event.sender.isDestroyed()) {
            event.sender.send('rightsCopilot:session-status-changed', {
                sessionId,
                status: 'awaiting_user_auth',
                portalTarget,
                url: officialUrl,
            });
        }

        log.info(`[RightsCopilot] Launched native copilot session ${sessionId} for ${portalTarget}`);
        return { success: true, sessionId, portalUrl: officialUrl };
    }

    public closeSession(rawInput?: unknown): { success: boolean } {
        if (rawInput) {
            CloseSessionSchema.parse(rawInput);
        }
        if (this.activeSession?.window && !this.activeSession.window.isDestroyed()) {
            this.activeSession.window.close();
        }
        this.activeSession = null;
        return { success: true };
    }

    public getSessionStatus(): {
        isActive: boolean;
        sessionId?: string;
        portalTarget?: PortalTarget;
        manifestId?: string;
        status?: BrowserCopilotSessionStatus;
    } {
        if (!this.activeSession || !this.activeSession.window || this.activeSession.window.isDestroyed()) {
            return { isActive: false };
        }
        return {
            isActive: true,
            sessionId: this.activeSession.sessionId,
            portalTarget: this.activeSession.portalTarget,
            manifestId: this.activeSession.manifestId,
            status: this.activeSession.status,
        };
    }
}

export const rightsCopilotController = new RightsCopilotController();

export function registerRightsCopilotHandlers(): void {
    ipcMain.handle('rightsCopilot:launch-session', async (event, input: unknown) => {
        try {
            validateSender(event);
            return await rightsCopilotController.launchSession(event, input);
        } catch (error) {
            log.error('[RightsCopilot] launchSession failed:', error);
            return {
                success: false,
                error: error instanceof z.ZodError ? error.errors[0].message : error instanceof Error ? error.message : String(error),
            };
        }
    });

    ipcMain.handle('rightsCopilot:close-session', (event, input?: unknown) => {
        try {
            validateSender(event);
            return rightsCopilotController.closeSession(input);
        } catch (error) {
            log.error('[RightsCopilot] closeSession failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('rightsCopilot:get-session-status', (event) => {
        try {
            validateSender(event);
            return { success: true, data: rightsCopilotController.getSessionStatus() };
        } catch (error) {
            log.error('[RightsCopilot] getSessionStatus failed:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });
}
