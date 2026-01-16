import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAudioHandlers } from './audio';

// Hoist mocks
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    fs: {
        createReadStream: vi.fn(),
        realpathSync: vi.fn((p) => p), // Default: path is real
        constants: { F_OK: 0 }
    },
    ffmpeg: {
        setFfmpegPath: vi.fn(),
        setFfprobePath: vi.fn(),
        ffprobe: vi.fn()
    }
}));

// Mock modules
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { isPackaged: false }
}));

vi.mock('fs', () => ({
    default: mocks.fs,
    ...mocks.fs
}));

vi.mock('fluent-ffmpeg', () => ({
    default: mocks.ffmpeg
}));

// Mock Validation (Partial) to ensure we are testing the handler logic
// We don't mock 'zod' because we want to test the schema validation integration
// But we might need to mock the util if we change it. For now, we use real validation.

describe('🛡️ Shield: Audio IPC Symlink Attack', () => {
    let handlers: Record<string, (...args: any[]) => any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
            handlers[channel] = handler;
        });

        // Register
        registerAudioHandlers();
    });

    const invokeHandler = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
    };

    it('should DETECT and BLOCK symlinks pointing to system files (/etc/passwd)', async () => {
        // 1. Setup Attack Vector
        // The user provides a path that LOOKS safe (valid extension, no traversal dots)
        const maliciousPath = '/Users/victim/Music/innocent_song.mp3';
        // We set the target to have a valid extension to bypass the extension check,
        // ensuring the SYSTEM DIRECTORY check is what blocks it.
        const targetTarget = '/etc/passwd.mp3';

        // 2. Mock File System Logic
        // When the handler checks the path, it eventually resolves to the system file
        mocks.fs.realpathSync.mockReturnValue(targetTarget);

        // Mock stream creation to verify if it was attempted (it shouldn't be if security blocks it)
        mocks.fs.createReadStream.mockImplementation(() => {
            return {
                on: vi.fn(),
                pipe: vi.fn()
            };
        });

        // 3. Invoke Handler
        // We expect the handler to throw or return an error due to the resolved path being unsafe
        // Note: Currently, without the fix, this might succeed (fail the test).
        // We wrap in try/catch to assert error message.

        let result;
        try {
            result = await invokeHandler('audio:analyze', maliciousPath);
        } catch (e) {
            result = { success: false, error: String(e) };
        }

        // 4. Assertions
        // If vulnerabilities exist, result.status might be 'success' or mocks.fs.createReadStream called.
        // We WANT it to fail.

        // Check if the secure validation was called/enforced
        if (result && result.status === 'success') {
            throw new Error('SECURITY FAILURE: Symlink to /etc/passwd was processed!');
        }

        expect(result).toBeDefined();
        // We expect a specific error from validateSafeAudioPath (which we will implement)
        // Or at least "Security Violation"
        expect(result.error || String(result)).toMatch(/Security Violation|System directory/);

        // Crucial: Ensure we never opened the file stream on the resolved path
        expect(mocks.fs.createReadStream).not.toHaveBeenCalled();
    });

    it('should ALLOW safe files that are real paths', async () => {
        const safePath = '/Users/victim/Music/real_song.mp3';
        mocks.fs.realpathSync.mockReturnValue(safePath);

        // Mock success for ffprobe/hash
        mocks.fs.createReadStream.mockReturnValue({
            on: (event: string, cb: any) => {
                if (event === 'end') cb();
                return this;
            }
        });
        mocks.ffmpeg.ffprobe.mockImplementation((path, cb) => {
            cb(null, { format: { duration: 60, format_name: 'mp3', bit_rate: 320000 } });
        });

        const result = await invokeHandler('audio:analyze', safePath);
        expect(result.status).toBe('success');
    });
});
