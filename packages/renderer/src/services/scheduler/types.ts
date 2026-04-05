/**
 * indiiOS Built-in Task Scheduler — Shared Types
 * These types are used by both the Electron main process (SchedulerService)
 * and the React renderer (SchedulerClientService).
 */

/** How often a task repeats. */
export type ScheduleInterval =
    | { type: 'interval'; ms: number }         // Run every N milliseconds
    | { type: 'daily'; hour: number; minute: number }  // Run daily at HH:MM
    | { type: 'hourly'; minute: number }       // Run every hour at :MM
    | { type: 'weekly'; dayOfWeek: number; hour: number; minute: number }  // 0=Sun
    | { type: 'once'; runAt: number };         // Unix timestamp — run once

/** A registered scheduled task. */
export interface ScheduledTask {
    id: string;
    name: string;
    description?: string;
    /** IPC channel to invoke when the task fires. */
    action: string;
    /** Optional payload passed to the action. */
    payload?: unknown;
    schedule: ScheduleInterval;
    enabled: boolean;
    /** ISO timestamp of last execution. */
    lastRunAt?: string;
    /** ISO timestamp of next scheduled execution. */
    nextRunAt?: string;
    /** Number of times this task has fired. */
    runCount: number;
    /** ISO timestamp when this task was created. */
    createdAt: string;
    /** Desktop notification on fire? */
    notify?: boolean;
}

/** Payload sent with 'scheduler:tick' IPC events to the renderer. */
export interface SchedulerTickEvent {
    taskId: string;
    taskName: string;
    firedAt: string;  // ISO timestamp
    result?: 'success' | 'error';
    error?: string;
}

/** Request to register a new task. */
export type CreateTaskRequest = Omit<ScheduledTask, 'id' | 'runCount' | 'createdAt' | 'lastRunAt' | 'nextRunAt'>;

/** Summary returned by scheduler:list. */
export interface SchedulerStatus {
    tasks: ScheduledTask[];
    activeCount: number;
    totalFireCount: number;
}
