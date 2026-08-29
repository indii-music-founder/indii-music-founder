import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
    },
}));

const mockState = {
    generatedHistory: [
        { id: 'hist-1', url: 'data:image/png;base64,AAA', prompt: 'cover', type: 'image', timestamp: 1, projectId: 'p1' },
    ],
    uploadedImages: [
        { id: 'up-1', url: 'data:image/png;base64,BBB', prompt: 'upload', type: 'image', timestamp: 2, projectId: 'p1' },
    ],
    userProfile: {
        brandKit: {
            colors: ['#FF0000'],
            fonts: 'Geist',
            brandDescription: 'test',
            negativePrompt: '',
            socials: {},
            brandAssets: [],
            referenceImages: [],
            releaseDetails: {},
        },
    },
};

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => mockState),
    },
}));

const mockScanAsset = vi.fn();
vi.mock('@/services/brand/BrandComplianceService', () => ({
    scanAsset: (...args: unknown[]) => mockScanAsset(...args),
}));

import { BrandTools } from '../BrandTools';

const tool = BrandTools.scan_brand_compliance!;

describe('scan_brand_compliance tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockScanAsset.mockReset();
    });

    it('errors when the index resolves to nothing', async () => {
        const result = await tool({ assetIndex: 99 });
        expect(result.success).toBe(false);
        expect(mockScanAsset).not.toHaveBeenCalled();
    });

    it('errors when no usable brand kit exists', async () => {
        const original = mockState.userProfile;
        mockState.userProfile = null;
        const result = await tool({ assetIndex: 0 });
        expect(result.success).toBe(false);
        expect(result).toMatchObject({ success: false });
        mockState.userProfile = original;
    });

    it('scans the resolved history asset and reports a pass', async () => {
        mockScanAsset.mockResolvedValue({
            assetId: 'hist-1',
            passed: true,
            score: 100,
            engine: 'hybrid',
            violations: [],
        });
        const result = await tool({ assetIndex: 0 });
        expect(mockScanAsset).toHaveBeenCalledWith(
            'data:image/png;base64,AAA',
            expect.objectContaining({ colors: ['#FF0000'] }),
            undefined,
            expect.objectContaining({ assetId: 'hist-1' })
        );
        expect(result.success).toBe(true);
        expect((result as { data: { passed: boolean } }).data.passed).toBe(true);
    });

    it('resolves uploads by id and reports a DEC-6 failure message', async () => {
        mockScanAsset.mockResolvedValue({
            assetId: 'up-1',
            passed: false,
            score: 55,
            engine: 'pixel',
            violations: [
                { severity: 'error', type: 'color', detail: 'off-palette' },
                { severity: 'warning', type: 'typography', detail: 'unverifiable' },
            ],
        });
        const result = await tool({ assetId: 'up-1' });
        expect(mockScanAsset).toHaveBeenCalledWith(
            'data:image/png;base64,BBB',
            expect.anything(),
            undefined,
            expect.objectContaining({ assetId: 'up-1' })
        );
        expect((result as { data: { passed: boolean } }).data.passed).toBe(false);
        expect((result as { message: string }).message).toContain('override');
    });

    it('wraps scan failures as tool errors', async () => {
        mockScanAsset.mockRejectedValue(new Error('boom'));
        const result = await tool({ assetIndex: 0 });
        expect(result.success).toBe(false);
        expect((result as { message?: string }).message ?? '').toContain('boom');
    });
});
