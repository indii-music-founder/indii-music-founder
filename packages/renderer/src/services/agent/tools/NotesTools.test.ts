import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotesTools } from './NotesTools';
import { SUPERPOWER_TOOLS } from '../definitions/SuperpowerTools';
import { useStore } from '@/core/store';

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

const baseNote = (over: Partial<{ id: string; title: string; content: string; tags: string[]; createdAt: number }> = {}) => ({
    id: 'note-1',
    title: 'Tour ideas',
    content: 'Book the Detroit venue first',
    attachments: [],
    tags: ['touring'],
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
});

describe('NotesTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('save_note', () => {
        it('saves through the store and reports the real note id', async () => {
            vi.mocked(useStore.getState).mockReturnValue({
                addNote: vi.fn().mockReturnValue('note-42'),
            } as any);

            const result = await NotesTools.save_note({ title: 'Set list', content: 'Open with the single' });

            expect(result.success).toBe(true);
            expect(result.data).toMatchObject({ id: 'note-42', title: 'Set list' });
        });

        it('still succeeds without a title by using the default', async () => {
            const addNote = vi.fn().mockReturnValue('note-7');
            vi.mocked(useStore.getState).mockReturnValue({ addNote } as any);

            const result = await NotesTools.save_note({ content: 'Remember the mixer settings' });

            expect(result.success).toBe(true);
            expect(addNote).toHaveBeenCalledWith(expect.objectContaining({ content: 'Remember the mixer settings' }));
        });
    });

    describe('list_notes', () => {
        it('returns the most recent notes with snippets only', async () => {
            vi.mocked(useStore.getState).mockReturnValue({
                notes: [baseNote(), baseNote({ id: 'note-0', title: 'Older', createdAt: 500 })],
            } as any);

            const result = await NotesTools.list_notes({ limit: 1 });

            expect(result.success).toBe(true);
            expect(result.data.returned).toBe(1);
            expect(result.data.notes[0]).toEqual(expect.objectContaining({
                id: 'note-1',
                snippet: 'Book the Detroit venue first',
            }));
            // Full bodies are never exposed through the read tool.
            expect(result.data.notes[0].content).toBeUndefined();
        });

        it('filters by query across title, body, and tags', async () => {
            vi.mocked(useStore.getState).mockReturnValue({
                notes: [
                    baseNote(),
                    baseNote({ id: 'n2', title: 'Receipts', content: 'Studio deposit', tags: ['finance'] }),
                    baseNote({ id: 'n3', title: 'Random', content: 'Nothing to see here' }),
                ],
            } as any);

            const byTag = await NotesTools.list_notes({ query: 'finance' });
            expect(byTag.data.notes.map((n: { id: string }) => n.id)).toEqual(['n2']);

            const byBody = await NotesTools.list_notes({ query: 'detroit venue' });
            expect(byBody.data.notes.map((n: { id: string }) => n.id)).toEqual(['note-1']);

            const none = await NotesTools.list_notes({ query: 'zzz' });
            expect(none.data.matched).toBe(0);
            expect(none.message).toContain('No notes');
        });
    });
});

describe('notes tools in the agent tool pool (phone chat reachability)', () => {
    it('declares save_note, save_media_note, and list_notes so every agent can reach the Notes module', () => {
        const names = SUPERPOWER_TOOLS.map(t => t.name);
        expect(names).toContain('save_note');
        expect(names).toContain('save_media_note');
        expect(names).toContain('list_notes');
    });

    it('marks content as required for save_note so the model cannot call it empty', () => {
        const decl = SUPERPOWER_TOOLS.find(t => t.name === 'save_note');
        expect(decl?.parameters?.required).toContain('content');
    });
});
