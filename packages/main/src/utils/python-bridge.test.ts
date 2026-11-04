import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PythonBridge } from './python-bridge';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal() as any;
    const spawnMock = vi.fn();
    return {
        ...actual,
        spawn: spawnMock,
        default: {
            ...actual.default,
            spawn: spawnMock
        }
    };
});

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

           it('keeps all argument values out of logs while passing them to the script', async () => {
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
                          ['--user', 'private_artist_name', '--password', 'plain_text_password', '--key', 'private_key_content']
                        );

                  expect(spawn).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([
                          '--user', 'private_artist_name', '--password', 'plain_text_password', '--key', 'private_key_content'
                  ]), expect.any(Object));
                  const logged = JSON.stringify(logSpy.mock.calls);
                  expect(logged).not.toContain('private_artist_name');
                  expect(logged).not.toContain('plain_text_password');
                  expect(logged).not.toContain('private_key_content');
           });

           it('returns stderr to the caller without writing it to logs', async () => {
                  const mockProcess = new EventEmitter() as any;
                  mockProcess.stdout = new EventEmitter();
                  mockProcess.stderr = new EventEmitter();
                  (spawn as unknown as any).mockReturnValue(mockProcess);

                  const pending = PythonBridge.runScript('test', 'test.py');
                  setTimeout(() => {
                          mockProcess.stderr.emit('data', 'private failure detail 7b42');
                          mockProcess.emit('close', 1);
                  }, 0);

                  await expect(pending).rejects.toThrow('private failure detail 7b42');
                  expect(JSON.stringify(vi.mocked(log.error).mock.calls)).not.toContain('private failure detail 7b42');
           });

            it('should reject with clean diagnostic message when python runtime is missing (ENOENT)', async () => {
                  const mockProcess = new EventEmitter() as any;
                  mockProcess.stdout = new EventEmitter();
                  mockProcess.stderr = new EventEmitter();

                  const spawnMock = spawn as unknown as any;
                  spawnMock.mockReturnValue(mockProcess);

                  const enoentErr = new Error('spawn python3 ENOENT') as NodeJS.ErrnoException;
                  enoentErr.code = 'ENOENT';

                  setTimeout(() => {
                          mockProcess.emit('error', enoentErr);
                  }, 10);

                  await expect(
                          PythonBridge.runScript('test_category', 'test_script.py')
                  ).rejects.toThrow(/Python runtime not found/i);
            });
});
