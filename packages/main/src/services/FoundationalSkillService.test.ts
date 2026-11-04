import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    spawn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
}));

vi.mock('child_process', () => ({ spawn: mocks.spawn }));
vi.mock('electron-log', () => ({ default: { info: mocks.info, error: mocks.error, warn: mocks.warn } }));
vi.mock('electron', () => ({ app: { isPackaged: false } }));

import { FoundationalSkillService } from './FoundationalSkillService';

function mockProcess() {
    const process = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: vi.fn(),
    });
    mocks.spawn.mockReturnValue(process);
    return process;
}

function loggedText(): string {
    return JSON.stringify([...mocks.info.mock.calls, ...mocks.error.mock.calls, ...mocks.warn.mock.calls]);
}

describe('FoundationalSkillService process logging', () => {
    beforeEach(() => vi.clearAllMocks());

    it('passes knowledge content to the script without writing it or the file path to logs', async () => {
        const secret = 'private knowledge content 9f462';
        const filePath = '/private/artist-notes-9f462.md';
        const child = mockProcess();
        const pending = new FoundationalSkillService().updateKnowledge(filePath, 'add', secret);

        expect(mocks.spawn).toHaveBeenCalledWith('python3', [
            expect.stringContaining('update_knowledge.py'),
            '--file_path', filePath, '--action', 'add', '--content', secret,
        ]);
        child.stdout.emit('data', Buffer.from('{"success":true}'));
        child.emit('close', 0);

        await expect(pending).resolves.toEqual({ success: true });
        expect(loggedText()).not.toContain(secret);
        expect(loggedText()).not.toContain(filePath);
    });

    it('preserves the script error for the caller without logging stderr', async () => {
        const secret = 'private script failure 813b6';
        const child = mockProcess();
        const pending = new FoundationalSkillService().updateKnowledge('/private/file', 'add', 'content');
        child.stderr.emit('data', Buffer.from(secret));
        child.emit('close', 1);

        await expect(pending).rejects.toThrow(secret);
        expect(loggedText()).not.toContain(secret);
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('code 1'));
    });
});
