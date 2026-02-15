
import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerAudioHandlers } from './audio';
import { ipcMain } from 'electron';
import fs from 'fs';
import stream from 'stream';

// Mock Electron
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: (name: string) => {
            if (name === 'userData') return '/tmp/userdata';
            return '/tmp';
        }
    },
    ipcMain: {
        handle: vi.fn()
    }
}));

// Mock external deps
vi.mock('fluent-ffmpeg', () => ({
    default: {
        setFfmpegPath: vi.fn(),
        setFfprobePath: vi.fn(),
        ffprobe: vi.fn((path, cb) => {
            cb(null, { format: { duration: 100, format_name: 'wav', bit_rate: 1000 } });
        })
    }
}));
vi.mock('ffmpeg-static', () => ({ default: 'ffmpeg-bin' }));
vi.mock('ffprobe-static', () => ({ default: { path: 'ffprobe-bin' } }));

// Mock fs
vi.mock('fs', async (importOriginal) => {
    const mod = await importOriginal() as any;
    const mocked = {
        ...mod,
        createReadStream: vi.fn().mockImplementation((path) => {
            const s = new stream.Readable();
            s.push('sensitive-content');
            s.push(null);
            return s;
        }),
        realpathSync: vi.fn().mockImplementation((p) => {
             if (p === '/tmp/exploit.wav') return '/etc/passwd';
             return p;
        })
    };
    return {
        ...mocked,
        default: mocked
    };
});

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

describe('Vulnerability: Audio Handler Symlink Exploit', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should BLOCK analyzing a symlink that points to a restricted file', async () => {
        registerAudioHandlers();

        // Get the registered handler
        const calls = (ipcMain.handle as any).mock.calls;
        const handlerEntry = calls.find((call: any[]) => call[0] === 'audio:analyze');
        expect(handlerEntry).toBeDefined();
        const handler = handlerEntry[1];

        // Simulate a symlink path that looks safe (.wav extension)
        // In reality (mocked), this points to /etc/passwd
        const maliciousPath = '/tmp/exploit.wav';

        // Execute handler - EXPECT ERROR
        await expect(handler({ senderFrame: { url: 'file://app/index.html' } }, maliciousPath))
            .rejects
            .toThrow(/Security Violation/);

        // Verify fs.createReadStream was NOT accessed
        expect(fs.createReadStream).not.toHaveBeenCalled();

        // Verify we DID check the real path
        expect(fs.realpathSync).toHaveBeenCalledWith(maliciousPath);
    });
});
