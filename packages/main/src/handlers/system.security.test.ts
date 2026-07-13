import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    handle: vi.fn(),
    verifyAccess: vi.fn(),
    readdir: vi.fn(),
    realpath: vi.fn(),
    stat: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: { handle: mocks.handle },
    app: { getVersion: () => 'test', getGPUFeatureStatus: () => ({}), getGPUInfo: vi.fn() },
    BrowserWindow: { fromWebContents: vi.fn() },
    dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('fs/promises', () => ({
    readdir: mocks.readdir,
    realpath: mocks.realpath,
    stat: mocks.stat,
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
