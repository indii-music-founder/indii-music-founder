// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AgentSupervisor instead of child_process
const mockRunScript = vi.fn();
vi.mock('../../../../main/src/utils/AgentSupervisor', () => ({
    AgentSupervisor: {
        runScript: mockRunScript
    }
}));

import { AudioFidelityFeature } from './AudioFidelityFeature';

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
        expect(mockRunScript).not.toHaveBeenCalled();
    });

    it('should execute successfully and return parsed data', async () => {
        const mockResponse = {
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
        };

        mockRunScript.mockResolvedValue(mockResponse);

        const result = await feature.execute({ filePath: 'test.wav' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);
        expect(mockRunScript).toHaveBeenCalledWith(
            'audio',
            'audio_fidelity_audit.py',
            ['test.wav', 'Hi-Res'],
            undefined,
            expect.objectContaining({ PYTHON_PATH: 'python3' })
        );
    });

    it('should handle script reported error', async () => {
        mockRunScript.mockResolvedValue({
            error: 'File not found'
        });

        const result = await feature.execute({ filePath: 'bad.wav' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found');
    });

    it('should handle supervisor thrown error (e.g. timeout)', async () => {
        mockRunScript.mockRejectedValue(new Error('Execution timeout'));

        const result = await feature.execute({ filePath: 'timeout.wav' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Audio Fidelity Audit failed: Execution timeout');
    });
});
