/**
 * SchedulerService Unit Tests
 *
 * Tests the Electron main-process task scheduler:
 * - Task registration, cancellation, enable/disable
 * - Timer scheduling and firing
 * - Built-in task registration (Neural Sync, etc.)
 * - Persistence via electron-store
 * - Recurring vs. one-time task lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted variables (available inside vi.mock factories) ──────────────────

const { mockSend, mockIsDestroyed, mockNotifShow, storeTasks } = vi.hoisted(() => {
    const storeTasks: Record<string, unknown> = {};
    return {
        storeTasks,
        mockSend: vi.fn(),
        mockIsDestroyed: vi.fn().mockReturnValue(false),
        mockNotifShow: vi.fn(),
    };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('electron-store', () => ({
    default: class MockStore {
        get(_key: string) { return { ...storeTasks }; }
        set(_key: string, value: unknown) {
            Object.keys(storeTasks).forEach(k => delete storeTasks[k as keyof typeof storeTasks]);
            Object.assign(storeTasks, value as Record<string, unknown>);
        }
    },
}));

vi.mock('electron-log', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('electron', () => ({
    app: {
        getAppPath: vi.fn().mockReturnValue('/mock/app'),
        getPath: vi.fn().mockReturnValue('/mock/user/data'),
    },
    BrowserWindow: {
        getAllWindows: vi.fn().mockReturnValue([
            { isDestroyed: mockIsDestroyed, webContents: { send: mockSend } },
        ]),
    },
    Notification: vi.fn().mockImplementation(() => ({ show: mockNotifShow })),
}));

vi.mock('path', () => ({
    default: { join: (...parts: string[]) => parts.join('/') },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { SchedulerService } from './SchedulerService';
import type { ScheduledTask } from '../../src/services/scheduler/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearStore() {
    Object.keys(storeTasks).forEach(k => delete storeTasks[k]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SchedulerService', () => {
    beforeEach(() => {
        clearStore();
        vi.clearAllMocks();
        vi.useFakeTimers();
        SchedulerService.stop();
    });

    afterEach(() => {
        SchedulerService.stop();
        vi.useRealTimers();
    });

    // ── Registration ─────────────────────────────────────────────────────────

    describe('register()', () => {
        it('creates a task with a generated id and timestamps', () => {
            const task = SchedulerService.register({
                name: 'Test Task',
                action: 'test:action',
                schedule: { type: 'interval', ms: 60_000 },
                enabled: true,
                notify: false,
            });

            expect(task.id).toMatch(/^task_/);
            expect(task.name).toBe('Test Task');
            expect(task.runCount).toBe(0);
            expect(task.createdAt).toBeDefined();
            expect(task.nextRunAt).toBeDefined();
        });

        it('persists the task to the store', () => {
            SchedulerService.register({
                name: 'Persisted Task',
                action: 'test:persist',
                schedule: { type: 'interval', ms: 5_000 },
                enabled: true,
                notify: false,
            });

            expect(Object.keys(storeTasks)).toHaveLength(1);
        });

        it('uses provided existingId when re-registering', () => {
            const task = SchedulerService.register(
                { name: 'Known ID', action: 'test:known', schedule: { type: 'interval', ms: 1_000 }, enabled: true, notify: false },
                'my-known-id',
            );
            expect(task.id).toBe('my-known-id');
        });

        it('does not fire when enabled=false', async () => {
            SchedulerService.register({
                name: 'Disabled Task',
                action: 'test:disabled',
                schedule: { type: 'interval', ms: 100 },
                enabled: false,
                notify: false,
            });

            vi.advanceTimersByTime(500);
            await Promise.resolve();

            expect(mockSend).not.toHaveBeenCalledWith('test:disabled', expect.anything());
        });
    });

    // ── Cancellation ─────────────────────────────────────────────────────────

    describe('cancel()', () => {
        it('removes the task from the store', () => {
            const task = SchedulerService.register({
                name: 'To Cancel',
                action: 'test:cancel',
                schedule: { type: 'interval', ms: 1_000 },
                enabled: false,
                notify: false,
            });

            expect(SchedulerService.cancel(task.id)).toBe(true);
            expect(storeTasks[task.id]).toBeUndefined();
        });

        it('returns false for unknown task id', () => {
            expect(SchedulerService.cancel('nonexistent-id')).toBe(false);
        });
    });

    // ── Enable / Disable ─────────────────────────────────────────────────────

    describe('setEnabled()', () => {
        it('disables an enabled task', () => {
            const task = SchedulerService.register({
                name: 'Toggle Task',
                action: 'test:toggle',
                schedule: { type: 'interval', ms: 5_000 },
                enabled: true,
                notify: false,
            });

            SchedulerService.setEnabled(task.id, false);
            expect((storeTasks[task.id] as ScheduledTask).enabled).toBe(false);
        });

        it('re-enables a disabled task', () => {
            const task = SchedulerService.register({
                name: 'Re-enable Task',
                action: 'test:reenable',
                schedule: { type: 'interval', ms: 1_000 },
                enabled: false,
                notify: false,
            });

            SchedulerService.setEnabled(task.id, true);
            expect((storeTasks[task.id] as ScheduledTask).enabled).toBe(true);
        });

        it('returns false for unknown task id', () => {
            expect(SchedulerService.setEnabled('ghost-id', true)).toBe(false);
        });
    });

    // ── Status / Get ─────────────────────────────────────────────────────────

    describe('status()', () => {
        it('returns correct active and total counts', () => {
            SchedulerService.register({ name: 'Active 1', action: 'test:active-1', schedule: { type: 'interval', ms: 1_000 }, enabled: true, notify: false });
            SchedulerService.register({ name: 'Active 2', action: 'test:active-2', schedule: { type: 'interval', ms: 1_000 }, enabled: true, notify: false });
            SchedulerService.register({ name: 'Inactive', action: 'test:inactive', schedule: { type: 'interval', ms: 1_000 }, enabled: false, notify: false });

            const { tasks, activeCount } = SchedulerService.status();
            expect(tasks).toHaveLength(3);
            expect(activeCount).toBe(2);
        });

        it('accumulates totalFireCount', () => {
            storeTasks['t1'] = { id: 't1', name: 'A', action: 'a', runCount: 3, enabled: true, schedule: { type: 'interval', ms: 1000 }, createdAt: '' };
            storeTasks['t2'] = { id: 't2', name: 'B', action: 'b', runCount: 7, enabled: false, schedule: { type: 'interval', ms: 1000 }, createdAt: '' };
            expect(SchedulerService.status().totalFireCount).toBe(10);
        });
    });

    describe('get()', () => {
        it('returns a task by id', () => {
            const task = SchedulerService.register({ name: 'Gettable', action: 'test:gettable', schedule: { type: 'interval', ms: 1_000 }, enabled: false, notify: false });
            expect(SchedulerService.get(task.id)?.name).toBe('Gettable');
        });

        it('returns null for unknown id', () => {
            expect(SchedulerService.get('unknown')).toBeNull();
        });
    });

    // ── Timer Firing ─────────────────────────────────────────────────────────

    describe('timer firing', () => {
        it('sends action IPC after interval elapses', async () => {
            SchedulerService.register({
                name: 'Fire Test',
                action: 'test:fire',
                schedule: { type: 'interval', ms: 100 },
                enabled: true,
                notify: false,
            });

            vi.advanceTimersByTime(150);
            await Promise.resolve();

            expect(mockSend).toHaveBeenCalledWith('test:fire', expect.objectContaining({ payload: undefined }));
        });

        it('broadcasts scheduler:tick on fire', async () => {
            SchedulerService.register({
                name: 'Tick Broadcaster',
                action: 'test:tick',
                schedule: { type: 'interval', ms: 100 },
                enabled: true,
                notify: false,
            });

            vi.advanceTimersByTime(150);
            await Promise.resolve();

            expect(mockSend).toHaveBeenCalledWith('scheduler:tick', expect.objectContaining({
                taskName: 'Tick Broadcaster',
                result: 'success',
            }));
        });

        it('increments runCount after firing', async () => {
            const task = SchedulerService.register({
                name: 'Counter Task',
                action: 'test:count',
                schedule: { type: 'interval', ms: 100 },
                enabled: true,
                notify: false,
            });

            vi.advanceTimersByTime(150);
            await Promise.resolve();

            expect(SchedulerService.get(task.id)?.runCount).toBe(1);
        });

        it('disables a once task after it fires', async () => {
            const runAt = Date.now() + 100;
            const task = SchedulerService.register({
                name: 'One Shot',
                action: 'test:once',
                schedule: { type: 'once', runAt },
                enabled: true,
                notify: false,
            });

            vi.advanceTimersByTime(150);
            await Promise.resolve();

            const updated = SchedulerService.get(task.id);
            expect(updated?.enabled).toBe(false);
            expect(updated?.nextRunAt).toBeUndefined();
        });
    });

    // ── Start / Stop ─────────────────────────────────────────────────────────

    describe('start() / stop()', () => {
        it('start() rebuilds timers from persisted enabled tasks', async () => {
            storeTasks['seeded-task'] = {
                id: 'seeded-task',
                name: 'Seeded',
                action: 'test:seeded',
                schedule: { type: 'interval', ms: 100 },
                enabled: true,
                runCount: 0,
                createdAt: new Date().toISOString(),
                nextRunAt: new Date(Date.now() + 100).toISOString(),
            };

            SchedulerService.start();
            vi.advanceTimersByTime(200);
            await Promise.resolve();

            expect(mockSend).toHaveBeenCalledWith('test:seeded', expect.anything());
        });

        it('stop() prevents scheduled timers from firing', async () => {
            SchedulerService.register({
                name: 'Stopped Task',
                action: 'test:stopped',
                schedule: { type: 'interval', ms: 100 },
                enabled: true,
                notify: false,
            });

            SchedulerService.stop();
            vi.advanceTimersByTime(500);
            await Promise.resolve();

            expect(mockSend).not.toHaveBeenCalledWith('test:stopped', expect.anything());
        });
    });

    // ── Built-in Tasks ────────────────────────────────────────────────────────

    describe('registerBuiltInTasks()', () => {
        it('registers all 5 built-in tasks on first call', () => {
            SchedulerService.registerBuiltInTasks();
            expect(SchedulerService.status().tasks).toHaveLength(5);
        });

        it('includes Neural Sync with 30s interval', () => {
            SchedulerService.registerBuiltInTasks();
            const neuralSync = SchedulerService.status().tasks.find(t => t.name === 'Neural Sync');
            expect(neuralSync?.action).toBe('scheduler:neural-sync');
            expect(neuralSync?.schedule).toEqual({ type: 'interval', ms: 30_000 });
        });

        it('does not duplicate tasks on second call', () => {
            SchedulerService.registerBuiltInTasks();
            SchedulerService.registerBuiltInTasks();
            expect(SchedulerService.status().tasks).toHaveLength(5);
        });

        it('registers Royalty Sync at daily 3:00', () => {
            SchedulerService.registerBuiltInTasks();
            const task = SchedulerService.status().tasks.find(t => t.name === 'Royalty Sync');
            expect(task?.schedule).toEqual({ type: 'daily', hour: 3, minute: 0 });
        });

        it('registers Finance Snapshot on Monday at 6am', () => {
            SchedulerService.registerBuiltInTasks();
            const task = SchedulerService.status().tasks.find(t => t.name === 'Finance Snapshot');
            expect(task?.schedule).toEqual({ type: 'weekly', dayOfWeek: 1, hour: 6, minute: 0 });
        });

        it('registers Workflow Queue Flush every 5 minutes', () => {
            SchedulerService.registerBuiltInTasks();
            const task = SchedulerService.status().tasks.find(t => t.name === 'Workflow Queue Flush');
            expect(task?.schedule).toEqual({ type: 'interval', ms: 5 * 60 * 1000 });
        });
    });
});
