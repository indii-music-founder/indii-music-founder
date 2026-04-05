import { ipcMain } from 'electron';
import log from 'electron-log';
import { SchedulerService } from '../services/SchedulerService';
import type { CreateTaskRequest } from '../../src/services/scheduler/types';

/**
 * IPC Handlers for the indiiOS built-in Task Scheduler.
 * Registered in main.ts via registerSchedulerHandlers().
 */
export function registerSchedulerHandlers(): void {
    // Register a new task
    ipcMain.handle('scheduler:register', (_event, request: CreateTaskRequest) => {
        try {
            const task = SchedulerService.register(request);
            return { success: true, task };
        } catch (err) {
            log.error(`[Scheduler IPC] register failed: ${err}`);
            return { success: false, error: String(err) };
        }
    });

    // Cancel/delete a task
    ipcMain.handle('scheduler:cancel', (_event, taskId: string) => {
        try {
            const cancelled = SchedulerService.cancel(taskId);
            return { success: cancelled };
        } catch (err) {
            log.error(`[Scheduler IPC] cancel failed: ${err}`);
            return { success: false, error: String(err) };
        }
    });

    // Enable or disable a task
    ipcMain.handle('scheduler:set-enabled', (_event, taskId: string, enabled: boolean) => {
        try {
            const updated = SchedulerService.setEnabled(taskId, enabled);
            return { success: updated };
        } catch (err) {
            log.error(`[Scheduler IPC] set-enabled failed: ${err}`);
            return { success: false, error: String(err) };
        }
    });

    // Get all tasks and status
    ipcMain.handle('scheduler:status', () => {
        try {
            return { success: true, status: SchedulerService.status() };
        } catch (err) {
            log.error(`[Scheduler IPC] status failed: ${err}`);
            return { success: false, error: String(err) };
        }
    });

    // Get a single task
    ipcMain.handle('scheduler:get', (_event, taskId: string) => {
        try {
            const task = SchedulerService.get(taskId);
            return { success: true, task };
        } catch (err) {
            log.error(`[Scheduler IPC] get failed: ${err}`);
            return { success: false, error: String(err) };
        }
    });

    log.info('[Scheduler IPC] Handlers registered');
}
