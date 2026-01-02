
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandTools } from './BrandTools';
import { AI } from '@/services/ai/AIService';

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateStructuredData: vi.fn(),
        generateContent: vi.fn(),
        parseJSON: vi.fn((text) => JSON.parse(text))
    }
}));

describe('BrandTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('verify_output returns valid schema', async () => {
        const mockResponse = {
            approved: true,
            critique: "Looks good",
            score: 9
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await BrandTools.verify_output({ goal: 'Be bold', content: 'BOLD CONTENT' });
        expect(JSON.parse(result)).toEqual(mockResponse);
        expect(AI.generateStructuredData).toHaveBeenCalled();
    });

    it('analyze_brand_consistency returns valid schema', async () => {
        const mockResponse = {
            consistent: true,
            issues: [],
            recommendations: ["Keep it up"]
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await BrandTools.analyze_brand_consistency({ content: 'test content' });
        expect(JSON.parse(result)).toEqual(mockResponse);
        expect(AI.generateStructuredData).toHaveBeenCalled();
    });

    it('generate_brand_guidelines returns valid schema', async () => {
        const mockResponse = {
            voice: "Professional",
            visuals: "Blue and White",
            dos_and_donts: ["Do this", "Don't do that"]
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await BrandTools.generate_brand_guidelines({ name: 'TestBrand', values: ['Trust'] });
        expect(JSON.parse(result)).toEqual(mockResponse);
        expect(AI.generateStructuredData).toHaveBeenCalled();
    });

    it('audit_visual_assets returns valid schema', async () => {
        const mockResponse = {
            compliant: false,
            flagged_assets: ["image1.jpg"],
            report: "Image 1 has wrong colors"
        };
        (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await BrandTools.audit_visual_assets({ assets: ['image1.jpg'] });
        expect(JSON.parse(result)).toEqual(mockResponse);
        expect(AI.generateStructuredData).toHaveBeenCalled();
    });
});
