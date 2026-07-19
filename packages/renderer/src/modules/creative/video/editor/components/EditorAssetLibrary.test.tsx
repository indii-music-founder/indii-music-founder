import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EditorAssetLibrary } from './EditorAssetLibrary';

// ISSUE-923 regression: the asset library must include uploaded images and
// uploaded audio (canonical type 'music'), not just generated history.

const makeItem = (id: string, type: string, prompt: string) => ({
    id,
    type,
    url: `https://example.com/${id}`,
    prompt,
    timestamp: Date.now(),
    projectId: 'p1',
});

vi.mock('@/hooks/useResolvedStorageUrl', () => ({
    useResolvedStorageUrl: (url: string | null) => ({ url, loading: false }),
}));

vi.mock('react-virtuoso', () => ({
    // Render all items inline so assertions can see them
    Virtuoso: ({ data, itemContent }: { data: unknown[]; itemContent: (i: number, item: unknown) => React.ReactNode }) => (
        <div>{data.map((item, i) => <div key={i}>{itemContent(i, item)}</div>)}</div>
    ),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: Record<string, unknown>) => unknown) => selector({
        generatedHistory: [
            makeItem('gen-1', 'image', 'Generated art'),
            makeItem('gen-2', 'text', 'A caption'), // unsupported type, excluded
        ],
        uploadedImages: [makeItem('up-img-1', 'image', 'Uploaded artwork')],
        uploadedAudio: [makeItem('up-aud-1', 'music', 'My song stem')],
    }),
}));

describe('EditorAssetLibrary (ISSUE-923)', () => {
    it('includes generated history, uploaded images, and uploaded music', () => {
        render(<EditorAssetLibrary onDragStart={vi.fn()} />);
        expect(screen.getByText('Generated art')).toBeInTheDocument();
        expect(screen.getByText('Uploaded artwork')).toBeInTheDocument();
        expect(screen.getByText('My song stem')).toBeInTheDocument();
    });

    it('excludes unsupported types', () => {
        render(<EditorAssetLibrary onDragStart={vi.fn()} />);
        expect(screen.queryByText('A caption')).not.toBeInTheDocument();
    });
});
