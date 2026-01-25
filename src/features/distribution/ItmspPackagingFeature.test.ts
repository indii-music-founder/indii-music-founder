import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItmspPackagingFeature, ItmspPackagingOptions } from './ItmspPackagingFeature';

describe('ItmspPackagingFeature', () => {
  let feature: ItmspPackagingFeature;
  let mockPythonBridge: { runScript: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    feature = new ItmspPackagingFeature();
    mockPythonBridge = {
      runScript: vi.fn(),
    };
  });

  describe('Validation', () => {
    it('should return validation error for empty releaseId', async () => {
      const options = { releaseId: '', stagingPath: '/valid/path' } as ItmspPackagingOptions;
      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Release ID is required');
      expect(mockPythonBridge.runScript).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid releaseId characters', async () => {
      const options = { releaseId: 'Bad ID!', stagingPath: '/valid/path' } as ItmspPackagingOptions;
      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Release ID must be alphanumeric');
      expect(mockPythonBridge.runScript).not.toHaveBeenCalled();
    });

    it('should return validation error for empty stagingPath', async () => {
      const options = { releaseId: 'valid_id', stagingPath: '' } as ItmspPackagingOptions;
      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Staging path is required');
      expect(mockPythonBridge.runScript).not.toHaveBeenCalled();
    });
  });

  describe('Execution', () => {
    it('should execute successfully and return data when script succeeds', async () => {
      const options: ItmspPackagingOptions = { releaseId: 'release_123', stagingPath: '/tmp/staging' };
      const mockResponse = {
        status: 'SUCCESS',
        release_id: 'release_123',
        bundle_path: '/tmp/staging/release_123.itmsp',
        details: 'Packaging complete',
        delivery_ready: true
      };

      mockPythonBridge.runScript.mockResolvedValue(mockResponse);

      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockPythonBridge.runScript).toHaveBeenCalledWith(
        'distribution',
        'package_itmsp.py',
        ['release_123', '/tmp/staging']
      );
    });

    it('should return error when script returns FAIL status', async () => {
      const options: ItmspPackagingOptions = { releaseId: 'release_123', stagingPath: '/tmp/staging' };
      const mockResponse = {
        status: 'FAIL',
        error: 'Directory not found'
      };

      mockPythonBridge.runScript.mockResolvedValue(mockResponse);

      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Directory not found');
      expect(result.data).toBeUndefined();
    });

    it('should return error when pythonBridge throws an exception', async () => {
      const options: ItmspPackagingOptions = { releaseId: 'release_123', stagingPath: '/tmp/staging' };
      const errorMsg = 'Python process crashed';

      mockPythonBridge.runScript.mockRejectedValue(new Error(errorMsg));

      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMsg);
    });

    it('should handle non-Error objects thrown by pythonBridge', async () => {
      const options: ItmspPackagingOptions = { releaseId: 'release_123', stagingPath: '/tmp/staging' };

      mockPythonBridge.runScript.mockRejectedValue('Unknown string error');

      const result = await feature.execute(options, mockPythonBridge);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown string error');
    });
  });
});
