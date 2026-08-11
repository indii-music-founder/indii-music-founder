import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    handle: vi.fn(),
    verifyAccess: vi.fn(),
    readdir: vi.fn(),
    realpath: vi.fn(),
    stat: vi.fn(),
    lstat: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    access: vi.fn(),
    rm: vi.fn(),
    showMessageBox: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: { handle: mocks.handle },
    app: { getVersion: () => 'test', getGPUFeatureStatus: () => ({}), getGPUInfo: vi.fn() },
    BrowserWindow: { fromWebContents: vi.fn() },
    dialog: { showOpenDialog: vi.fn(), showMessageBox: mocks.showMessageBox },
}));
vi.mock('fs/promises', () => ({
    readdir: mocks.readdir,
    realpath: mocks.realpath,
    stat: mocks.stat,
    lstat: mocks.lstat,
    mkdir: mocks.mkdir,
    rename: mocks.rename,
    access: mocks.access,
    rm: mocks.rm,
}));
vi.mock('../utils/ipc-security', () => ({ validateSender: vi.fn() }));
vi.mock('../security/AccessControlService', () => ({ accessControlService: { verifyAccess: mocks.verifyAccess, grantAccess: vi.fn() } }));
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }));

import { registerSystemHandlers } from './system';

describe('system:search-approved-assets', () => {
    let search: (event: unknown, path: string, options?: { query?: string; maxResults?: number }) => Promise<unknown>;

    beforeEach(() => {
        vi.clearAllMocks();
        const handlers = new Map<string, (...args: any[]) => any>();
        mocks.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => handlers.set(channel, handler));
        mocks.verifyAccess.mockReturnValue(true);
        mocks.realpath.mockResolvedValue('/approved');
        mocks.readdir.mockResolvedValue([
            { name: 'font-logo.png', isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
            { name: 'private-link.png', isFile: () => true, isDirectory: () => false, isSymbolicLink: () => true },
        ]);
        mocks.stat.mockResolvedValue({ size: 42, mtimeMs: 1234 });
        registerSystemHandlers();
        search = handlers.get('system:search-approved-assets')!;
    });

    it('returns bounded, redacted metadata from a creator-approved folder', async () => {
        const result = await search({}, '/approved', { query: 'font logo', maxResults: 9999 }) as Array<Record<string, unknown>>;
        expect(result).toEqual([{ name: 'font-logo.png', relativePath: 'font-logo.png', extension: 'png', sizeBytes: 42, modifiedAt: 1234 }]);
        expect(JSON.stringify(result)).not.toContain('/approved');
        expect(mocks.stat).toHaveBeenCalledTimes(1);
    });

    it('rejects a directory that the creator has not approved', async () => {
        mocks.verifyAccess.mockReturnValue(false);
        await expect(search({}, '/etc', {})).rejects.toThrow('Access denied');
        expect(mocks.readdir).not.toHaveBeenCalled();
    });

    it('honors a caller result bound before exposing a large folder', async () => {
        mocks.readdir.mockResolvedValue([
            { name: 'first.png', isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
            { name: 'second.png', isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
        ]);
        const result = await search({}, '/approved', { maxResults: 1 }) as Array<Record<string, unknown>>;
        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe('first.png');
    });
});

describe('local Trash IPC security', () => {
    let move: (event: unknown, request: Record<string, string>) => Promise<unknown>;
    let restore: (event: unknown, request: Record<string, string>) => Promise<unknown>;
    let purge: (event: unknown, request: Record<string, string>) => Promise<unknown>;

    beforeEach(() => {
        vi.clearAllMocks();
        const handlers = new Map<string, (...args: any[]) => any>();
        mocks.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => handlers.set(channel, handler));
        mocks.verifyAccess.mockReturnValue(true);
        mocks.realpath.mockImplementation(async (value: string) => value);
        mocks.lstat.mockImplementation(async (value: string) => {
            if (value.includes('.indii-trash')) {
                const error = new Error('missing') as NodeJS.ErrnoException;
                error.code = 'ENOENT';
                throw error;
            }
            return { size: 42, isDirectory: () => false, isSymbolicLink: () => false };
        });
        mocks.mkdir.mockResolvedValue(undefined);
        mocks.rename.mockResolvedValue(undefined);
        mocks.rm.mockResolvedValue(undefined);
        const missing = new Error('missing') as NodeJS.ErrnoException;
        missing.code = 'ENOENT';
        mocks.access.mockRejectedValue(missing);
        mocks.showMessageBox.mockResolvedValue({ response: 1 });
        registerSystemHandlers();
        move = handlers.get('trash:move')!;
        restore = handlers.get('trash:restore')!;
        purge = handlers.get('trash:purge')!;
    });

    it('rejects traversal in a caller-controlled trash identifier before moving anything', async () => {
        await expect(move({ sender: {} }, {
            dirPath: '/approved',
            relativePath: 'song.wav',
            trashId: 'trash_../../other',
            approvedFolderId: 'folder-1',
        })).rejects.toThrow('Invalid trash identifier');
        expect(mocks.rename).not.toHaveBeenCalled();
    });

    it('rejects a source whose real path escapes through an intermediate symlink', async () => {
        mocks.realpath.mockImplementation(async (value: string) => value === '/approved/link/secret.wav' ? '/outside/secret.wav' : value);
        await expect(move({ sender: {} }, {
            dirPath: '/approved',
            relativePath: 'link/secret.wav',
            trashId: 'trash_safe_1',
            approvedFolderId: 'folder-1',
        })).rejects.toThrow('resolved outside approved folder');
        expect(mocks.rename).not.toHaveBeenCalled();
    });

    it('rejects a traversal purge target before showing the native confirmation', async () => {
        await expect(purge({ sender: {} }, {
            dirPath: '/approved',
            trashId: 'trash_../project',
        })).rejects.toThrow('Invalid trash identifier');
        expect(mocks.showMessageBox).not.toHaveBeenCalled();
        expect(mocks.rm).not.toHaveBeenCalled();
    });

    it('does not treat non-ENOENT restore access errors as an empty destination', async () => {
        mocks.realpath.mockImplementation(async (value: string) => value);
        const denied = new Error('denied') as NodeJS.ErrnoException;
        denied.code = 'EACCES';
        mocks.access.mockRejectedValue(denied);
        await expect(restore({ sender: {} }, {
            dirPath: '/approved',
            trashId: 'trash_safe_2',
            relativePath: 'song.wav',
        })).rejects.toThrow('denied');
        expect(mocks.rename).not.toHaveBeenCalled();
    });
});
