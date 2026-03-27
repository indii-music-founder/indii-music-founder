/**
 * SchedulerClientService Unit Tests
 *
 * Tests the renderer-side scheduler client:
 * - IPC bridge delegation
 * - Error surfacing from IPC responses
 * - Event subscriptions (onTick, onNeuralSync)
 * - Graceful fallback when not in Electron context
 *
 * NOTE: window.electronAPI must be set BEFORE the module is imported
 * because isElectron is evaluated at module load time.
 * We use vi.stubGlobal() before the import to ensure correct evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock API — must be set up before importing SchedulerClientService ────────

const mockSchedulerAPI = {
    register: vi.fn(),
    cancel: vi.fn(),
    setEnabled: vi.fn(),
    status: vi.fn(),
    get: vi.fn(),
    onTick: vi.fn(),
    onNeuralSync: vi.fn(),
};

// Stub window.electronAPI globally BEFORE module import so `isElectron` evaluates true
vi.stubGlobal('electronAPI', { scheduler: mockSchedulerAPI });

// ─── Now import (isElectron will be true) ────────────────────────────────────
import { SchedulerClientService } from './SchedulerClientService';
import type { ScheduledTask, SchedulerStatus, SchedulerTickEvent } from './types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockTask: ScheduledTask = {
    id: 'task_test_123',
    name: 'Test Task',
    action: 'test:action',
    schedule: { type: 'interval', ms: 60_000 },
    enabled: true,
    runCount: 0,
    createdAt: '2026-03-27T00:00:00.000Z',
    nextRunAt: '2026-03-27T00:01:00.000Z',
    notify: false,
};

const mockStatus: SchedulerStatus = {
    tasks: [mockTask],
    activeCount: 1,
    totalFireCount: 0,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SchedulerClientService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── isAvailable ───────────────────────────────────────────────────────────

    describe('isAvailable', () => {
        it('returns true when window.electronAPI.scheduler is present', () => {
            expect(SchedulerClientService.isAvailable).toBe(true);
        });
    });

    // ── register() ────────────────────────────────────────────────────────────

    describe('register()', () => {
        it('calls api().register and returns the task on success', async () => {
            mockSchedulerAPI.register.mockResolvedValue({ success: true, task: mockTask });

            const result = await SchedulerClientService.register({
                name: 'Test Task',
                action: 'test:action',
                schedule: { type: 'interval', ms: 60_000 },
                enabled: true,
                notify: false,
            });

            expect(mockSchedulerAPI.register).toHaveBeenCalledOnce();
            expect(result.id).toBe('task_test_123');
        });

        it('throws when success=false', async () => {
            mockSchedulerAPI.register.mockResolvedValue({ success: false, error: 'Registration failed' });

            await expect(SchedulerClientService.register({
                name: 'Bad Task',
                action: 'x',
                schedule: { type: 'interval', ms: 1_000 },
                enabled: true,
                notify: false,
            })).rejects.toThrow('Registration failed');
        });

        it('throws when task is missing from response', async () => {
            mockSchedulerAPI.register.mockResolvedValue({ success: true, task: undefined });

            await expect(SchedulerClientService.register({
                name: 'Missing Task',
                action: 'x',
                schedule: { type: 'interval', ms: 1_000 },
                enabled: true,
                notify: false,
            })).rejects.toThrow('Failed to register task');
        });
    });

    // ── cancel() ──────────────────────────────────────────────────────────────

    describe('cancel()', () => {
        it('calls api().cancel with the correct taskId', async () => {
            mockSchedulerAPI.cancel.mockResolvedValue({ success: true });
            await SchedulerClientService.cancel('task_test_123');
            expect(mockSchedulerAPI.cancel).toHaveBeenCalledWith('task_test_123');
        });

        it('throws on failure', async () => {
            mockSchedulerAPI.cancel.mockResolvedValue({ success: false, error: 'Not found' });
            await expect(SchedulerClientService.cancel('ghost')).rejects.toThrow('Not found');
        });
    });

    // ── setEnabled() ─────────────────────────────────────────────────────────

    describe('setEnabled()', () => {
        it('delegates enable/disable to IPC', async () => {
            mockSchedulerAPI.setEnabled.mockResolvedValue({ success: true });
            await SchedulerClientService.setEnabled('task_test_123', false);
            expect(mockSchedulerAPI.setEnabled).toHaveBeenCalledWith('task_test_123', false);
        });

        it('throws on failure', async () => {
            mockSchedulerAPI.setEnabled.mockResolvedValue({ success: false, error: 'Update failed' });
            await expect(SchedulerClientService.setEnabled('x', true)).rejects.toThrow('Update failed');
        });
    });

    // ── status() ──────────────────────────────────────────────────────────────

    describe('status()', () => {
        it('returns the scheduler status', async () => {
            mockSchedulerAPI.status.mockResolvedValue({ success: true, status: mockStatus });
            const result = await SchedulerClientService.status();
            expect(result.activeCount).toBe(1);
            expect(result.tasks).toHaveLength(1);
        });

        it('throws when status is missing', async () => {
            mockSchedulerAPI.status.mockResolvedValue({ success: true, status: undefined });
            await expect(SchedulerClientService.status()).rejects.toThrow('Failed to get status');
        });
    });

    // ── get() ─────────────────────────────────────────────────────────────────

    describe('get()', () => {
        it('returns a task by id', async () => {
            mockSchedulerAPI.get.mockResolvedValue({ success: true, task: mockTask });
            const result = await SchedulerClientService.get('task_test_123');
            expect(result?.name).toBe('Test Task');
        });

        it('returns null when task is not found', async () => {
            mockSchedulerAPI.get.mockResolvedValue({ success: true, task: null });
            const result = await SchedulerClientService.get('unknown');
            expect(result).toBeNull();
        });

        it('throws on IPC error', async () => {
            mockSchedulerAPI.get.mockResolvedValue({ success: false, error: 'IPC error' });
            await expect(SchedulerClientService.get('x')).rejects.toThrow('IPC error');
        });
    });

    // ── onTick() ──────────────────────────────────────────────────────────────

    describe('onTick()', () => {
        it('registers a tick listener and returns an unsubscribe fn', () => {
            const unsubscribe = vi.fn();
            mockSchedulerAPI.onTick.mockReturnValue(unsubscribe);

            const cb = vi.fn();
            const unsub = SchedulerClientService.onTick(cb);

            expect(mockSchedulerAPI.onTick).toHaveBeenCalledWith(expect.any(Function));
            expect(unsub).toBe(unsubscribe);
        });

        it('passes through tick event data to the callback', () => {
            let capturedCallback: ((e: unknown) => void) | undefined;
            mockSchedulerAPI.onTick.mockImplementation((cb: (e: unknown) => void) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const cb = vi.fn();
            SchedulerClientService.onTick(cb);

            const fakeEvent: SchedulerTickEvent = {
                taskId: 'task_test_123',
                taskName: 'Test Task',
                firedAt: '2026-03-27T12:00:00.000Z',
                result: 'success',
            };
            capturedCallback?.(fakeEvent);
            expect(cb).toHaveBeenCalledWith(fakeEvent);
        });
    });

    // ── onNeuralSync() ────────────────────────────────────────────────────────

    describe('onNeuralSync()', () => {
        it('registers a Neural Sync listener and returns an unsubscribe fn', () => {
            const unsubscribe = vi.fn();
            mockSchedulerAPI.onNeuralSync.mockReturnValue(unsubscribe);

            const cb = vi.fn();
            const unsub = SchedulerClientService.onNeuralSync(cb);

            expect(mockSchedulerAPI.onNeuralSync).toHaveBeenCalledWith(expect.any(Function));
            expect(unsub).toBe(unsubscribe);
        });

        it('passes Neural Sync payload to the callback', () => {
            let capturedCallback: ((e: unknown) => void) | undefined;
            mockSchedulerAPI.onNeuralSync.mockImplementation((cb: (e: unknown) => void) => {
                capturedCallback = cb;
                return vi.fn();
            });

            const cb = vi.fn();
            SchedulerClientService.onNeuralSync(cb);

            const payload = { taskId: 'neural-sync-id', firedAt: '2026-03-27T12:00:30.000Z' };
            capturedCallback?.(payload);
            expect(cb).toHaveBeenCalledWith(payload);
        });

        it('uses onNeuralSync (not onTick) for the 30s heartbeat', () => {
            mockSchedulerAPI.onNeuralSync.mockReturnValue(vi.fn());

            SchedulerClientService.onNeuralSync(() => void 0);

            expect(mockSchedulerAPI.onNeuralSync).toHaveBeenCalledOnce();
            expect(mockSchedulerAPI.onTick).not.toHaveBeenCalled();
        });
    });
});
