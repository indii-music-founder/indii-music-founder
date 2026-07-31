import { describe, it, expect, vi } from 'vitest';
import { runCreativeVisionCheck } from './VisionQC';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
  AutonomousIntelligence: {
    generateStructuredData: vi.fn().mockResolvedValue({
      approved: true,
      reason: 'Matches brand kit.',
    }),
  },
}));

describe('VisionQC Tool', () => {
  it('evaluates brand compliance and returns parsed result', async () => {
    const mockBrandKit = {
      primaryColors: ['#FF0000', '#000000'],
      forbiddenElements: ['neon green'],
      vibe: 'Dark cinematic hip-hop',
    };

    const result = await runCreativeVisionCheck('data:image/jpeg;base64,mock', mockBrandKit);
    expect(result).toBeDefined();
    expect(result.approved).toBe(true);
    expect(result.reason).toBe('Matches brand kit.');
    expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
  });

  it('handles evaluation errors gracefully and fails closed', async () => {
    vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValueOnce(new Error('API Timeout'));

    const mockBrandKit = {
      primaryColors: ['#000000'],
      forbiddenElements: [],
      vibe: 'Minimal',
    };

    const result = await runCreativeVisionCheck('raw_base64_data', mockBrandKit);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('failed to execute');
  });
});
