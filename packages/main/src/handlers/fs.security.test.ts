import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

const mocks = vi.hoisted(() => ({
    handle: vi.fn(),
    verifyAccess: vi.fn(),
    verifyWriteTargetDirectory: vi.fn(),
    isWithinAllowedRoots: vi.fn(),
    validateSender: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: { handle: mocks.handle },
}));

vi.mock('fs', () => ({
    default: {
        promises: {
            readdir: mocks.readdir,
            readFile: mocks.readFile,
            mkdir: mocks.mkdir,
            stat: mocks.stat,
        },
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender,
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mocks.verifyAccess,
        verifyWriteTargetDirectory: mocks.verifyWriteTargetDirectory,
        isWithinAllowedRoots: mocks.isWithinAllowedRoots,
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { registerFsHandlers } from './fs';

describe('fs IPC handlers security and functionality', () => {
    let handlers: Map<string, (...args: any[]) => any>;

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = new Map();
        mocks.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
            handlers.set(channel, handler);
        });
        registerFsHandlers();
    });

    describe('fs:list-files', () => {
        it('denies access if AccessControlService denies the path', async () => {
            mocks.verifyAccess.mockReturnValue(false);
            const listFiles = handlers.get('fs:list-files')!;

            await expect(listFiles({}, '/unauthorized/path')).rejects.toThrow(
                /Security Violation: Access to .* is denied/
            );
            expect(mocks.validateSender).toHaveBeenCalled();
        });

        it('returns files with name, path, extension, and sizeBytes when authorized', async () => {
            mocks.verifyAccess.mockReturnValue(true);
            mocks.stat
                .mockResolvedValueOnce({ isDirectory: () => true }) // for directory check
                .mockResolvedValueOnce({ size: 1024 }) // for file1.txt
                .mockResolvedValueOnce({ size: 2048 }); // for file2.wav

            mocks.readdir.mockResolvedValue([
                { name: 'file1.txt', isFile: () => true },
                { name: 'file2.wav', isFile: () => true },
                { name: 'subfolder', isFile: () => false },
            ]);

            const listFiles = handlers.get('fs:list-files')!;
            const result = await listFiles({}, '/authorized/dir');

            expect(result).toEqual([
                {
                    name: 'file1.txt',
                    path: path.resolve('/authorized/dir/file1.txt'),
                    extension: '.txt',
                    sizeBytes: 1024,
                },
                {
                    name: 'file2.wav',
                    path: path.resolve('/authorized/dir/file2.wav'),
                    extension: '.wav',
                    sizeBytes: 2048,
                },
            ]);
        });
    });

    describe('fs:read-text-file', () => {
        it('denies access if AccessControlService denies the file', async () => {
            mocks.verifyAccess.mockReturnValue(false);
            const readText = handlers.get('fs:read-text-file')!;

            await expect(readText({}, '/etc/passwd')).rejects.toThrow(
                /Security Violation: Access to .* is denied/
            );
        });

        it('reads text file when authorized', async () => {
            mocks.verifyAccess.mockReturnValue(true);
            mocks.readFile.mockResolvedValue('file content utf-8');

            const readText = handlers.get('fs:read-text-file')!;
            const content = await readText({}, '/authorized/file.txt');

            expect(content).toBe('file content utf-8');
            expect(mocks.readFile).toHaveBeenCalledWith(expect.any(String), 'utf-8');
        });
    });

    describe('fs:read-binary-file', () => {
        it('reads binary file as Uint8Array when authorized', async () => {
            mocks.verifyAccess.mockReturnValue(true);
            const buf = Buffer.from([1, 2, 3, 4]);
            mocks.readFile.mockResolvedValue(buf);

            const readBinary = handlers.get('fs:read-binary-file')!;
            const result = await readBinary({}, '/authorized/file.bin');

            expect(result).toBeInstanceOf(Uint8Array);
            expect(Array.from(result)).toEqual([1, 2, 3, 4]);
        });
    });

    describe('fs:mkdir', () => {
        it('denies directory creation when outside allowed scope', async () => {
            mocks.isWithinAllowedRoots.mockReturnValue(false);
            mocks.verifyWriteTargetDirectory.mockReturnValue(false);

            const mkdir = handlers.get('fs:mkdir')!;
            await expect(mkdir({}, '/root/unauthorized-folder')).rejects.toThrow(
                /Security Violation: Access to create directory .* is denied/
            );
        });

        it('creates directory when within allowed scope', async () => {
            mocks.isWithinAllowedRoots.mockReturnValue(true);
            mocks.mkdir.mockResolvedValue(undefined);

            const mkdir = handlers.get('fs:mkdir')!;
            await mkdir({}, '~/indii/memory-inbox');

            expect(mocks.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
        });
    });
});
