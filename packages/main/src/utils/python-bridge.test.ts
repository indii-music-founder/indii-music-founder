import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventEmitter from 'events';

// Define the mock factory
vi.mock('child_process', () => {
    const mockFn = vi.fn();
    return {
        spawn: mockFn,
        default: { spawn: mockFn },
        __esModule: true
    };
});

import { PythonBridge } from './python-bridge';
import { spawn } from 'child_process';

// Mock electron app
vi.mock('electron', () => ({
    app: {
        isPackaged: false
    }
}));

describe('PythonBridge Security', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass environment variables to spawn', async () => {
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();

        const spawnMock = spawn as unknown as any;
        spawnMock.mockReturnValue(mockProcess);

        // Simulate successful execution
        setTimeout(() => {
             mockProcess.stdout.emit('data', JSON.stringify({ status: 'SUCCESS' }) + '\n');
             mockProcess.emit('close', 0);
        }, 10);

        await PythonBridge.runScript(
            'test_category',
            'test_script.py',
            ['--arg1', 'val1'],
            undefined,
            { SECRET_VAR: 'super_secret_password' }
        );

        expect(spawn).toHaveBeenCalledWith(
            expect.any(String), // python path
            expect.arrayContaining([expect.stringContaining('test_script.py'), '--arg1', 'val1']),
            expect.objectContaining({
                env: expect.objectContaining({
                    SECRET_VAR: 'super_secret_password'
                })
            })
        );
    });

    it('should redact sensitive arguments in console logs', async () => {
        const logSpy = vi.spyOn(console, 'log');

        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();

        const spawnMock = spawn as unknown as any;
        spawnMock.mockReturnValue(mockProcess);

        setTimeout(() => {
             mockProcess.stdout.emit('data', JSON.stringify({ status: 'SUCCESS' }) + '\n');
             mockProcess.emit('close', 0);
        }, 10);

        await PythonBridge.runScript(
            'test',
            'test.py',
            ['--user', 'admin', '--password', 'plain_text_password', '--key', 'private_key_content']
        );

        expect(logSpy).toHaveBeenCalledWith(
            expect.not.stringContaining('plain_text_password')
        );
        expect(logSpy).toHaveBeenCalledWith(
            expect.not.stringContaining('private_key_content')
        );

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('[REDACTED]')
        );
    });
});
