import log from 'electron-log';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import {
    ComputerScreenshotSchema,
    ComputerOpenAppSchema,
    ComputerClickSchema,
    ComputerTypeSchema,
    ComputerKeySchema,
    ComputerScrollSchema,
    ComputerSessionIdSchema,
    ComputerGrantSessionSchema
} from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { computerExecutionService } from '../services/ComputerExecutionService';
import { computerAllowlistStore } from '../services/computer/ComputerAllowlistStore';

/**
 * Computer capability IPC handlers.
 * CE-1 (ISSUE-1110): read path (permissions, screenshot, list/open app).
 * CE-2 (ISSUE-1111): input control (click/type/key/scroll), kill switch, allowlist mgmt.
 * Same security posture as handlers/agent.ts: validateSender + Zod on every channel,
 * uniform { success, data?, error? } envelopes.
 */
export function registerComputerHandlers() {
    ipcMain.handle('computer:check-permissions', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            return { success: true, data: computerExecutionService.getPermissionStatus() };
        } catch (error) {
            log.error('Computer Check Permissions Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:screenshot', async (event: IpcMainInvokeEvent, options?: unknown) => {
        try {
            validateSender(event);
            const parsed = ComputerScreenshotSchema.parse(options ?? undefined);
            const data = await computerExecutionService.screenshot(parsed?.displayId);
            return { success: true, data };
        } catch (error) {
            log.error('Computer Screenshot Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:list-apps', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            const apps = await computerExecutionService.listApps();
            return { success: true, data: { apps } };
        } catch (error) {
            log.error('Computer List Apps Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:open-app', async (event: IpcMainInvokeEvent, app: unknown) => {
        try {
            validateSender(event);
            const validatedApp = ComputerOpenAppSchema.parse(app);
            await computerExecutionService.openApp(validatedApp);
            return { success: true, data: { app: validatedApp } };
        } catch (error) {
            log.error('Computer Open App Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    // --- Input control (CE-2, ISSUE-1111) ------------------------------------

    ipcMain.handle('computer:click', async (event: IpcMainInvokeEvent, args: unknown) => {
        try {
            validateSender(event);
            const { x, y, button } = ComputerClickSchema.parse(args);
            await computerExecutionService.click(x, y, button);
            return { success: true, data: { x, y, button } };
        } catch (error) {
            log.error('Computer Click Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:type', async (event: IpcMainInvokeEvent, args: unknown) => {
        try {
            validateSender(event);
            const { text } = ComputerTypeSchema.parse(args);
            await computerExecutionService.type(text);
            return { success: true, data: { length: text.length } };
        } catch (error) {
            log.error('Computer Type Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:key', async (event: IpcMainInvokeEvent, args: unknown) => {
        try {
            validateSender(event);
            const { combo } = ComputerKeySchema.parse(args);
            await computerExecutionService.key(combo);
            return { success: true, data: { combo } };
        } catch (error) {
            log.error('Computer Key Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:scroll', async (event: IpcMainInvokeEvent, args: unknown) => {
        try {
            validateSender(event);
            const { dx, dy } = ComputerScrollSchema.parse(args);
            await computerExecutionService.scroll(dx, dy);
            return { success: true, data: { dx, dy } };
        } catch (error) {
            log.error('Computer Scroll Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    // --- Kill switch -----------------------------------------------------------

    ipcMain.handle('computer:abort', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            computerExecutionService.abort();
            return { success: true, data: { aborted: true } };
        } catch (error) {
            log.error('Computer Abort Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:reset-abort', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            computerExecutionService.resetAbort();
            return { success: true, data: { aborted: false } };
        } catch (error) {
            log.error('Computer Reset Abort Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:get-abort-state', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            return { success: true, data: { aborted: computerExecutionService.isAborted() } };
        } catch (error) {
            log.error('Computer Get Abort State Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    // --- Allowlist management --------------------------------------------------
    // No renderer UI yet (tracked in ISSUE-1111 as a residual item) — these channels let a
    // trusted operator (e.g. a settings screen built later, or manual store editing) manage
    // which apps computer_open_app may launch. Fail-closed by default: empty list = nothing allowed.

    ipcMain.handle('computer:allowlist-get', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            return { success: true, data: { apps: computerAllowlistStore.getAll() } };
        } catch (error) {
            log.error('Computer Allowlist Get Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:allowlist-add', async (event: IpcMainInvokeEvent, app: unknown) => {
        try {
            validateSender(event);
            const validatedApp = ComputerOpenAppSchema.parse(app);
            computerAllowlistStore.add(validatedApp);
            return { success: true, data: { apps: computerAllowlistStore.getAll() } };
        } catch (error) {
            log.error('Computer Allowlist Add Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:allowlist-remove', async (event: IpcMainInvokeEvent, app: unknown) => {
        try {
            validateSender(event);
            const validatedApp = ComputerOpenAppSchema.parse(app);
            computerAllowlistStore.remove(validatedApp);
            return { success: true, data: { apps: computerAllowlistStore.getAll() } };
        } catch (error) {
            log.error('Computer Allowlist Remove Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    // --- Session-scoped approval grants (CE-5, ISSUE-1114) ----------------------
    // Real, tested primitive. NOT wired into any enforcement point yet — see
    // ComputerExecutionService's class doc and ISSUE-1116.

    ipcMain.handle('computer:grant-session', async (event: IpcMainInvokeEvent, args: unknown) => {
        try {
            validateSender(event);
            const { sessionId, ttlMs } = ComputerGrantSessionSchema.parse(args);
            const grant = computerExecutionService.grantSession(sessionId, ttlMs);
            return { success: true, data: grant };
        } catch (error) {
            log.error('Computer Grant Session Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:revoke-grant', async (event: IpcMainInvokeEvent, sessionId: unknown) => {
        try {
            validateSender(event);
            const validatedId = ComputerSessionIdSchema.parse(sessionId);
            computerExecutionService.revokeGrant(validatedId);
            return { success: true, data: { sessionId: validatedId } };
        } catch (error) {
            log.error('Computer Revoke Grant Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('computer:has-grant', async (event: IpcMainInvokeEvent, sessionId: unknown) => {
        try {
            validateSender(event);
            const validatedId = ComputerSessionIdSchema.parse(sessionId);
            return { success: true, data: { hasGrant: computerExecutionService.hasActiveGrant(validatedId) } };
        } catch (error) {
            log.error('Computer Has Grant Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });
}
