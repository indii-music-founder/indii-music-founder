import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportMasterAsset = vi.fn();
const downloadAsZip = vi.fn();

vi.mock('@/services/export/AssetExporter', () => ({
    exportMasterAsset: (...a: unknown[]) => exportMasterAsset(...a),
    downloadAsZip: (...a: unknown[]) => downloadAsZip(...a),
    DEFAULT_CORE_MATRIX_IDS: ['spotify_cover', 'ig_story', 'landscape', 'x_post', 'facebook_og']
}));

vi.mock('@/core/store', () => {
    const mockStore = {
        addToHistory: vi.fn(),
        currentProjectId: 'proj_test'
    };
    return { useStore: { getState: () => mockStore } };
});

import { MediaTools } from '../MediaTools';
import { useStore } from '@/core/store';

const RESULTS = [
    { platformId: 'spotify_cover', url: 'data:image/png;base64,AAA', width: 3000, height: 3000, bytes: 1234, fit: 'cover' },
    { platformId: 'ig_story', url: 'data:image/png;base64,BBB', width: 1080, height: 1920, bytes: 2345, fit: 'contain-blur-pad' }
];

describe('export_platform_assets tool (G1.5)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        exportMasterAsset.mockResolvedValue(RESULTS);
    });

    it('exports the default core matrix when no platforms are given', async () => {
        const res = await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string }) => Promise<{ success: boolean; data: { count: number }; message: string }>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD' });

        expect(res.success).toBe(true);
        expect(exportMasterAsset).toHaveBeenCalledWith({
            masterUrl: 'data:image/png;base64,QUJD',
            presets: expect.arrayContaining([
                expect.objectContaining({ dimensionId: 'spotify_cover' }),
                expect.objectContaining({ dimensionId: 'facebook_og' })
            ])
        });
        expect(res.data.count).toBe(2);
        expect(res.message).toContain('no generative outpainting');
    });

    it('maps requested platforms to presets and respects the fit override', async () => {
        await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string; platforms?: string[]; fit?: string }) => Promise<unknown>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD', platforms: ['x_post'], fit: 'cover' });

        expect(exportMasterAsset).toHaveBeenCalledWith({
            masterUrl: 'data:image/png;base64,QUJD',
            presets: [{ dimensionId: 'x_post', fit: 'cover' }]
        });
    });

    it('records each export as a history item and bundles a zip by default', async () => {
        const res = await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string }) => Promise<{ success: boolean; data: { zipName?: string } }>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD' });

        const { addToHistory } = useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> };
        expect(addToHistory).toHaveBeenCalledTimes(2);
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            projectId: 'proj_test',
            meta: expect.stringContaining('platform-export'),
            tags: ['platform-export', 'spotify_cover']
        }));
        expect(downloadAsZip).toHaveBeenCalledTimes(1);
        expect(res.data.zipName).toBeTruthy();
    });

    it('can skip the zip bundle when download is false', async () => {
        await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string; download: boolean }) => Promise<unknown>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD', download: false });
        expect(downloadAsZip).not.toHaveBeenCalled();
    });

    it('fails closed on a missing masterUrl', async () => {
        const res = await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string }) => Promise<{ success: boolean; message: string }>;
        }).export_platform_assets({ masterUrl: '' });
        expect(res.success).toBe(false);
        expect(exportMasterAsset).not.toHaveBeenCalled();
    });

    it('surfaces exporter errors as tool errors', async () => {
        exportMasterAsset.mockRejectedValue(new Error('no presets matched a known platform dimension'));
        const res = await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string }) => Promise<{ success: boolean; message: string }>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('no presets matched');
    });
});
