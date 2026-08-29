import { describe, it, expect, vi } from 'vitest';
import { BrandAgent } from './BrandAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateText: vi.fn().mockResolvedValue('mock response'),
        analyzeImage: vi.fn().mockResolvedValue('mock image analysis'),
    }
}));

// Mock store for analyze_audio
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn().mockReturnValue({
            uploadedAudio: [
                { url: 'blob:mock-url' }
            ]
        })
    }
}));

// Mock AudioIntelligenceService
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: {
        analyze: vi.fn().mockResolvedValue({
            bpm: 120,
            key: 'C Major',
            genre: 'Electronic',
            vibe: 'Upbeat'
        })
    }
}));

describe('BrandAgent', () => {
    it('should have required tools registered in authorizedTools array', () => {
        expect(BrandAgent.authorizedTools).toContain('analyze_brand_sentiment');
        expect(BrandAgent.authorizedTools).toContain('generate_brand_kit');
    });

    it('should authorize the compliance scanner (Workstream D)', () => {
        expect(BrandAgent.authorizedTools).toContain('scan_brand_compliance');
        expect(BrandAgent.functions.scan_brand_compliance).toBeDefined();
    });

    it('should declare the scan_brand_compliance schema', () => {
        const schemas = BrandAgent.tools[0].functionDeclarations.map(d => d.name);
        expect(schemas).toContain('scan_brand_compliance');
    });

    it('should delegate asset-based consistency analysis to the compliance engine', async () => {
        // Store mock (above) has no brandKit → the absorbed asset path must
        // fail loudly rather than silently returning prose.
        const result = await BrandAgent.functions.analyze_brand_consistency({
            content: 'irrelevant',
            type: 'image',
            assetPath: 'data:image/png;base64,AAA',
        });
        expect(result.success).toBe(false);
        expect((result as { error?: string }).error).toContain('Brand Kit');
    });

    it('should declare tool schemas for Phase C tools', () => {
        const schemas = BrandAgent.tools[0].functionDeclarations.map(d => d.name);
        expect(schemas).toContain('analyze_brand_sentiment');
        expect(schemas).toContain('generate_brand_kit');
    });

    it('should execute analyze_brand_sentiment', async () => {
        const result = await BrandAgent.functions.analyze_brand_sentiment({ text: 'I love this brand!', context: 'Twitter' });
        expect(result.success).toBe(true);
        expect(AutonomousIntelligence.generateText).toHaveBeenCalled();
    });

    it('should execute generate_brand_kit', async () => {
        const result = await BrandAgent.functions.generate_brand_kit({ description: 'A sleek, modern music brand', core_values: ['Innovation', 'Quality'] });
        expect(result.success).toBe(true);
        expect(AutonomousIntelligence.generateText).toHaveBeenCalled();
    });
});
