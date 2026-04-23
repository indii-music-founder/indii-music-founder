import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PythonBridge } from './python-bridge';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('electron', () => ({
    app: {
          getAppPath: vi.fn(() => '/mock/app/path'),
          isPackaged: false,
    },
}));

vi.mock('electron-log', () => ({
  default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
  },
}));
import log from 'electron-log';

describe('PythonBridge', () => {
    beforeEach(() => {
          vi.clearAllMocks();
    });

           it('should run a python script and return parsed output', async () => {
                 const mockProcess = new EventEmitter() as any;
                 mockProcess.stdout = new EventEmitter();
                 mockProcess.stderr = new EventEmitter();

                  const spawnMock = spawn as unknown as any;
                 spawnMock.mockReturnValue(mockProcess);

                  // Simulate successful execution
                  setTimeout(() => {
                          mockProcess.stdout.emit('data', JSON.stringify({ status: 'SUCCESS', result: 'test_result' }) + '\n');
                          mockProcess.emit('close', 0);
                  }, 10);

                  const result = await PythonBridge.runScript('test_category', 'test_script.py', ['--arg1', 'val1']);

                  expect(result).toEqual({ status: 'SUCCESS', result: 'test_result' });
                 expect(spawn).toHaveBeenCalled();
           });

           it('should handle environment variables', async () => {
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
                 const logSpy = vi.spyOn(log, 'info');
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
                         expect.stringContaining('--password')
                       );
                 expect(logSpy).toHaveBeenCalledWith(
                         expect.stringContaining('[REDACTED]')
                       );
           });
});
