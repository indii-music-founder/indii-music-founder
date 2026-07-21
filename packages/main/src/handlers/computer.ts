import log from 'electron-log';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { ComputerScreenshotSchema, ComputerOpenAppSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { computerExecutionService } from '../services/ComputerExecutionService';

/**
 * Computer capability IPC handlers (CE-1, ISSUE-1110).
 * Same security posture as handlers/agent.ts: validateSender + Zod on every channel,
 * uniform { success, data?, error? } envelopes. Input control (click/type) is CE-2.
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
}
