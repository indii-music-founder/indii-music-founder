
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandTools } from '../BrandTools';
import { AutonomousGenAI as AI } from '@/services/intelligence/AutonomousGenAI';

// Mock the Firebase Intelligence service
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

import { AutonomousGenAI } from '@/services/intelligence/AutonomousGenAI';

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
        vi.mocked(AutonomousGenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateStructuredData>>);

        const result = await BrandTools.verify_output({ goal: 'Be bold', content: 'BOLD CONTENT' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousGenAI.generateStructuredData).toHaveBeenCalled();
    });

    it('analyze_brand_consistency returns valid schema', async () => {
        const mockResponse = {
            consistent: true,
            issues: [],
            recommendations: ["Keep it up"]
        };
        vi.mocked(AutonomousGenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateStructuredData>>);

        const result = await BrandTools.analyze_brand_consistency({ content: 'test content' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousGenAI.generateStructuredData).toHaveBeenCalled();
    });

    it('generate_brand_guidelines returns valid schema', async () => {
        const mockResponse = {
            voice: "Professional",
            visuals: "Blue and White",
            dos_and_donts: ["Do this", "Don't do that"]
        };
        vi.mocked(AutonomousGenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateStructuredData>>);

        const result = await BrandTools.generate_brand_guidelines({ name: 'TestBrand', values: ['Trust'] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousGenAI.generateStructuredData).toHaveBeenCalled();
    });

    it('audit_visual_assets returns valid schema', async () => {
        const mockResponse = {
            compliant: false,
            flagged_assets: ["image1.jpg"],
            report: "Image 1 has wrong colors"
        };
        vi.mocked(AutonomousGenAI.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousGenAI.generateStructuredData>>);

        const result = await BrandTools.audit_visual_assets({ assets: ['image1.jpg'] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousGenAI.generateStructuredData).toHaveBeenCalled();
    });
});
