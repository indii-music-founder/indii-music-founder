import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateImages = vi.fn();
const recordVersion = vi.fn();

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: (...a: unknown[]) => generateImages(...a) }
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateImage: vi.fn(async () => 'https://cdn.test/legacy.png') }
}));

vi.mock('@/services/assets/AssetVersionService', () => ({
    AssetVersionService: { recordVersion: (...a: unknown[]) => recordVersion(...a) }
}));

vi.mock('@/core/store', () => {
    const mockStore = { addToHistory: vi.fn(), currentProjectId: 'proj_1' };
    return { useStore: { getState: () => mockStore } };
});

import { CommerceTools } from '../CommerceTools';
import { useStore } from '@/core/store';
import { ARTWORK_FIDELITY_CLAUSE } from '@/services/mockup/MockupService';

const tool = (CommerceTools as unknown as {
    mockup_merchandise: (args: { productType: string; designIdea: string; artworkUrl?: string }) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>;
}).mockup_merchandise;

describe('mockup_merchandise with artwork (F1.3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateImages.mockResolvedValue([{ id: 'img1', url: 'https://cdn.test/mockup.png' }]);
    });

    it('routes artwork requests through MockupService: fidelity clause + sourceImages + no prose re-description', async () => {
        const res = await tool({ productType: 'vinyl', designIdea: 'ignored when artwork present', artworkUrl: 'data:image/png;base64,QUJD' });

        expect(res.success).toBe(true);
        expect(res.data.kind).toBe('vinyl-12');
        expect(res.data.artworkFidelity).toContain('sourceImages reference');

        const call = generateImages.mock.calls[0]![0] as { prompt: string; sourceImages: Array<{ mimeType: string; data: string }> };
        expect(call.prompt).toContain(ARTWORK_FIDELITY_CLAUSE);
        expect(call.sourceImages).toEqual([{ mimeType: 'image/png', data: 'QUJD' }]);
        expect(res.data.readyForPOD).toBe(false);
    });

    it('records a mockup history item + H1 version (producer hook)', async () => {
        await tool({ productType: 't-shirt', designIdea: 'x', artworkUrl: 'data:image/png;base64,QUJD' });

        const { addToHistory } = useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> };
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            meta: expect.stringContaining('mockup'),
            tags: ['mockup', 'tee']
        }));
        expect(recordVersion).toHaveBeenCalledWith(expect.objectContaining({
            source: 'mockup',
            parentVersionId: null
        }));
    });

    it('falls back to the legacy text-described preview without artworkUrl', async () => {
        const res = await tool({ productType: 't-shirt', designIdea: 'skull with roses' });
        expect(res.success).toBe(true);
        expect(res.data.designPromptUsed).toContain('skull with roses');
        expect(generateImages).not.toHaveBeenCalled(); // legacy path uses AutonomousIntelligence
        expect(recordVersion).not.toHaveBeenCalled();
    });

    it('surfaces generation failures as tool errors', async () => {
        generateImages.mockRejectedValue(new Error('quota exceeded'));
        const res = await tool({ productType: 'poster', designIdea: 'x', artworkUrl: 'data:image/png;base64,QUJD' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('quota exceeded');
    });
});
