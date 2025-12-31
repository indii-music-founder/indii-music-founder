import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandTools } from './BrandTools';
import { AI } from '@/services/ai/AIService';

vi.mock('@/services/ai/AIService', () => ({
  AI: {
    generateContent: vi.fn(),
    parseJSON: vi.fn((text) => {
        try { return JSON.parse(text); } catch { return {}; }
    })
  }
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT_AGENT: { model: 'mock-model' }
    }
}));

describe('BrandTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyze_brand_consistency', () => {
    it('should return parsed consistency analysis', async () => {
      const mockText = JSON.stringify({
        consistent: true,
        issues: [],
        recommendations: ['Keep it up']
      });
      const mockResponse = {
        text: vi.fn().mockReturnValue(mockText)
      };
      (AI.generateContent as any).mockResolvedValue(mockResponse);

      const result = await BrandTools.analyze_brand_consistency({
        content: "Our brand is bold.",
        type: "social post"
      });

      expect(result).toEqual({
        consistent: true,
        issues: [],
        recommendations: ['Keep it up']
      });
      expect(AI.generateContent).toHaveBeenCalledWith(expect.objectContaining({
          model: 'mock-model',
          contents: expect.objectContaining({
              parts: expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("Analyze the consistency") })])
          })
      }));
    });
  });

  describe('generate_brand_guidelines', () => {
      it('should return structured guidelines', async () => {
        const mockText = JSON.stringify({
            voice: "Bold",
            visuals: "Dark mode",
            dos_and_donts: ["Do this", "Don't do that"]
        });
        const mockResponse = {
            text: vi.fn().mockReturnValue(mockText)
        };
        (AI.generateContent as any).mockResolvedValue(mockResponse);

        const result = await BrandTools.generate_brand_guidelines({
            name: "Test Brand",
            values: ["Innovation"]
        });

        expect(result.voice).toBe("Bold");
        expect(result.visuals).toBe("Dark mode");
      });
  });

  describe('audit_visual_assets', () => {
      it('should return compliance report', async () => {
          const mockText = JSON.stringify({
              compliant: true,
              flagged_assets: [],
              report: "All good"
          });
          const mockResponse = {
              text: vi.fn().mockReturnValue(mockText)
          };
          (AI.generateContent as any).mockResolvedValue(mockResponse);

          const result = await BrandTools.audit_visual_assets({
              assets: ["logo.png"]
          });

          expect(result.compliant).toBe(true);
      });
  });
});
