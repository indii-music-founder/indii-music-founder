import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock electron before importing PythonBridge
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: vi.fn(),
    },
}));

// Mock child_process at top level
vi.mock('child_process', () => {
    const mockSpawn = vi.fn();
    return {
        __esModule: true,
        default: { spawn: mockSpawn },
        spawn: mockSpawn,
    };
});

import { PythonBridge } from '../utils/python-bridge';
import { spawn } from 'child_process';

describe('Distribution Security - Argument Leakage', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        // Setup spawn mock implementation for each test
        (spawn as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            on: vi.fn().mockImplementation((event, cb) => {
                if (event === 'close') cb(0);
            }),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('leaks password in logs when passed as argument', async () => {
        const password = 'SUPER_SECRET_PASSWORD';

        await PythonBridge.runScript('distribution', 'sftp_uploader.py', [
            '--user', 'testuser',
            '--password', password
        ]);

        // Check if the password was logged
        const logCalls = consoleSpy.mock.calls.map((c: unknown[]) => (c as string[]).join(' '));
        const leaked = logCalls.some((log: string) => log.includes(password));

        expect(leaked).toBe(false);
    });
});
