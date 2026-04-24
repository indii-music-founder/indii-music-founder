
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandTools } from '../BrandTools';
import { GenAI as AI } from '@/services/ai/GenAI';

// Mock the Firebase AI service
vi.mock('@/services/ai/FirebaseAIService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

import { GenAI } from '@/services/ai/GenAI';

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
        vi.mocked(GenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof GenAI.generateStructuredData>>);

        const result = await BrandTools.verify_output({ goal: 'Be bold', content: 'BOLD CONTENT' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(GenAI.generateStructuredData).toHaveBeenCalled();
    });

    it('analyze_brand_consistency returns valid schema', async () => {
        const mockResponse = {
            consistent: true,
            issues: [],
            recommendations: ["Keep it up"]
        };
        vi.mocked(GenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof GenAI.generateStructuredData>>);

        const result = await BrandTools.analyze_brand_consistency({ content: 'test content' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(GenAI.generateStructuredData).toHaveBeenCalled();
    });

    it('generate_brand_guidelines returns valid schema', async () => {
        const mockResponse = {
            voice: "Professional",
            visuals: "Blue and White",
            dos_and_donts: ["Do this", "Don't do that"]
        };
        vi.mocked(GenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof GenAI.generateStructuredData>>);

        const result = await BrandTools.generate_brand_guidelines({ name: 'TestBrand', values: ['Trust'] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(GenAI.generateStructuredData).toHaveBeenCalled();
    });

    it('audit_visual_assets returns valid schema', async () => {
        const mockResponse = {
            compliant: false,
            flagged_assets: ["image1.jpg"],
            report: "Image 1 has wrong colors"
        };
        vi.mocked(GenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof GenAI.generateStructuredData>>);

        const result = await BrandTools.audit_visual_assets({ assets: ['image1.jpg'] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(GenAI.generateStructuredData).toHaveBeenCalled();
    });
});
