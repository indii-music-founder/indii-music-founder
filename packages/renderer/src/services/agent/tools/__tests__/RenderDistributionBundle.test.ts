import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderDistributionBundle = vi.fn();
const scanAsset = vi.fn();
const recordVersion = vi.fn();
const getRights = vi.fn();
const addToHistory = vi.fn();

vi.mock('@/services/distribution/RenderProfiles', () => ({
    PROFILE_IDS: ['dsp_spotify', 'dsp_apple_music', 'dsp_tidal', 'print_poster_18x24']
}));

vi.mock('@/services/distribution/DistributionRenderPipeline', () => ({
    renderDistributionBundle: (...args: unknown[]) => renderDistributionBundle(...args)
}));

vi.mock('@/services/brand/BrandComplianceService', () => ({
    scanAsset: (...args: unknown[]) => scanAsset(...args)
}));

vi.mock('@/services/assets/AssetVersionService', () => ({
    AssetVersionService: {
        recordVersion: (...args: unknown[]) => recordVersion(...args)
    }
}));

vi.mock('@/services/assets/AssetRightsService', () => ({
    AssetRightsService: {
        getRights: (...args: unknown[]) => getRights(...args)
    }
}));

let mockStoreState: Record<string, unknown> = {};

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockStoreState
    }
}));

import { MediaTools } from '../MediaTools';

describe('render_distribution_bundle tool (Workstream I / Tool 9)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState = {
            addToHistory,
            currentProjectId: 'proj_dist_123',
            generatedHistory: [
                { url: 'https://example.com/art0.png' },
                { url: 'https://example.com/art1.png' }
            ],
            uploadedImages: [],
            userProfile: null
        };

        renderDistributionBundle.mockResolvedValue({
            results: [
                {
                    profileId: 'dsp_spotify',
                    url: 'data:image/png;base64,SPOTIFY',
                    sha256: 'abc123sha',
                    width: 3000,
                    height: 3000,
                    bytes: 5000
                }
            ],
            manifest: {
                version: '1.0',
                renderedAt: 12345678,
                totalFiles: 1,
                results: [{ profileId: 'dsp_spotify', sha256: 'abc123sha' }]
            }
        });
        recordVersion.mockResolvedValue({ versionId: 'ver_1' });
    });

    it('rejects if neither masterUrl nor masterIndex is provided', async () => {
        const res = await (MediaTools as unknown as {
            render_distribution_bundle: (args: Record<string, unknown>) => Promise<{
                success: boolean;
                error?: string;
                metadata?: { errorCode?: string };
            }>;
        }).render_distribution_bundle({});

        expect(res.success).toBe(false);
        expect(res.metadata?.errorCode).toBe('INVALID_INPUT');
        expect(res.error).toContain('masterUrl or masterIndex is required');
    });

    it('resolves masterIndex from store if masterUrl is omitted', async () => {
        const res = await (MediaTools as unknown as {
            render_distribution_bundle: (args: { masterIndex: number }) => Promise<{ success: boolean; data: { count: number } }>;
        }).render_distribution_bundle({ masterIndex: 1 });

        expect(res.success).toBe(true);
        expect(renderDistributionBundle).toHaveBeenCalledWith(
            expect.objectContaining({
                masterUrl: 'https://example.com/art1.png'
            })
        );
        expect(res.data.count).toBe(1);
    });

    it('renders bundle, adds each item to store history, and records asset versions', async () => {
        const res = await (MediaTools as unknown as {
            render_distribution_bundle: (args: { masterUrl: string; profileIds?: string[] }) => Promise<{
                success: boolean;
                data: {
                    count: number;
                    results: Array<{ profileId: string; sha256: string }>;
                    manifest: unknown;
                };
            }>;
        }).render_distribution_bundle({
            masterUrl: 'https://example.com/master.png',
            profileIds: ['dsp_spotify']
        });

        expect(res.success).toBe(true);
        expect(res.data.count).toBe(1);
        expect(res.data.results[0].sha256).toBe('abc123sha');

        expect(addToHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'data:image/png;base64,SPOTIFY',
                tags: ['distribution-bundle', 'dsp_spotify'],
                origin: 'canvas-export'
            })
        );

        expect(recordVersion).toHaveBeenCalledWith(
            expect.objectContaining({
                source: 'export-bundle',
                tags: ['distribution-bundle', 'dsp_spotify']
            })
        );
    });

    it('blocks release if manifest reports blocked gate', async () => {
        renderDistributionBundle.mockResolvedValueOnce({
            results: [],
            manifest: {
                blocked: true,
                reason: 'compliance',
                errors: ['Resolution too low']
            }
        });

        const res = await (MediaTools as unknown as {
            render_distribution_bundle: (args: { masterUrl: string }) => Promise<{
                success: boolean;
                error?: string;
                metadata?: { errorCode?: string; manifest?: unknown };
            }>;
        }).render_distribution_bundle({ masterUrl: 'https://example.com/bad.png' });

        expect(res.success).toBe(false);
        expect(res.metadata?.errorCode).toBe('DISTRIBUTION_GATE_BLOCKED');
        expect(res.error).toContain('brand compliance gate');
    });

    it('passes overrideReason through compliance gate and records it in AssetVersion', async () => {
        mockStoreState.userProfile = {
            brandKit: {
                colors: ['#000000'],
                fonts: ['Inter']
            }
        };
        scanAsset.mockResolvedValueOnce({
            passed: false,
            assetId: 'asset_123',
            score: 40
        });

        const res = await (MediaTools as unknown as {
            render_distribution_bundle: (args: { masterUrl: string; overrideReason: string }) => Promise<{ success: boolean }>;
        }).render_distribution_bundle({
            masterUrl: 'https://example.com/artwork.png',
            overrideReason: 'Artist signature aesthetic exemption approved by creative director'
        });

        expect(res.success).toBe(true);
        expect(renderDistributionBundle).toHaveBeenCalledWith(
            expect.objectContaining({
                gates: expect.objectContaining({
                    compliance: expect.objectContaining({
                        passed: false,
                        overrideReason: 'Artist signature aesthetic exemption approved by creative director'
                    })
                })
            })
        );

        expect(recordVersion).toHaveBeenCalledWith(
            expect.objectContaining({
                compliance: expect.objectContaining({
                    overrideReason: 'Artist signature aesthetic exemption approved by creative director'
                })
            })
        );
    });
});
