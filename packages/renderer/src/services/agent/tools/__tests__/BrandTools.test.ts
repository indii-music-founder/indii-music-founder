
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrandTools } from '../BrandTools';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';

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

vi.mock('@/services/brand/BrandSyncService', () => ({
    brandSyncService: {
        syncBrandPalette: vi.fn().mockResolvedValue({
            success: true,
            message: 'Brand palette successfully updated with 2 colors.',
            palette: [
                { hex: '#00f0ff', label: 'Cyan', raw: 'Cyan (#00f0ff)' },
                { hex: '#ff0055', label: 'Magenta', raw: 'Magenta (#ff0055)' },
            ],
            formattedRules: ['Brand Color Palette: Cyan (#00f0ff), Magenta (#ff0055)'],
        }),
        getActivePalette: vi.fn().mockResolvedValue([
            { hex: '#00f0ff', label: 'Cyan', raw: 'Cyan (#00f0ff)' },
        ]),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            userProfile: {
                brandKit: {
                    colors: ['Cyan (#00f0ff)'],
                    aestheticStyle: 'Neon Noir',
                    fonts: 'Inter, Orbitron',
                    visualIdentity: 'Cyberpunk minimalism',
                    brandDescription: 'Futuristic electronic duo',
                },
            },
        })),
    },
}));

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { brandSyncService } from '@/services/brand/BrandSyncService';

describe('BrandTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock the electron API for vision tasks
        (window as any).electronAPI = {
            brand: {
                analyzeConsistency: vi.fn().mockResolvedValue({
                    success: true,
                    report: {
                        consistent: false,
                        consistency_score: 50,
                        summary: "Image 1 has wrong colors"
                    }
                })
            }
        };
    });

    it('verify_output returns valid schema', async () => {
        const mockResponse = {
            approved: true,
            critique: "Looks good",
            score: 9
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await BrandTools.verify_output({ goal: 'Be bold', content: 'BOLD CONTENT' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
    });

    it('analyze_brand_consistency returns valid schema', async () => {
        const mockResponse = {
            consistent: true,
            issues: [],
            recommendations: ["Keep it up"]
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await BrandTools.analyze_brand_consistency({ content: 'test content' });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
    });

    it('generate_brand_guidelines returns valid schema', async () => {
        const mockResponse = {
            voice: "Professional",
            visuals: "Blue and White",
            dos_and_donts: ["Do this", "Don't do that"]
        };
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const result = await BrandTools.generate_brand_guidelines({ name: 'TestBrand', values: ['Trust'] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(mockResponse));
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
    });

    it('audit_visual_assets returns valid schema', async () => {
        const expectedResponse = {
            compliant: false,
            flagged_assets: ["image1.jpg"],
            report: expect.any(String) // the report is a JSON stringified array
        };

        const result = await BrandTools.audit_visual_assets({ assets: ['image1.jpg'] });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining(expectedResponse));
        expect((window as any).electronAPI.brand.analyzeConsistency).toHaveBeenCalledWith('image1.jpg', {});
    });

    it('set_brand_palette delegates to brandSyncService and returns success', async () => {
        const result = await BrandTools.set_brand_palette({
            colors: ['#00f0ff', '#ff0055'],
            aestheticStyle: 'Cyberpunk',
            reason: 'Album launch theme',
        });

        expect(result.success).toBe(true);
        expect(brandSyncService.syncBrandPalette).toHaveBeenCalledWith(
            ['#00f0ff', '#ff0055'],
            {
                aestheticStyle: 'Cyberpunk',
                reason: 'Album launch theme',
                modifiedBy: 'agent',
            }
        );
        expect(result.data.palette.length).toBe(2);
    });

    it('set_brand_palette rejects empty color list', async () => {
        const result = await BrandTools.set_brand_palette({
            colors: [],
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('At least one color is required');
        expect(result.metadata?.errorCode).toBe('INVALID_ARGS');
    });

    it('get_brand_identity returns current palette and brand metadata', async () => {
        const result = await BrandTools.get_brand_identity({});

        expect(result.success).toBe(true);
        expect(result.data.aestheticStyle).toBe('Neon Noir');
        expect(result.data.fonts).toBe('Inter, Orbitron');
        expect(result.data.colors.length).toBe(1);
    });
});

