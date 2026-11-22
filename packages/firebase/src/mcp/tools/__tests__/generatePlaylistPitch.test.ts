import { describe, expect, it, vi } from 'vitest';

// Module-load isolation only: extractGrounding is pure and never touches these.
vi.mock('firebase-admin');
vi.mock('../../../lib/vertexClient.js', () => ({ getVertexAIClient: vi.fn() }));

import { extractGrounding } from '../generatePlaylistPitch.js';

describe('generate_playlist_pitch grounding (ISSUE-1692)', () => {
    it('grounds a Distribution/Publishing record from its nested metadata map', () => {
        const grounding = extractGrounding({
            userId: 'u1',
            status: 'ready_for_desktop_delivery',
            metadata: {
                releaseTitle: 'Assembly Line Halo',
                trackTitle: 'Assembly Line Halo (Radio Edit)',
                artistName: 'Signal Bloom',
                genre: 'Electronic',
                mood: ['Hypnotic', ' ', 'Driving'],
                labelName: 'Indii Records',
                releaseDate: '2026-12-05',
                isrc: 'not groundable',
            },
        });

        expect(grounding.fields).toEqual({
            title: 'Assembly Line Halo',
            artistName: 'Signal Bloom',
            genre: 'Electronic',
            mood: 'Hypnotic, Driving',
            label: 'Indii Records',
            releaseDate: '2026-12-05',
        });
        expect(grounding.trackTitles).toEqual(['Assembly Line Halo (Radio Edit)']);
    });

    it('keeps top-level values over nested metadata and keeps real track lists', () => {
        const grounding = extractGrounding({
            title: 'Top Title',
            genre: 'Techno',
            tracks: [{ title: 'Track A' }, { title: '' }, { title: 'Track B' }],
            metadata: { releaseTitle: 'Nested Title', genre: 'Electronic', trackTitle: 'Nested Track', artistName: 'Nested Artist' },
        });

        expect(grounding.fields).toEqual({ title: 'Top Title', genre: 'Techno', artistName: 'Nested Artist' });
        expect(grounding.trackTitles).toEqual(['Track A', 'Track B']);
    });

    it('finds nothing to ground on a record that only names its owner and status', () => {
        const grounding = extractGrounding({ userId: 'u1', status: 'cover_art_audit_pending', metadata: 'not a map' });

        expect(grounding.fields).toEqual({});
        expect(grounding.trackTitles).toEqual([]);
        expect(grounding.analysis).toEqual({});
    });
});
