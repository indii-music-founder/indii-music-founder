import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from 'electron';
import log from 'electron-log';

const mockExecPromise = vi.fn();

vi.mock('util', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        promisify: vi.fn(() => vi.fn((...args) => mockExecPromise(...args))),
        default: {
            ...actual,
            promisify: vi.fn(() => vi.fn((...args) => mockExecPromise(...args))),
        }
    };
});

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
    },
}));

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

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        exec: vi.fn(),
        default: {
            ...actual,
            exec: vi.fn(),
        }
    };
});

import { DockerService } from './DockerService';

describe('DockerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getWorkingDir', () => {
        it('should return process.cwd() when not packaged', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockResolvedValue({ stdout: '', stderr: '' });
            await DockerService.ensureStarted();
            expect(mockExecPromise).toHaveBeenCalledWith('docker compose up -d --remove-orphans', { cwd: process.cwd() });
        });

        it('should return process.resourcesPath when packaged', async () => {
            (app as any).isPackaged = true;
            const originalResourcesPath = process.resourcesPath;
            Object.defineProperty(process, 'resourcesPath', {
                value: '/mock/resources',
                configurable: true,
            });

            mockExecPromise.mockResolvedValue({ stdout: '', stderr: '' });
            await DockerService.ensureStarted();
            expect(mockExecPromise).toHaveBeenCalledWith('docker compose up -d --remove-orphans', { cwd: '/mock/resources' });

            if (originalResourcesPath !== undefined) {
                Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
            } else {
                // @ts-ignore
                delete process.resourcesPath;
            }
        });
    });

    describe('ensureStarted', () => {
        it('should successfully start containers and return success', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockResolvedValue({ stdout: 'started ok', stderr: '' });
            const res = await DockerService.ensureStarted();

            expect(mockExecPromise).toHaveBeenCalledWith('docker compose up -d --remove-orphans', { cwd: process.cwd() });
            expect(res).toEqual({ success: true, log: 'started ok' });
            expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Startup Output: started ok'));
            expect(log.warn).not.toHaveBeenCalled();
        });

        it('should log warnings if stderr is present but still return success', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockResolvedValue({ stdout: 'started ok', stderr: 'some warning' });
            const res = await DockerService.ensureStarted();

            expect(res).toEqual({ success: true, log: 'started ok' });
            expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Startup Warnings: some warning'));
        });

        it('should return failure if exec throws an Error', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockRejectedValue(new Error('startup failed'));
            const res = await DockerService.ensureStarted();

            expect(res).toEqual({ success: false, log: 'startup failed' });
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Startup Failed: startup failed'));
        });

        it('should return failure if exec throws a non-Error', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockRejectedValue('string error');
            const res = await DockerService.ensureStarted();

            expect(res).toEqual({ success: false, log: 'string error' });
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Startup Failed: string error'));
        });
    });

    describe('restartSystem', () => {
        it('should successfully restart containers', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockResolvedValue({ stdout: 'ok', stderr: '' });

            const res = await DockerService.restartSystem();

            expect(mockExecPromise).toHaveBeenCalledWith('docker compose down', { cwd: process.cwd() });
            expect(mockExecPromise).toHaveBeenCalledWith('docker compose up -d --remove-orphans', { cwd: process.cwd() });
            expect(res).toEqual({ success: true, log: 'ok' });
            expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Restarting AI system...'));
        });

        it('should return failure if restart throws an error', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockRejectedValueOnce(new Error('down failed'));

            const res = await DockerService.restartSystem();

            expect(mockExecPromise).toHaveBeenCalledWith('docker compose down', { cwd: process.cwd() });
            expect(res).toEqual({ success: false, log: 'down failed' });
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Restart Failed: down failed'));
        });
    });

    describe('stopSystem', () => {
        it('should successfully stop containers', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockResolvedValue({ stdout: 'ok', stderr: '' });

            await DockerService.stopSystem();

            expect(mockExecPromise).toHaveBeenCalledWith('docker compose stop', { cwd: process.cwd() });
            expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Stopping AI containers...'));
        });

        it('should log error if stop fails', async () => {
            (app as any).isPackaged = false;
            mockExecPromise.mockRejectedValue(new Error('stop failed'));

            await DockerService.stopSystem();

            expect(mockExecPromise).toHaveBeenCalledWith('docker compose stop', { cwd: process.cwd() });
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Stop Failed: stop failed'));
        });
    });
});
