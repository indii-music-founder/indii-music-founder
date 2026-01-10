import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Define hoisted mocks first
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    // Mock fs
    fs: {
        createReadStream: vi.fn(),
        existsSync: vi.fn(),
        default: {
            createReadStream: vi.fn(),
            existsSync: vi.fn()
        }
    },
    // Mock ffmpeg
    ffmpeg: {
        setFfmpegPath: vi.fn(),
        setFfprobePath: vi.fn(),
        ffprobe: vi.fn()
    }
}));

// Mock 'electron'
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain
}));

// Mock 'fluent-ffmpeg'
vi.mock('fluent-ffmpeg', () => ({
    default: mocks.ffmpeg
}));

// Mock 'fs'
vi.mock('fs', () => ({
    default: mocks.fs,
    createReadStream: mocks.fs.createReadStream,
    existsSync: mocks.fs.existsSync
}));

// Mock 'crypto'
vi.mock('crypto', () => ({
    default: {
        createHash: () => ({
            update: vi.fn(),
            digest: vi.fn(() => 'mock-hash-123')
        })
    }
}));

// Mock dependencies
vi.mock('../services/APIService', () => ({
    apiService: { getSongMetadata: vi.fn() }
}));

// Import handler
import { registerAudioHandlers } from './audio';

describe('🛡️ Shield: Audio Analysis Security', () => {
    let handlers: Record<string, Function> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: Function) => {
            handlers[channel] = handler;
        });

        // Register
        registerAudioHandlers();
    });

    afterEach(() => {
        vi.resetModules();
    });

    const invokeHandler = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
    };

    it('should BLOCK Path Traversal attempting to analyze system files', async () => {
        const maliciousPath = '../../etc/passwd.mp3';

        const result = await invokeHandler('audio:analyze', maliciousPath);

        // Expect validation error
        expect(result).toHaveProperty('success', false);
        expect(result.error).toMatch(/Validation Error/);
        expect(mocks.ffmpeg.ffprobe).not.toHaveBeenCalled();
    });

    it('should BLOCK Path Traversal with encoded characters (Basic)', async () => {
        const maliciousPath = '/tmp/../etc/shadow.wav';

        const result = await invokeHandler('audio:analyze', maliciousPath);

        expect(result).toHaveProperty('success', false);
        expect(result.error).toMatch(/Validation Error/);
        expect(mocks.ffmpeg.ffprobe).not.toHaveBeenCalled();
    });

    it('should BLOCK unsupported file types (e.g. executables)', async () => {
        const maliciousPath = '/tmp/malware.exe';
        const result = await invokeHandler('audio:analyze', maliciousPath);

        expect(result).toHaveProperty('success', false);
        expect(result.error).toMatch(/Validation Error/);
        expect(mocks.ffmpeg.ffprobe).not.toHaveBeenCalled();
    });

    it('should ALLOW valid audio files in safe paths', async () => {
        const safePath = '/Users/jules/Music/song.mp3';

        // Mock successful ffprobe
        mocks.ffmpeg.ffprobe.mockImplementation((path, callback) => {
            callback(null, {
                format: {
                    duration: 120,
                    format_name: 'mp3',
                    bit_rate: 320000
                }
            });
        });

        // Mock stream for hash
        const mockStream = {
            on: (event: string, cb: Function) => {
                if (event === 'end') cb();
                return mockStream;
            },
        };

        // Mock fs.createReadStream to return the mockStream
        mocks.fs.createReadStream.mockReturnValue(mockStream);
        mocks.fs.default.createReadStream.mockReturnValue(mockStream); // Ensure default export also works if needed

        const result = await invokeHandler('audio:analyze', safePath);

        expect(result.status).toBe('success');
        expect(result.hash).toBe('mock-hash-123');
        expect(mocks.ffmpeg.ffprobe).toHaveBeenCalled();
    });

    it('should BLOCK execution from untrusted IPC sender (e.g. Web)', async () => {
         const maliciousEvent = {
            senderFrame: { url: 'https://evil.com/exploit.html' }
        };
        const handler = handlers['audio:analyze'];

        // Match the exact error from ipc-security.ts
        await expect(handler(maliciousEvent, '/tmp/song.mp3')).rejects.toThrow(/Security: Unauthorized sender URL/);
    });
});
