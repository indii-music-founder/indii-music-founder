import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    spawn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    verifyAccess: vi.fn(() => true),
    stat: vi.fn(),
    statfs: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
}));

vi.mock('child_process', () => ({ spawn: mocks.spawn }));
vi.mock('electron-log', () => ({ default: { info: mocks.info, error: mocks.error } }));
vi.mock('electron', () => ({ app: { getAppPath: () => '/app' } }));
vi.mock('../security/AccessControlService', () => ({
    accessControlService: { verifyAccess: mocks.verifyAccess },
}));
vi.mock('fs/promises', () => ({
    stat: mocks.stat,
    statfs: mocks.statfs,
    mkdir: mocks.mkdir,
    rename: mocks.rename,
}));

import { RawConverterService } from './RawConverterService';

function mockProcess() {
    const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
    });
    mocks.spawn.mockReturnValue(child);
    return child;
}

function loggedText(): string {
    return JSON.stringify([...mocks.info.mock.calls, ...mocks.error.mock.calls]);
}

describe('RawConverterService logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mkdir.mockResolvedValue(undefined);
        mocks.rename.mockResolvedValue(undefined);
        mocks.statfs.mockResolvedValue({ bavail: 1000000n, bsize: 4096n });
        mocks.stat.mockResolvedValue({ size: 1000 });
    });

    it('passes file paths to the binary without writing them to logs', async () => {
        const filePath = '/private/artist-raw-7a32.ARW';
        const child = mockProcess();
        const pending = RawConverterService.getInstance().inspect(filePath);

        expect(mocks.spawn).toHaveBeenCalledWith(expect.any(String), ['inspect', filePath, '--json'], expect.any(Object));
        child.stdout.emit('data', Buffer.from('{"file_path":"/private/artist-raw-7a32.ARW","is_supported":true}'));
        child.emit('close', 0);

        await expect(pending).resolves.toMatchObject({ filePath, isSupported: true });
        expect(loggedText()).not.toContain(filePath);
    });

    it('returns native failure details without logging them', async () => {
        const detail = 'private native failure 639a';
        const child = mockProcess();
        const pending = RawConverterService.getInstance()['execBinary']('/app/indii-raw', ['inspect']);
        child.stderr.emit('data', Buffer.from(detail));
        child.emit('close', 1);

        await expect(pending).rejects.toThrow(detail);
        expect(loggedText()).not.toContain(detail);
    });

    it('does not log malformed native output', async () => {
        const detail = '{"private":"artist metadata 9b20"';
        const child = mockProcess();
        const pending = RawConverterService.getInstance().inspect('/private/input.ARW');
        child.stdout.emit('data', Buffer.from(detail));
        child.emit('close', 0);

        await expect(pending).rejects.toThrow('Failed to parse inspection result');
        expect(loggedText()).not.toContain(detail);
    });

    it('cancels active job and kills running child process', async () => {
        const service = RawConverterService.getInstance();
        const child = mockProcess();
        const jobId = 'test-job-cancel-123';
        const abortFn = vi.fn();
        (service as unknown as { activeJobs: Map<string, unknown> }).activeJobs.set(jobId, {
            abort: abortFn,
            process: child,
        });

        service.cancel(jobId);

        expect(abortFn).toHaveBeenCalled();
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
        expect((service as unknown as { activeJobs: Map<string, unknown> }).activeJobs.has(jobId)).toBe(false);
    });

    it('rejects when available disk space is less than required', async () => {
        const service = RawConverterService.getInstance();
        mocks.statfs.mockResolvedValueOnce({
            bavail: 100n,
            bsize: 1024n,
        });

        await expect(
            (service as unknown as { verifyDiskSpace: (dir: string, req: number) => Promise<void> }).verifyDiskSpace('/tmp/test-disk', 1024 * 1024)
        ).rejects.toThrow('Insufficient disk space');
    });

    it('determines fallback camera make by file extension for non-Sony formats', async () => {
        const service = RawConverterService.getInstance();
        const child = Object.assign(new EventEmitter(), {
            stdout: new EventEmitter(),
            stderr: new EventEmitter(),
            kill: vi.fn(),
        });
        mocks.spawn.mockImplementation(() => {
            queueMicrotask(() => {
                child.stdout.emit('data', Buffer.from(JSON.stringify({
                    success: true,
                    input_path: '/test/photo.CR3',
                    output_path: '/test/photo.dng.tmp',
                    input_size: 1000,
                    output_size: 800,
                    duration_ms: 50,
                    cfa_sample_hash: 'abc',
                })));
                child.emit('close', 0);
            });
            return child;
        });

        const result = await service.convert({
            inputPath: '/test/photo.CR3',
            outputPath: '/test/photo.dng',
        });

        expect(result.success).toBe(true);
        expect(result.metadata.make).toBe('Canon');
        expect(result.metadata.model).toBe('Unknown');
    });
});
