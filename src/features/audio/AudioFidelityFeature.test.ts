import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioFidelityFeature } from './AudioFidelityFeature';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

// Mock child_process
vi.mock('child_process', () => {
    const mockFn = vi.fn();
    return {
        __esModule: true,
        spawn: mockFn,
        default: { spawn: mockFn }
    };
});

describe('AudioFidelityFeature', () => {
    let feature: AudioFidelityFeature;
    const mockSpawn = vi.mocked(spawn);

    beforeEach(() => {
        vi.clearAllMocks();
        feature = new AudioFidelityFeature();
    });

    it('should return validation error for invalid input', async () => {
        // Test with empty string to trigger min(1) validation
        const result = await feature.execute({ filePath: '', targetStandard: 'CD' } as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File path is required');
        expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should execute successfully and return parsed data', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'test.wav' });

        // Simulate script output
        const mockOutput = JSON.stringify({
            file: 'test.wav',
            format: 'wav',
            sample_rate: '44100',
            bit_depth: '16',
            channels: 2,
            compliance: {
                CD_Quality: true,
                Hi_Res: false,
                Atmos_Ready: false
            },
            summary_status: 'CD_Quality'
        });

        // Emit data
        mockChild.stdout.emit('data', Buffer.from(mockOutput));
        mockChild.emit('close', 0);

        const result = await executePromise;

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.format).toBe('wav');
        expect(mockSpawn).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['test.wav', 'Hi-Res']));
    });

    it('should handle script execution failure', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'bad.wav' });

        mockChild.stderr.emit('data', Buffer.from('File not found'));
        mockChild.emit('close', 1);

        const result = await executePromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Script failed with code 1');
        expect(result.error).toContain('File not found');
    });

    it('should handle invalid JSON output from script', async () => {
        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'corrupt.wav' });

        mockChild.stdout.emit('data', Buffer.from('Invalid JSON Output'));
        mockChild.emit('close', 0);

        const result = await executePromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to parse script output');
    });

    it('should handle process spawning error', async () => {
         const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockSpawn.mockReturnValue(mockChild);

        const executePromise = feature.execute({ filePath: 'error.wav' });

        // Wait for listeners to be attached
        await new Promise(resolve => setTimeout(resolve, 0));

        mockChild.emit('error', new Error('Spawn failed'));

        const result = await executePromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Process Execution Error');
        expect(result.error).toContain('Spawn failed');
    });
});
