import { describe, expect, it } from 'vitest';
import { buildLiveMomentNote } from '../useRemoteCommandListener';

describe('buildLiveMomentNote', () => {
    it('trims the captured text and derives a team-ready title from the first line', () => {
        const note = buildLiveMomentNote('  First line for the team\nSecond line stays in the body  ');

        expect(note).toEqual({
            title: 'First line for the team',
            content: 'First line for the team\nSecond line stays in the body',
            attachments: [],
            tags: ['live-moment', 'mobile-remote'],
        });
    });

    it('truncates an overlong first line for the note title', () => {
        const note = buildLiveMomentNote('A'.repeat(80));

        expect(note.title).toBe(`${'A'.repeat(53)}...`);
        expect(note.content).toBe('A'.repeat(80));
    });
});
