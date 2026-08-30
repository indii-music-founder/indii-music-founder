import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnifiedAssetLibrary from './UnifiedAssetLibrary';
import { writeCreativeAssetDrag, CREATIVE_ASSET_MIME } from '@/services/creative/CreativeAssetDragService';
import type { HistoryItem } from '@/core/types/history';

// A minimal DataTransfer stand-in for jsdom (no real clipboard backend).
class FakeDataTransfer {
    files: File[] = [];
    effectAllowed = 'copy' as const;
    private store = new Map<string, string>();
    setData(type: string, value: string) { this.store.set(type, value); }
    getData(type: string) { return this.store.get(type) ?? ''; }
}

const IMAGE: HistoryItem = {
    id: 'gen_1', type: 'image', url: 'https://firebasestorage.googleapis.com/v0/b/b/o/cover.jpg?alt=media&token=x',
    prompt: 'Neon album cover', timestamp: 1, projectId: 'p1', origin: 'generated'
};

describe('UnifiedAssetLibrary internal asset drop (creative handoff)', () => {
    it('adds a dropped creative image asset to the active collection (no download round-trip)', () => {
        const onUpdateBrandAssets = vi.fn();
        render(
            <UnifiedAssetLibrary
                userId="u1"
                brandAssets={[]}
                referenceImages={[]}
                onUpdateBrandAssets={onUpdateBrandAssets}
                onUpdateReferenceImages={vi.fn()}
            />
        );

        const dt = new FakeDataTransfer();
        writeCreativeAssetDrag(dt as unknown as DataTransfer, IMAGE, 'project-assets');
        expect(dt.getData(CREATIVE_ASSET_MIME)).toBeTruthy();

        fireEvent.drop(screen.getByTestId('marketing-asset-dropzone'), { dataTransfer: dt });

        expect(onUpdateBrandAssets).toHaveBeenCalledWith([expect.objectContaining({
            id: 'gen_1',
            url: IMAGE.url,
            description: 'Neon album cover',
            category: 'other',
            tags: ['creative-import']
        })]);
    });

    it('deduplicates an already-present asset id', () => {
        const onUpdateBrandAssets = vi.fn();
        const existing = [{ id: 'gen_1', url: IMAGE.url, description: 'already', category: 'other' as const, tags: [] }];
        render(
            <UnifiedAssetLibrary
                userId="u1"
                brandAssets={existing}
                referenceImages={[]}
                onUpdateBrandAssets={onUpdateBrandAssets}
                onUpdateReferenceImages={vi.fn()}
            />
        );

        const dt = new FakeDataTransfer();
        writeCreativeAssetDrag(dt as unknown as DataTransfer, IMAGE, 'project-assets');
        fireEvent.drop(screen.getByTestId('marketing-asset-dropzone'), { dataTransfer: dt });

        expect(onUpdateBrandAssets).not.toHaveBeenCalled();
    });

    it('ignores non-visual asset types rather than mis-filing them', () => {
        const onUpdateBrandAssets = vi.fn();
        render(
            <UnifiedAssetLibrary
                userId="u1"
                brandAssets={[]}
                referenceImages={[]}
                onUpdateBrandAssets={onUpdateBrandAssets}
                onUpdateReferenceImages={vi.fn()}
            />
        );

        const dt = new FakeDataTransfer();
        writeCreativeAssetDrag(dt as unknown as DataTransfer, { ...IMAGE, id: 'song_1', type: 'music' as const, url: 'https://x/audio.mp3', prompt: 'track' }, 'project-assets');
        fireEvent.drop(screen.getByTestId('marketing-asset-dropzone'), { dataTransfer: dt });

        expect(onUpdateBrandAssets).not.toHaveBeenCalled();
    });
});
