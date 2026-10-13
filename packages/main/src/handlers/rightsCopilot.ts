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
    workTitle: z.string().max(512).optional(),
    artistLegalName: z.string().max(512).optional(),
    isrc: z.string().max(64).optional(),
    depositFilename: z.string().max(512).optional(),
    depositChecksum: z.string().max(128).optional(),
}).strict();

const ExecuteStepSchema = z.object({
    action: z.object({
        id: z.string().min(1).max(128),
        type: z.enum([
            'navigate',
            'highlight_element',
            'autofill_input',
            'select_option',
            'stage_deposit_upload',
            'pause_for_user_auth',
            'pause_for_user_payment',
            'verify_dom_field',
            'extract_confirmation',
        ]),
        description: z.string().min(1).max(1024),
        targetSelector: z.string().max(512).optional(),
        targetFieldKey: z.string().max(256).optional(),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        requiresUserAction: z.boolean(),
    }),
}).strict();

const CloseSessionSchema = z.object({
    sessionId: z.string().optional(),
}).strict();

export interface CopilotOverlayContext {
    portalTarget: PortalTarget;
    workTitle?: string;
    artistLegalName?: string;
    isrc?: string;
    depositFilename?: string;
    depositChecksum?: string;
    stepDescription?: string;
    status?: BrowserCopilotSessionStatus;
}

export interface ActiveCopilotState {
    sessionId: string;
    portalTarget: PortalTarget;
    manifestId: string;
    status: BrowserCopilotSessionStatus;
    window: BrowserWindow | null;
    createdAtMs: number;
    overlayContext: CopilotOverlayContext;
}

const SENSITIVE_SELECTOR_PATTERN =
    /password|passphrase|passwd|secret|token|pin|otp|2fa|totp|mfa|captcha|ssn|social[_-]?security|tax[_-]?id|ein|card|cc-|cvv|cvc|expir|routing|account[_-]?num|iban/i;

