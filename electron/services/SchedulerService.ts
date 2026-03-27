import Store from 'electron-store';
import { app, BrowserWindow, Notification } from 'electron';
import path from 'path';
import log from 'electron-log';
import type {
    ScheduledTask,
    ScheduleInterval,
    CreateTaskRequest,
    SchedulerTickEvent,
    SchedulerStatus,
} from '../../src/services/scheduler/types';

/**
 * indiiOS Built-in Task Scheduler
 *
 * A first-party, zero-dependency cron/task scheduler running in the
 * Electron main process. Uses Node.js setInterval/setTimeout under the hood,
 * persists jobs to electron-store so they survive restarts, and fires
 * IPC events back to the renderer on each tick.
 *
 * Usage:
 *   SchedulerService.register({ name: 'Sync Royalties', action: 'finance:sync', schedule: { type: 'daily', hour: 3, minute: 0 } });
 *   SchedulerService.start();
 */

interface StoreSchema {
    tasks: Record<string, ScheduledTask>;
}

const store = new Store<StoreSchema>({
    name: 'indii-scheduler',
    defaults: { tasks: {} },
});

// In-memory timers — not persisted (rebuilt on every start)
const timers = new Map<string, NodeJS.Timeout>();

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function computeNextRunAt(schedule: ScheduleInterval, fromNow: Date = new Date()): Date {
    const now = new Date(fromNow);

    switch (schedule.type) {
        case 'interval':
            return new Date(now.getTime() + schedule.ms);

        case 'daily': {
            const next = new Date(now);
            next.setHours(schedule.hour, schedule.minute, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            return next;
        }

        case 'hourly': {
            const next = new Date(now);
            next.setMinutes(schedule.minute, 0, 0);
            if (next <= now) next.setHours(next.getHours() + 1);
            return next;
        }

        case 'weekly': {
            const next = new Date(now);
            const daysUntil = (schedule.dayOfWeek - now.getDay() + 7) % 7 || 7;
            next.setDate(next.getDate() + daysUntil);
            next.setHours(schedule.hour, schedule.minute, 0, 0);
            return next;
        }

        case 'once':
            return new Date(schedule.runAt);
    }
}

function msUntilNext(nextRunAt: string): number {
    const ms = new Date(nextRunAt).getTime() - Date.now();
    return Math.max(ms, 0);
}

function broadcastTick(event: SchedulerTickEvent): void {
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('scheduler:tick', event);
        }
    });
}

// ─── Core Scheduler ────────────────────────────────────────────────────────

