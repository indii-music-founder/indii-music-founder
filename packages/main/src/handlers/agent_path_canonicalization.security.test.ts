import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    app: {
        isPackaged: false,
        getPath: vi.fn(() => '/mock/user-data'),
        getAppPath: vi.fn(() => '/app')
    }
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: vi.fn().mockReturnValue(true),
    }
}));

import { registerAgentHandlers } from './agent';
import { registerAudioHandlers } from './audio';

describe('🛡️ Path Canonicalization Defenses', () => {
    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
        mocks.ipcMain.handle.mockImplementation((channel: string, listener: unknown) => {
            handlers.set(channel, listener as (...args: unknown[]) => Promise<unknown>);
            return mocks.ipcMain;
        });

        registerAgentHandlers();
        registerAudioHandlers();
    });

    it('should REJECT artifact read escaping artifacts directory via sibling prefix or relative paths', async () => {
        const handler = handlers.get('agent:read-artifact');
        expect(handler).toBeDefined();

        const fakeEvent = { senderFrame: { url: 'file:///app/index.html' } };
        // Sibling escape attempt like ../artifacts-sibling/stolen.md
        const resSibling = await handler!(fakeEvent, '../artifacts-sibling/stolen.md');
        expect(resSibling).toEqual({ success: false, error: 'Error: Invalid artifact filename' });

        // Relative traversal escape attempt like ../../etc/passwd
        const resTraversal = await handler!(fakeEvent, '../../etc/passwd');
        expect(resTraversal).toEqual({ success: false, error: 'Error: Invalid artifact filename' });
    });

    it('should REJECT agent knowledge updates outside agents directory', async () => {
        const handler = handlers.get('agent:update-knowledge');
        expect(handler).toBeDefined();

        const fakeEvent = { senderFrame: { url: 'file:///app/index.html' } };
        // Attempting to write into agents-other/secret.txt
        const resSibling = await handler!(fakeEvent, '../agents-other/secret.txt', 'add', 'data');
        expect(resSibling).toEqual({ success: false, error: 'Error: Invalid file path for knowledge update' });
    });

    it('should REJECT multi-replace on files outside current workspace root', async () => {
        const handler = handlers.get('agent:multi-replace-file-content');
        expect(handler).toBeDefined();

        const fakeEvent = { senderFrame: { url: 'file:///app/index.html' } };
        const res = await handler!(fakeEvent, {
            targetFile: '../../outside/file.txt',
            replacementChunks: []
        });
        expect(res).toEqual({ success: false, error: 'Error: Invalid file path' });
    });
});
