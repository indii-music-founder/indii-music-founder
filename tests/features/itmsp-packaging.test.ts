import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ItmspPackagingFeature } from '../../src/features/distribution/ItmspPackagingFeature';
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

describe('ItmspPackagingFeature', () => {
  let feature: ItmspPackagingFeature;
  let mockSpawn: any;

  beforeEach(() => {
    feature = new ItmspPackagingFeature();
    // Get the mocked spawn function
    mockSpawn = vi.mocked(spawn);
    mockSpawn.mockReset(); // Clear previous calls and implementations
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to simulate spawn process
  const setupMockSpawn = (stdoutData: string, stderrData: string = '', exitCode: number = 0) => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as any;
    child.stdout = stdout;
    child.stderr = stderr;
    // Add kill method which is often called
    child.kill = vi.fn();

    // Ensure spawn returns this child
    mockSpawn.mockReturnValue(child);

    // Trigger events asynchronously to simulate process
    setTimeout(() => {
      if (stdoutData) stdout.emit('data', stdoutData);
      if (stderrData) stderr.emit('data', stderrData);
      child.emit('close', exitCode);
    }, 10);

    return child;
  };

  it('should validate inputs correctly', async () => {
    const result = await feature.execute({
      releaseId: '', // Invalid
      stagingPath: '' // Invalid
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation Error');
    expect(result.error).toContain('Release ID is required');
    expect(result.error).toContain('Staging path is required');
  });

  it('should reject invalid release IDs', async () => {
    const result = await feature.execute({
      releaseId: 'Invalid ID!', // Contains space and bang
      stagingPath: '/tmp/test'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Release ID must be alphanumeric');
  });

  it('should execute successfully with valid inputs and script success', async () => {
    const mockOutput = JSON.stringify({
      status: 'PASS',
      release_id: 'REL123',
      bundle_path: '/tmp/REL123.itmsp',
      details: 'Success',
      delivery_ready: true
    });

    setupMockSpawn(mockOutput);

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/tmp/staging'
    });

    expect(result.success).toBe(true);
    expect(result.data?.release_id).toBe('REL123');
    expect(result.data?.bundle_path).toBe('/tmp/REL123.itmsp');
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('python'),
      expect.arrayContaining([expect.stringContaining('package_itmsp.py'), 'REL123', '/tmp/staging'])
    );
  });

  it('should handle script failure (non-zero exit code)', async () => {
    setupMockSpawn('', 'ImportError: missing module', 1);

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/tmp/staging'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Script failed with code 1');
    expect(result.error).toContain('ImportError: missing module');
  });

  it('should handle script logic failure (JSON status FAIL)', async () => {
    const mockOutput = JSON.stringify({
      status: 'FAIL',
      error: 'Staging path does not exist'
    });

    setupMockSpawn(mockOutput);

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/invalid/path'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Staging path does not exist');
  });

  it('should handle malformed JSON output from script', async () => {
    setupMockSpawn('This is not JSON');

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/tmp/staging'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse script output');
  });

  it('should handle spawn error (e.g. python not found)', async () => {
     const stdout = new EventEmitter();
     const stderr = new EventEmitter();
     const child = new EventEmitter() as any;
     child.stdout = stdout;
     child.stderr = stderr;

     mockSpawn.mockReturnValue(child);

     // Simulate immediate error
     setTimeout(() => {
        child.emit('error', new Error('spawn ENOENT'));
     }, 10);

     const result = await feature.execute({
        releaseId: 'REL123',
        stagingPath: '/tmp/staging'
     });

     expect(result.success).toBe(false);
     expect(result.error).toContain('Process Execution Error: spawn ENOENT');
  });
});