export const SchedulerService = {
    /**
     * Register a new task (or update an existing one by id).
     * Persists to disk and schedules it immediately if enabled.
     */
    register(request: CreateTaskRequest, existingId?: string): ScheduledTask {
        const id = existingId ?? generateId();
        const nextRunAt = computeNextRunAt(request.schedule);

        const task: ScheduledTask = {
            ...request,
            id,
            runCount: 0,
            createdAt: new Date().toISOString(),
            nextRunAt: nextRunAt.toISOString(),
        };

        const tasks = store.get('tasks');
        tasks[id] = task;
        store.set('tasks', tasks);

        if (task.enabled) {
            SchedulerService._scheduleTimer(task);
        }

        log.info(`[Scheduler] Registered task: "${task.name}" (${id}) — next run: ${task.nextRunAt}`);
        return task;
    },

    /** Remove a task permanently. */
    cancel(taskId: string): boolean {
        const tasks = store.get('tasks');
        if (!tasks[taskId]) return false;

        SchedulerService._clearTimer(taskId);
        delete tasks[taskId];
        store.set('tasks', tasks);

        log.info(`[Scheduler] Cancelled task: ${taskId}`);
        return true;
    },

    /** Enable or disable a task without deleting it. */
    setEnabled(taskId: string, enabled: boolean): boolean {
        const tasks = store.get('tasks');
        const task = tasks[taskId];
        if (!task) return false;

        task.enabled = enabled;
        tasks[taskId] = task;
        store.set('tasks', tasks);

        if (enabled) {
            SchedulerService._scheduleTimer(task);
        } else {
            SchedulerService._clearTimer(taskId);
        }

        log.info(`[Scheduler] Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    },

    /** List all tasks with current status. */
    status(): SchedulerStatus {
        const tasks = Object.values(store.get('tasks'));
        const activeCount = tasks.filter(t => t.enabled).length;
        const totalFireCount = tasks.reduce((sum, t) => sum + t.runCount, 0);
        return { tasks, activeCount, totalFireCount };
    },

    /** Get a single task by id. */
    get(taskId: string): ScheduledTask | null {
        return store.get('tasks')[taskId] ?? null;
    },

    /**
     * Start the scheduler. Call once in app.on('ready').
     * Rebuilds all timers from persisted state.
     */
    start(): void {
        const tasks = store.get('tasks');
        let count = 0;

        for (const task of Object.values(tasks)) {
            if (task.enabled) {
                SchedulerService._scheduleTimer(task);
                count++;
            }
        }

        log.info(`[Scheduler] Started — ${count} active tasks loaded from store`);
    },

    /** Stop all timers (called on app quit). */
    stop(): void {
        for (const [id] of timers) {
            SchedulerService._clearTimer(id);
        }
        log.info('[Scheduler] All timers cleared');
    },

    // ── Private ──────────────────────────────────────────────────────────────

    _clearTimer(taskId: string): void {
        const existing = timers.get(taskId);
        if (existing) {
            clearTimeout(existing);
            timers.delete(taskId);
        }
    },

    _scheduleTimer(task: ScheduledTask): void {
        SchedulerService._clearTimer(task.id);

        // If nextRunAt is in the past, recompute
        let nextRunAt = task.nextRunAt
            ? new Date(task.nextRunAt)
            : computeNextRunAt(task.schedule);

        if (nextRunAt < new Date()) {
            nextRunAt = computeNextRunAt(task.schedule);
            // Persist the updated nextRunAt
            const tasks = store.get('tasks');
            if (tasks[task.id]) {
                tasks[task.id].nextRunAt = nextRunAt.toISOString();
                store.set('tasks', tasks);
            }
        }

        const delay = Math.max(nextRunAt.getTime() - Date.now(), 0);

        const timer = setTimeout(() => {
            SchedulerService._fire(task.id);
        }, delay);

        timers.set(task.id, timer);
        log.info(`[Scheduler] Timer set for "${task.name}" in ${Math.round(delay / 1000)}s`);
    },

    async _fire(taskId: string): Promise<void> {
        const tasks = store.get('tasks');
        const task = tasks[taskId];

        if (!task || !task.enabled) {
            log.warn(`[Scheduler] Task ${taskId} fired but is no longer enabled — skipping`);
            return;
        }

        const firedAt = new Date().toISOString();
        log.info(`[Scheduler] Firing task: "${task.name}" (${taskId})`);

        // Update run count and timestamps
        task.runCount += 1;
        task.lastRunAt = firedAt;

        let result: 'success' | 'error' = 'success';
        let errorMsg: string | undefined;

        // Broadcast IPC action to renderer
        try {
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send(task.action, {
                        taskId,
                        payload: task.payload,
                        firedAt,
                    });
                }
            });
        } catch (err) {
            result = 'error';
            errorMsg = String(err);
            log.error(`[Scheduler] Task "${task.name}" action failed: ${err}`);
        }

        // Broadcast tick event to renderer
        const tickEvent: SchedulerTickEvent = {
            taskId,
            taskName: task.name,
            firedAt,
            result,
            error: errorMsg,
        };
        broadcastTick(tickEvent);

        // Optional desktop notification
        if (task.notify && Notification.isSupported()) {
            const notif = new Notification({
                title: `indiiOS Scheduler`,
                body: `Task "${task.name}" completed`,
                icon: path.join(app.getAppPath(), 'public/icon-192.png'),
                silent: true,
            });
            notif.show();
        }

        // Reschedule if recurring, or clean up if 'once'
        if (task.schedule.type === 'once') {
            task.enabled = false;
            task.nextRunAt = undefined;
            tasks[taskId] = task;
            store.set('tasks', tasks);
            log.info(`[Scheduler] One-time task "${task.name}" completed and disabled`);
        } else {
            const next = computeNextRunAt(task.schedule);
            task.nextRunAt = next.toISOString();
            tasks[taskId] = task;
            store.set('tasks', tasks);
            SchedulerService._scheduleTimer(task);
        }
    },

    /**
     * Register built-in indiiOS system tasks.
     * Called once from main.ts after start().
     */
    registerBuiltInTasks(): void {
        const tasks = store.get('tasks');

        const builtIns: CreateTaskRequest[] = [
            {
                // Neural Sync — formerly "Heartbeat". Periodic system check-in:
                // sidecar health, memory posture, and service connectivity.
                // The renderer receives 'scheduler:neural-sync' each tick and can
                // surface status in the Observability module.
                name: 'Neural Sync',
                description: 'Periodic system health check-in — sidecar status, memory posture, service connectivity',
                action: 'scheduler:neural-sync',
                schedule: { type: 'interval', ms: 30 * 1000 }, // every 30s (matches legacy heartbeat)
                enabled: true,
                notify: false,
            },
            {
                name: 'Royalty Sync',
                description: 'Syncs royalty data from all distributors nightly',
                action: 'scheduler:royalty-sync',
                schedule: { type: 'daily', hour: 3, minute: 0 },
                enabled: true,
                notify: false,
            },
            {
                name: 'Distribution Health Check',
                description: 'Checks delivery status of pending releases',
                action: 'scheduler:distribution-health',
                schedule: { type: 'hourly', minute: 15 },
                enabled: true,
                notify: false,
            },
            {
                name: 'Finance Snapshot',
                description: 'Takes a weekly revenue snapshot for reporting',
                action: 'scheduler:finance-snapshot',
                schedule: { type: 'weekly', dayOfWeek: 1, hour: 6, minute: 0 }, // Monday 6am
                enabled: true,
                notify: false,
            },
            {
                name: 'Workflow Queue Flush',
                description: 'Processes any queued workflow automation tasks',
                action: 'scheduler:workflow-flush',
                schedule: { type: 'interval', ms: 5 * 60 * 1000 }, // every 5 min
                enabled: true,
                notify: false,
            },
        ];

        let registered = 0;
        for (const task of builtIns) {
            // Only register if not already in store (preserves user customizations)
            const alreadyExists = Object.values(tasks).some(t => t.name === task.name);
            if (!alreadyExists) {
                SchedulerService.register(task);
                registered++;
            }
        }

        if (registered > 0) {
            log.info(`[Scheduler] Registered ${registered} built-in tasks`);
        }
    },
};
