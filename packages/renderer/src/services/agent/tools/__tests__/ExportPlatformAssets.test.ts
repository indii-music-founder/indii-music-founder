import { describe, it, expect, vi, beforeEach } from 'vitest';

const exportMasterAsset = vi.fn();
const downloadAsZip = vi.fn();

vi.mock('@/services/export/AssetExporter', () => ({
    exportMasterAsset: (...a: unknown[]) => exportMasterAsset(...a),
    downloadAsZip: (...a: unknown[]) => downloadAsZip(...a),
    DEFAULT_CORE_MATRIX_IDS: ['spotify_cover', 'ig_story', 'landscape', 'x_post', 'facebook_og']
}));

vi.mock('@/services/assets/AssetVersionService', () => ({
    AssetVersionService: { recordVersion: vi.fn(async (input: unknown) => ({ versionId: 'v_x', createdAt: 1, tags: [], ...(input as object) })) }
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
import { AssetVersionService } from '@/services/assets/AssetVersionService';

const RESULTS = [
    { platformId: 'spotify_cover', url: 'data:image/png;base64,AAA', width: 3000, height: 3000, bytes: 1234, fit: 'cover' },
    { platformId: 'ig_story', url: 'data:image/png;base64,BBB', width: 1080, height: 1920, bytes: 2345, fit: 'contain-blur-pad' }
];

// Structural-only routing and failure guards. The existing service doubles cannot
// prove durable storage; positive save/version/download proof requires the genuine UI.
describe('export_platform_assets tool (structural only)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        exportMasterAsset.mockResolvedValue(RESULTS);
    });

    it('plans the default matrix but reports unavailable storage honestly', async () => {
        const res = await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string }) => Promise<{ success: boolean; data: { savedAssets: unknown[]; gallerySaved: boolean }; message: string }>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD' });

        expect(res.success).toBe(false);
        expect(exportMasterAsset).toHaveBeenCalledWith({
            masterUrl: 'data:image/png;base64,QUJD',
            presets: expect.arrayContaining([
                expect.objectContaining({ dimensionId: 'spotify_cover' }),
                expect.objectContaining({ dimensionId: 'facebook_og' })
            ])
        });
        expect(res.data.savedAssets).toEqual([]);
        expect(res.data.gallerySaved).toBe(false);
        expect(res.message).toContain('could not be saved');
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

    it('does not publish volatile exports to history or download by default when storage is unavailable', async () => {
        const res = await MediaTools.export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD' });
        expect(res.success).toBe(false);
        expect(res.status).toBe('PARTIAL');
        expect(res.metadata?.errorCode).toBe('EXPORT_PERSISTENCE_FAILED');
        expect(useStore.getState().addToHistory).not.toHaveBeenCalled();
        expect(downloadAsZip).not.toHaveBeenCalled();
    });

    it('can skip the zip bundle when download is false', async () => {
        await (MediaTools as unknown as {
            export_platform_assets: (args: { masterUrl: string; download: boolean }) => Promise<unknown>;
        }).export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD', download: false });
        expect(downloadAsZip).not.toHaveBeenCalled();
    });

    it('does not record a version with a volatile data URL when original persistence failed', async () => {
        const res = await MediaTools.export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD', download: false });
        expect(res.success).toBe(false);
        expect(AssetVersionService.recordVersion).not.toHaveBeenCalled();
        expect(useStore.getState().addToHistory).not.toHaveBeenCalled();
    });

    it('does not hide failed persistence behind an explicitly requested ZIP', async () => {
        const res = await MediaTools.export_platform_assets({ masterUrl: 'data:image/png;base64,QUJD', download: true });
        expect(res.success).toBe(false);
        expect(res.status).toBe('PARTIAL');
        expect(downloadAsZip).not.toHaveBeenCalled();
        expect(AssetVersionService.recordVersion).not.toHaveBeenCalled();
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
