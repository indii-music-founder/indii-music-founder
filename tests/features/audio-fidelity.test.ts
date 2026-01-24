import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioFidelityFeature } from '../../src/features/audio/AudioFidelityFeature';
import { spawn } from 'child_process';
import EventEmitter from 'events';

// Hoisted mock
vi.mock('child_process', () => {
  const mockSpawn = vi.fn();
  return {
    spawn: mockSpawn,
    default: { spawn: mockSpawn }
  };
});

describe('AudioFidelityFeature', () => {
  let feature: AudioFidelityFeature;
  let mockSpawn: any;

  beforeEach(() => {
    feature = new AudioFidelityFeature();
    mockSpawn = vi.mocked(spawn);
    mockSpawn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupMockSpawn = (stdoutData: string, stderrData: string = '', exitCode: number = 0) => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as any;
    child.stdout = stdout;
    child.stderr = stderr;
    child.kill = vi.fn();

    mockSpawn.mockReturnValue(child);

    setTimeout(() => {
      if (stdoutData) stdout.emit('data', stdoutData);
      if (stderrData) stderr.emit('data', stderrData);
      child.emit('close', exitCode);
    }, 10);

    return child;
  };

  it('should validate inputs correctly', async () => {
    // @ts-expect-error - testing runtime validation
    const result = await feature.execute({
      filePath: '', // Invalid
      targetStandard: 'Invalid' // Invalid enum
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation Error');
  });

  it('should execute successfully with valid inputs and script success', async () => {
    const mockOutput = JSON.stringify({
      file: 'test.wav',
      format: 'wav',
      sample_rate: '96000 Hz',
      bit_depth: '24 bit',
      channels: 2,
      compliance: {
        CD_Quality: true,
        Hi_Res: true,
        Atmos_Ready: false
      },
      summary_status: 'PASS'
    });

    setupMockSpawn(mockOutput);

    const result = await feature.execute({
      filePath: '/tmp/test.wav',
      targetStandard: 'Hi-Res'
    });

    expect(result.success).toBe(true);
    expect(result.data?.summary_status).toBe('PASS');
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('python'),
      expect.arrayContaining([expect.stringContaining('audio_fidelity_audit.py'), '/tmp/test.wav', 'Hi-Res'])
    );
  });

  it('should handle script failure (non-zero exit code)', async () => {
    setupMockSpawn('', 'FileNotFoundError: [Errno 2] No such file or directory', 1);

    const result = await feature.execute({
      filePath: '/tmp/nonexistent.wav'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Script failed with code 1');
    expect(result.error).toContain('FileNotFoundError');
  });

  it('should handle script logic failure (JSON error field)', async () => {
    const mockOutput = JSON.stringify({
      error: 'File not found'
    });

    setupMockSpawn(mockOutput);

    const result = await feature.execute({
      filePath: '/tmp/missing.wav'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
  });

  it('should handle malformed JSON output', async () => {
    setupMockSpawn('Not JSON');

    const result = await feature.execute({
      filePath: '/tmp/test.wav'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse script output');
  });
});
