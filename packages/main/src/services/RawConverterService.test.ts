import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    spawn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    verifyAccess: vi.fn(() => true),
}));

vi.mock('child_process', () => ({ spawn: mocks.spawn }));
vi.mock('electron-log', () => ({ default: { info: mocks.info, error: mocks.error } }));
vi.mock('electron', () => ({ app: { getAppPath: () => '/app' } }));
vi.mock('../security/AccessControlService', () => ({
    accessControlService: { verifyAccess: mocks.verifyAccess },
}));

import { RawConverterService } from './RawConverterService';

function mockProcess() {
    const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
    });
    mocks.spawn.mockReturnValue(child);
    return child;
}

function loggedText(): string {
    return JSON.stringify([...mocks.info.mock.calls, ...mocks.error.mock.calls]);
}

describe('RawConverterService logging', () => {
    beforeEach(() => vi.clearAllMocks());

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
});
