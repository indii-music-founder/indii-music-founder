import { describe, expect, it } from 'vitest';

import { SetlistDraftInputSchema } from './SetlistDraftService';

const validDraft = {
    userId: 'user-1',
    venue: 'Test Venue',
    date: '2028-02-29',
    city: '',
    attendance: 0,
    songs: [{ id: 'track-1', title: 'Song One', originalArtist: '', type: 'other' as const }],
    category: 'unclassified' as const,
};

describe('SetlistDraftInputSchema', () => {
    it('accepts a real calendar date, including a leap day', () => {
        expect(SetlistDraftInputSchema.safeParse(validDraft).success).toBe(true);
    });

    it('rejects impossible calendar dates before a Firestore write', () => {
        expect(SetlistDraftInputSchema.safeParse({ ...validDraft, date: '2027-02-29' }).success).toBe(false);
        expect(SetlistDraftInputSchema.safeParse({ ...validDraft, date: '2027-13-01' }).success).toBe(false);
        expect(SetlistDraftInputSchema.safeParse({ ...validDraft, date: '2027-04-31' }).success).toBe(false);
    });
});