const UNSAFE_SELECTOR_CHARS_PATTERN = /[<>;'"`\r\n\\]/;

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

    /**
     * Enforces ISSUE-1511 Credential Isolation Benchmark:
     * Rejects any selector targeting password, authentication, tax/SSN, or payment fields,
     * as well as any selector containing script-injection characters.
     */
    public isSafeCopilotSelector(selector: string): boolean {
        const trimmed = selector.trim();
        if (!trimmed || trimmed.length > 512) return false;
        if (UNSAFE_SELECTOR_CHARS_PATTERN.test(trimmed)) return false;
        if (SENSITIVE_SELECTOR_PATTERN.test(trimmed)) return false;
        return true;
    }

    /**
     * Generates a self-contained, CSP-friendly DOM overlay script that renders the
     * non-intrusive indii Rights Copilot HUD inside the official portal BrowserWindow.
     */
    public buildCopilotOverlayScript(ctx: CopilotOverlayContext): string {
        const payloadJson = JSON.stringify({
            portal: ctx.portalTarget.toUpperCase().replace('_', ' '),
            workTitle: ctx.workTitle || 'Active Filing',
            artistLegalName: ctx.artistLegalName || 'Verified Claimant',
            isrc: ctx.isrc || '',
            depositFilename: ctx.depositFilename || '',
            depositChecksum: ctx.depositChecksum ? `${ctx.depositChecksum.slice(0, 12)}...` : '',
            stepDescription: ctx.stepDescription || 'Sign in to your official account to begin assisted autofill.',
            status: ctx.status || 'awaiting_user_auth',
        });

        return `(() => {
            const data = ${payloadJson};
            let hud = document.getElementById('indii-rights-copilot-hud');
            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'indii-rights-copilot-hud';
                hud.style.cssText = [
                    'position:fixed',
                    'bottom:16px',
                    'right:16px',
                    'z-index:2147483647',
                    'width:340px',
                    'background:rgba(13,13,13,0.95)',
                    'color:#ffffff',
                    'border:1px solid rgba(255,184,0,0.45)',
                    'border-radius:14px',
                    'padding:12px 14px',
                    'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
                    'font-size:12px',
                    'line-height:1.4',
                    'box-shadow:0 12px 32px rgba(0,0,0,0.65)',
                    'pointer-events:auto'
                ].join(';');
                document.body.appendChild(hud);
            }
            hud.textContent = '';

            const header = document.createElement('div');
            header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:700;color:#ffb800;';
            header.textContent = 'indii Rights Copilot • ' + data.portal;
            hud.appendChild(header);

            const meta = document.createElement('div');
            meta.style.cssText = 'color:rgba(255,255,255,0.85);font-size:11px;margin-bottom:6px;';
            meta.textContent = data.workTitle + ' — ' + data.artistLegalName + (data.isrc ? ' (' + data.isrc + ')' : '');
            hud.appendChild(meta);

            if (data.depositFilename) {
                const dep = document.createElement('div');
                dep.style.cssText = 'color:#34d399;font-size:10px;font-family:monospace;margin-bottom:6px;';
                dep.textContent = 'Deposit: ' + data.depositFilename + ' [SHA-256: ' + data.depositChecksum + ']';
                hud.appendChild(dep);
            }

            const step = document.createElement('div');
            step.style.cssText = 'background:rgba(255,255,255,0.06);border-radius:8px;padding:6px 8px;font-size:11px;color:#fff;margin-bottom:6px;';
            step.textContent = data.stepDescription;
            hud.appendChild(step);

            const privacy = document.createElement('div');
            privacy.style.cssText = 'color:rgba(255,255,255,0.45);font-size:10px;';
            privacy.textContent = 'Zero-Credential Isolation: Passwords & payments stay strictly in your browser.';
            hud.appendChild(privacy);
            return true;
        })();`;
    }

    public async launchSession(
        event: IpcMainInvokeEvent,
        rawInput: unknown
    ): Promise<{ success: boolean; sessionId: string; portalUrl: string }> {
        const input = LaunchSessionSchema.parse(rawInput);
        const {
            portalTarget,
            manifestId,
            targetUrl,
            workTitle,
            artistLegalName,
            isrc,
            depositFilename,
            depositChecksum,
        } = input;

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

        const overlayContext: CopilotOverlayContext = {
            portalTarget,
            workTitle,
            artistLegalName,
            isrc,
            depositFilename,
            depositChecksum,
            status: 'awaiting_user_auth',
        };

        this.activeSession = {
            sessionId,
            portalTarget,
            manifestId,
            status: 'navigating',
            window: copilotWindow,
            createdAtMs: Date.now(),
            overlayContext,
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

        // Re-inject HUD overlay whenever a page finishes loading inside the portal session
        copilotWindow.webContents.on('did-finish-load', () => {
            if (this.activeSession?.sessionId === sessionId && !copilotWindow.isDestroyed()) {
                const script = this.buildCopilotOverlayScript(this.activeSession.overlayContext);
                void copilotWindow.webContents.executeJavaScript(script, true).catch((err) => {
                    log.warn('[RightsCopilot] HUD overlay injection skipped on page load:', err);
                });
            }
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

    /**
     * Executes a single CopilotAction step inside the active portal BrowserWindow
     * while enforcing strict credential isolation (never touching password or payment inputs).
     */
    public async executeActionStep(
        event: IpcMainInvokeEvent | null,
        rawInput: unknown
    ): Promise<{
        success: boolean;
        status: BrowserCopilotSessionStatus;
        requiresUserAction?: boolean;
        extractedValue?: string;
    }> {
        const { action } = ExecuteStepSchema.parse(rawInput);

        if (action.targetSelector && !this.isSafeCopilotSelector(action.targetSelector)) {
            throw new Error(
                `Refusing to interact with credential, authentication, or payment selector: ${action.targetSelector}`
            );
        }

        if (!this.activeSession || !this.activeSession.window || this.activeSession.window.isDestroyed()) {
            throw new Error('No active Rights Copilot browser session');
        }

        const { window: copilotWindow, sessionId, portalTarget } = this.activeSession;

        const notifyStatus = (status: BrowserCopilotSessionStatus, extra?: Record<string, unknown>) => {
            if (!this.activeSession) return;
            this.activeSession.status = status;
            this.activeSession.overlayContext = {
                ...this.activeSession.overlayContext,
                stepDescription: action.description,
                status,
            };
            const hudScript = this.buildCopilotOverlayScript(this.activeSession.overlayContext);
            void copilotWindow.webContents.executeJavaScript(hudScript, true).catch(() => {});

            if (event && !event.sender.isDestroyed()) {
                event.sender.send('rightsCopilot:session-status-changed', {
                    sessionId,
                    status,
                    portalTarget,
                    stepId: action.id,
                    ...extra,
                });
            }
        };

        if (action.type === 'pause_for_user_auth') {
            notifyStatus('awaiting_user_auth');
            return { success: true, status: 'awaiting_user_auth', requiresUserAction: true };
        }

        if (action.type === 'pause_for_user_payment') {
            notifyStatus('awaiting_user_payment');
            return { success: true, status: 'awaiting_user_payment', requiresUserAction: true };
        }

        if (action.type === 'stage_deposit_upload') {
            notifyStatus('deposit_uploading');
            return { success: true, status: 'deposit_uploading' };
        }

        if (action.type === 'navigate' && typeof action.value === 'string') {
            if (!this.isUrlAllowedForPortal(action.value, portalTarget)) {
                throw new Error(`Navigation target is outside allowed portal domain: ${action.value}`);
            }
            notifyStatus('navigating');
            await copilotWindow.loadURL(action.value);
            return { success: true, status: 'navigating' };
        }

        if (
            (action.type === 'autofill_input' ||
                action.type === 'select_option' ||
                action.type === 'highlight_element' ||
                action.type === 'verify_dom_field') &&
            action.targetSelector
        ) {
            notifyStatus('filling_fields');
            const selectorJson = JSON.stringify(action.targetSelector);
            const valueJson = JSON.stringify(action.value !== undefined ? String(action.value) : '');
            const modeJson = JSON.stringify(action.type);

            const domScript = `(() => {
                const el = document.querySelector(${selectorJson});
                if (!el) return { found: false };
                const inputType = (el.getAttribute('type') || '').toLowerCase();
                const autoComplete = (el.getAttribute('autocomplete') || '').toLowerCase();
                if (inputType === 'password' || autoComplete.startsWith('cc-')) {
                    return { found: false, blockedCredentialField: true };
                }
                el.style.outline = '2px solid #ffb800';
                el.style.outlineOffset = '2px';
                if (typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                const mode = ${modeJson};
                if (mode === 'autofill_input' || mode === 'select_option') {
                    el.value = ${valueJson};
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return { found: true, currentValue: el.value || el.textContent || '' };
            })();`;

            await copilotWindow.webContents.executeJavaScript(domScript, true);
            return { success: true, status: 'filling_fields' };
        }

        if (action.type === 'extract_confirmation' && action.targetSelector) {
            notifyStatus('verifying');
            const selectorJson = JSON.stringify(action.targetSelector);
            const extractScript = `(() => {
                const el = document.querySelector(${selectorJson});
                if (!el) return '';
                return (el.textContent || el.value || '').trim();
            })();`;
            const extracted = await copilotWindow.webContents.executeJavaScript(extractScript, true);
            const extractedValue = typeof extracted === 'string' && extracted.length > 0 ? extracted : undefined;
            const nextStatus: BrowserCopilotSessionStatus = extractedValue ? 'completed' : 'verifying';
            notifyStatus(nextStatus, extractedValue ? { confirmationNumber: extractedValue } : undefined);
            return {
                success: true,
                status: nextStatus,
                ...(extractedValue ? { extractedValue } : {}),
            };
        }

        notifyStatus('filling_fields');
        return { success: true, status: 'filling_fields' };
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

    ipcMain.handle('rightsCopilot:execute-step', async (event, input: unknown) => {
        try {
            validateSender(event);
            return await rightsCopilotController.executeActionStep(event, input);
        } catch (error) {
            log.error('[RightsCopilot] executeActionStep failed:', error);
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

