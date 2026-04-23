import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from 'electron';
import { spawn } from 'child_process';
import { DockerService } from './DockerService';

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
    },
    default: {
        app: {
            isPackaged: false,
        }
    }
}));

vi.mock('child_process', () => {
    const spawnMock = vi.fn();
    return {
        spawn: spawnMock,
        default: {
            spawn: spawnMock,
        }
    };
});

vi.mock('electron-log', () => {
    const logMock = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    return {
        default: logMock,
        ...logMock
    };
});

vi.mock('./DockerService', () => ({
    DockerService: {
        ensureStarted: vi.fn().mockResolvedValue({ success: true }),
        restartSystem: vi.fn().mockResolvedValue({ success: true }),
        stopSystem: vi.fn().mockResolvedValue(undefined),
    },
}));

import { SidecarService } from './SidecarService';

describe('SidecarService', () => {
    let originalResourcesPath: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset internal state
        (SidecarService as any).child = null;
        (SidecarService as any)._usingBundled = false;

        originalResourcesPath = process.resourcesPath;
        Object.defineProperty(process, 'resourcesPath', {
            value: '/mock/resources',
            configurable: true,
        });

        // Default fetch mock to succeed immediately
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

        // Speed up setTimeout used in wait delays
        vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
            cb();
            return 0 as any;
        });
    });

    afterEach(() => {
        if (originalResourcesPath !== undefined) {
            Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
        } else {
            // @ts-ignore
            delete process.resourcesPath;
        }
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('dev mode (unpackaged)', () => {
        beforeEach(() => {
            (app as any).isPackaged = false;
        });

        it('should delegate ensureStarted to DockerService', async () => {
            const res = await SidecarService.ensureStarted();
            expect(DockerService.ensureStarted).toHaveBeenCalled();
            expect(res.success).toBe(true);
        });

        it('should delegate restartSystem to DockerService', async () => {
            const res = await SidecarService.restartSystem();
            expect(DockerService.restartSystem).toHaveBeenCalled();
            expect(res.success).toBe(true);
        });

        it('should delegate stopSystem to DockerService', async () => {
            await SidecarService.stopSystem();
            expect(DockerService.stopSystem).toHaveBeenCalled();
        });
    });

    describe('packaged mode', () => {
        beforeEach(() => {
            (app as any).isPackaged = true;
        });

        it('should spawn binary if not already running', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                exitCode: null,
            };
            vi.mocked(spawn).mockReturnValue(mockChild as any);

            const res = await SidecarService.ensureStarted();

            expect(spawn).toHaveBeenCalled();
            expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:50080/healthz');
            expect(res.success).toBe(true);
            expect(SidecarService.usingBundled).toBe(true);
        });

        it('should return success true without spawning if already running', async () => {
            (SidecarService as any).child = { exitCode: null };

            const res = await SidecarService.ensureStarted();

            expect(res.success).toBe(true);
            expect(spawn).not.toHaveBeenCalled();
        });

        it('should handle spawn errors gracefully', async () => {
            vi.mocked(spawn).mockImplementation(() => {
                throw new Error('Spawn failed');
            });

            const res = await SidecarService.ensureStarted();

            expect(res.success).toBe(false);
            expect(res.log).toBe('Spawn failed');
        });

        it('should timeout and kill process if health check fails', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                exitCode: null,
            };
            vi.mocked(spawn).mockReturnValue(mockChild as any);

            // Fetch always fails
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));

            let nowCalls = 0;
            const originalDateNow = Date.now;
            vi.spyOn(Date, 'now').mockImplementation(() => {
                nowCalls++;
                if (nowCalls > 1) {
                    return originalDateNow() + 35000; // Jump past 30s timeout
                }
                return originalDateNow();
            });

            const res = await SidecarService.ensureStarted();

            expect(res.success).toBe(false);
            expect(res.log).toBe('Sidecar did not become healthy within timeout');
            expect(mockChild.kill).toHaveBeenCalled();
            expect((SidecarService as any).child).toBeNull();
        });

        it('should restart system by stopping then starting', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                exitCode: null,
            };
            (SidecarService as any).child = mockChild;

            // For the new spawn
            const newMockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                exitCode: null,
            };
            vi.mocked(spawn).mockReturnValue(newMockChild as any);

            const res = await SidecarService.restartSystem();

            // First kill
            expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
            // Then spawn
            expect(spawn).toHaveBeenCalled();
            expect(res.success).toBe(true);
        });

        it('should fall back to SIGKILL if SIGTERM does not stop process', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                exitCode: null, // exitCode remains null meaning it didn't exit
            };
            (SidecarService as any).child = mockChild;

            await SidecarService.stopSystem();

            expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
            expect(mockChild.kill).toHaveBeenCalledWith('SIGKILL');
            expect((SidecarService as any).child).toBeNull();
        });

        it('should not call SIGKILL if SIGTERM stops process', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                exitCode: null,
            };
            (SidecarService as any).child = mockChild;

            // Mock setTimeout so we can mutate exitCode during the wait
            vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
                mockChild.exitCode = 0 as any; // Simulate process exit
                cb();
                return 0 as any;
            });

            await SidecarService.stopSystem();

            expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
            expect(mockChild.kill).not.toHaveBeenCalledWith('SIGKILL');
            expect((SidecarService as any).child).toBeNull();
        });
    });
});
