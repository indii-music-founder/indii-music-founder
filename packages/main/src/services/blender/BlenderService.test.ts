import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    connectLocal: vi.fn(),
    executeTool: vi.fn(),
    verifyAccess: vi.fn(() => true),
    verifyWriteTargetDirectory: vi.fn(() => true),
}));

vi.mock('electron-log', () => ({ default: { info: mocks.info, warn: mocks.warn, error: mocks.error } }));
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));
vi.mock('../mcp/MCPClientService', () => ({
    mcpClientService: { connectLocal: mocks.connectLocal, executeTool: mocks.executeTool },
}));
vi.mock('../../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mocks.verifyAccess,
        verifyWriteTargetDirectory: mocks.verifyWriteTargetDirectory,
    },
}));

import { BlenderService } from './BlenderService';

function loggedText(): string {
    return JSON.stringify([...mocks.info.mock.calls, ...mocks.warn.mock.calls, ...mocks.error.mock.calls]);
}

describe('BlenderService logging', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not log a render request containing artist paths and visual tokens', async () => {
        const secret = 'private visual brief 40ab';
        const filePath = '/private/artist-track-40ab.wav';
        await expect(new BlenderService().renderMusicVideo({
            audioFilePath: filePath,
            templateId: 'studio',
            visualTokens: { brief: secret },
        })).rejects.toThrow('Audio file does not exist');

        expect(mocks.info).toHaveBeenCalledWith('[BlenderService] Initiating headless render');
        expect(loggedText()).not.toContain(secret);
        expect(loggedText()).not.toContain(filePath);
    });

    it('passes live command failures to the caller without logging upstream details', async () => {
        const secret = 'private Blender command error 81ac';
        mocks.connectLocal.mockResolvedValue(undefined);
        mocks.executeTool.mockRejectedValue(new Error(secret));

        await expect(new BlenderService().sendLiveCommand('render', { note: secret })).rejects.toThrow(secret);
        expect(loggedText()).not.toContain(secret);
        expect(mocks.error).toHaveBeenCalledWith('[BlenderService] Live command failed');
    });
});
