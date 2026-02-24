import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { AudioFidelityFeature } from '../../src/features/audio/AudioFidelityFeature';
import { PythonBridge } from '../../electron/utils/python-bridge';

// Mock PythonBridge and AgentSupervisor
vi.mock('../../electron/utils/python-bridge', () => ({
  PythonBridge: {
    runScript: vi.fn()
  }
}));

vi.mock('../../src/core/utils/AgentSupervisor', () => ({
  AgentSupervisor: {
    executeAgentTool: vi.fn(async (toolName, fallbackFunction) => {
      return await fallbackFunction(); // Immediately invoke the inner function to bypass retry logic
    })
  }
}));

// Mock electron to prevent AgentSupervisor from crashing
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => ''
  }
}));

describe('AudioFidelityFeature', () => {
  let feature: AudioFidelityFeature;

  beforeEach(() => {
    feature = new AudioFidelityFeature();
    vi.mocked(PythonBridge.runScript).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate inputs correctly', async () => {
    const result = await feature.execute({
      filePath: '',
      // @ts-expect-error - testing runtime validation
      targetStandard: 'Invalid'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation Error');
  });

  it('should execute successfully with valid inputs and script success', async () => {
    const mockData = {
      status: 'success',
      data: {
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
      }
    };

    vi.mocked(PythonBridge.runScript).mockResolvedValue(mockData);

    const result = await feature.execute({
      filePath: '/tmp/test.wav',
      targetStandard: 'Hi-Res'
    });
    expect(result.success).toBe(true);
    expect(result.data?.summary_status).toBe('PASS');
    expect(PythonBridge.runScript).toHaveBeenCalledWith(
      'audio',
      'audio_fidelity_audit.py',
      ['/tmp/test.wav', 'Hi-Res'],
      undefined,
      expect.any(Object),
      []
    );
  });

  it('should handle script failure (non-zero exit code)', async () => {
    vi.mocked(PythonBridge.runScript).mockRejectedValue(new Error('Python script execution failed: FileNotFoundError: [Errno 2] No such file or directory'));

    const result = await feature.execute({
      filePath: '/tmp/nonexistent.wav'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Python script execution failed');
    expect(result.error).toContain('FileNotFoundError');
  });

  it('should handle script logic failure (JSON error field)', async () => {
    vi.mocked(PythonBridge.runScript).mockResolvedValue({
      error: 'File not found'
    });

    const result = await feature.execute({
      filePath: '/tmp/missing.wav'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });

  it('should handle malformed JSON output', async () => {
    vi.mocked(PythonBridge.runScript).mockResolvedValue('Not JSON');

    const result = await feature.execute({
      filePath: '/tmp/test.wav'
    });

    // The feature itself parses the output from `runScript` which returns raw string if JSON parsing failed.
    // So the feature throws because it expects an object.
    expect(result.success).toBe(false);
  });
});
