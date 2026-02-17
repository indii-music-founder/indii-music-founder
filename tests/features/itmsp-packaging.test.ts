import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ItmspPackagingFeature } from '../../src/features/distribution/ItmspPackagingFeature';

interface MockPythonBridge {
  runScript: Mock;
}

describe('ItmspPackagingFeature', () => {
  let feature: ItmspPackagingFeature;
  let mockPythonBridge: MockPythonBridge;

  beforeEach(() => {
    feature = new ItmspPackagingFeature();

    // Mock PythonBridge
    mockPythonBridge = {
      runScript: vi.fn()
    };
  });

  it('should validate inputs correctly', async () => {
    const result = await feature.execute({
      releaseId: '', // Invalid
      stagingPath: '' // Invalid
    }, mockPythonBridge);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation Error');
    expect(result.error).toContain('Release ID is required');
    expect(result.error).toContain('Staging path is required');

    // Should not call Python script if validation fails
    expect(mockPythonBridge.runScript).not.toHaveBeenCalled();
  });

  it('should reject invalid release IDs', async () => {
    const result = await feature.execute({
      releaseId: 'Invalid ID!', // Contains space and bang
      stagingPath: '/tmp/test'
    }, mockPythonBridge);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Release ID must be alphanumeric');
    expect(mockPythonBridge.runScript).not.toHaveBeenCalled();
  });

  it('should execute successfully with valid inputs and script success', async () => {
    const mockOutput = {
      status: 'PASS',
      release_id: 'REL123',
      bundle_path: '/tmp/REL123.itmsp',
      details: 'Success',
      delivery_ready: true
    };

    mockPythonBridge.runScript.mockResolvedValue(mockOutput);

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/tmp/staging'
    }, mockPythonBridge);

    expect(result.success).toBe(true);
    expect(result.data?.release_id).toBe('REL123');
    expect(result.data?.bundle_path).toBe('/tmp/REL123.itmsp');

    // Verify PythonBridge was called correctly
    expect(mockPythonBridge.runScript).toHaveBeenCalledTimes(1);
    expect(mockPythonBridge.runScript).toHaveBeenCalledWith(
      'distribution',
      'package_itmsp.py',
      ['REL123', '/tmp/staging']
    );
  });

  it('should handle script logic failure (JSON status FAIL)', async () => {
    const mockOutput = {
      status: 'FAIL',
      error: 'Staging path does not exist'
    };

    mockPythonBridge.runScript.mockResolvedValue(mockOutput);

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/invalid/path'
    }, mockPythonBridge);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Staging path does not exist');
  });

  it('should handle Python script execution error', async () => {
    mockPythonBridge.runScript.mockRejectedValue(new Error('Python script execution failed: spawn ENOENT'));

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/tmp/staging'
    }, mockPythonBridge);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Python script execution failed');
  });

  it('should handle script returning error field', async () => {
    const mockOutput = {
      status: 'SUCCESS',
      error: 'Warning: Some files were skipped'
    };

    mockPythonBridge.runScript.mockResolvedValue(mockOutput);

    const result = await feature.execute({
      releaseId: 'REL123',
      stagingPath: '/tmp/staging'
    }, mockPythonBridge);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Warning: Some files were skipped');
  });
});
