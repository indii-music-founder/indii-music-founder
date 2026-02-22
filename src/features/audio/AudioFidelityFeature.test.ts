// @vitest-environment node
// AudioFidelityFeature spawns a Python process via dynamic import('child_process').
// vi.mock is hoisted by Vitest — it intercepts even dynamic imports at test runtime.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock reference — declared before vi.mock factory so factory can capture it
const mockSpawnImpl = vi.fn();

vi.mock('child_process', () => ({
    spawn: mockSpawnImpl,
    default: { spawn: mockSpawnImpl },
}));

// Mock 'path' too since execute() does `await import('path')` — avoids actual path resolution
vi.mock('path', async (importOriginal) => {
    const actual = await importOriginal<typeof import('path')>();
    return {
        ...actual,
        resolve: vi.fn((...args: string[]) => args[args.length - 1]),
    };
});

import { AudioFidelityFeature } from './AudioFidelityFeature';
import { EventEmitter } from 'events';

// Helper: create a fake child process with stdout/stderr streams
function createMockChild() {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

// Helper: poll until mockSpawnImpl has been called (dynamic imports resolved)
// This is more reliable than guessing microtask tick counts
async function waitForSpawn(timeout = 3000): Promise<void> {
    const start = Date.now();
    while (!mockSpawnImpl.mock.calls.length) {
        if (Date.now() - start > timeout) {
            throw new Error('Timed out waiting for spawn to be called');
        }
        await new Promise(resolve => setImmediate(resolve));
    }
}

describe('AudioFidelityFeature', () => {
    let feature: AudioFidelityFeature;

    beforeEach(() => {
        vi.clearAllMocks();
        feature = new AudioFidelityFeature();
    });

    it('should return validation error for invalid input', async () => {
        const result = await feature.execute({ filePath: '', targetStandard: 'CD' } as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File path is required');
        expect(mockSpawnImpl).not.toHaveBeenCalled();
    });

    it('should execute successfully and return parsed data', async () => {
        const mockChild = createMockChild();
        mockSpawnImpl.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'test.wav' });

        // Wait for dynamic imports to resolve and spawn to be called
        await waitForSpawn();

        const mockOutput = JSON.stringify({
            file: 'test.wav',
            format: 'wav',
            sample_rate: '44100',
            bit_depth: '16',
            channels: 2,
            compliance: {
                CD_Quality: true,
                Hi_Res: false,
                Atmos_Ready: false,
            },
            summary_status: 'CD_Quality',
        });

        mockChild.stdout.emit('data', Buffer.from(mockOutput));
        mockChild.emit('close', 0);

        const result = await executePromise;

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.format).toBe('wav');
        expect(mockSpawnImpl).toHaveBeenCalledWith(
            expect.any(String),
            expect.arrayContaining(['test.wav', 'Hi-Res']),
        );
    });

    it('should handle script execution failure', async () => {
        const mockChild = createMockChild();
        mockSpawnImpl.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'bad.wav' });
        await waitForSpawn();

        mockChild.stderr.emit('data', Buffer.from('File not found'));
        mockChild.emit('close', 1);

        const result = await executePromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Script failed with code 1');
        expect(result.error).toContain('File not found');
    });

    it('should handle invalid JSON output from script', async () => {
        const mockChild = createMockChild();
        mockSpawnImpl.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'corrupt.wav' });
        await waitForSpawn();

        mockChild.stdout.emit('data', Buffer.from('Invalid JSON Output'));
        mockChild.emit('close', 0);

        const result = await executePromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to parse script output');
    });

    it('should handle process spawning error', async () => {
        const mockChild = createMockChild();
        mockSpawnImpl.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'error.wav' });
        await waitForSpawn();

        mockChild.emit('error', new Error('Spawn failed'));

        const result = await executePromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Process Execution Error');
        expect(result.error).toContain('Spawn failed');
    });
});
