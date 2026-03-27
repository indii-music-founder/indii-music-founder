import type {
    CreateTaskRequest,
    ScheduledTask,
    SchedulerStatus,
    SchedulerTickEvent,
} from './types';

/**
 * indiiOS Scheduler Client Service
 *
 * Renderer-side facade over the IPC bridge to the Electron main process
 * SchedulerService. Manages tasks, subscribes to tick events, and provides
 * a hook-ready API.
 *
 * Usage:
 *   import { SchedulerClientService } from '@/services/scheduler/SchedulerClientService';
 *
 *   // Register a task
 *   await SchedulerClientService.register({ ... });
 *
 *   // Subscribe to Neural Sync (every 30s system check-in)
 *   useEffect(() => SchedulerClientService.onNeuralSync(() => setOnline(true)), []);
 */

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.scheduler;

/** Narrows `window.electronAPI.scheduler` to non-null after asserting availability. */
function api() {
    if (!isElectron) {
        throw new Error('[SchedulerClientService] Only available in Electron context');
    }
    return window.electronAPI!.scheduler!;
}

export const SchedulerClientService = {
    /** Register a new scheduled task. Returns the created task. */
    async register(request: CreateTaskRequest): Promise<ScheduledTask> {
        const res = await api().register(request) as { success: boolean; task?: ScheduledTask; error?: string };
        if (!res.success || !res.task) throw new Error(res.error ?? 'Failed to register task');
        return res.task;
    },

    /** Cancel and permanently remove a task. */
    async cancel(taskId: string): Promise<void> {
        const res = await api().cancel(taskId) as { success: boolean; error?: string };
        if (!res.success) throw new Error(res.error ?? 'Failed to cancel task');
    },

    /** Enable or pause a task without deleting it. */
    async setEnabled(taskId: string, enabled: boolean): Promise<void> {
        const res = await api().setEnabled(taskId, enabled) as { success: boolean; error?: string };
        if (!res.success) throw new Error(res.error ?? 'Failed to update task');
    },

    /** Get full scheduler status — all tasks, active count, total fire count. */
    async status(): Promise<SchedulerStatus> {
        const res = await api().status() as { success: boolean; status?: SchedulerStatus; error?: string };
        if (!res.success || !res.status) throw new Error(res.error ?? 'Failed to get status');
        return res.status;
    },

    /** Get a single task by id. */
    async get(taskId: string): Promise<ScheduledTask | null> {
        const res = await api().get(taskId) as { success: boolean; task?: ScheduledTask | null; error?: string };
        if (!res.success) throw new Error(res.error ?? 'Failed to get task');
        return res.task ?? null;
    },

    /**
     * Subscribe to ALL scheduler tick events.
     * Returns an unsubscribe fn — call it in `useEffect` cleanup.
     *
     * @example
     *   useEffect(() => SchedulerClientService.onTick((e) => console.log(e)), []);
     */
    onTick(callback: (event: SchedulerTickEvent) => void): () => void {
        if (!isElectron) return () => void 0;
        return api().onTick(callback as (e: unknown) => void);
    },

    /**
     * Subscribe to Neural Sync pulses (every 30s system check-in).
     * Returns cleanup fn — ideal for `useEffect`.
     *
     * @example
     *   useEffect(() => SchedulerClientService.onNeuralSync(({ firedAt }) => {
     *     updateLastHeartbeat(firedAt);
     *   }), []);
     */
    onNeuralSync(callback: (payload: { taskId: string; firedAt: string }) => void): () => void {
        if (!isElectron) return () => void 0;
        return api().onNeuralSync(callback as (e: unknown) => void);
    },

    /** True if running inside Electron (scheduler is available). */
    get isAvailable(): boolean {
        return isElectron;
    },
};

export type { CreateTaskRequest, ScheduledTask, SchedulerStatus, SchedulerTickEvent };
