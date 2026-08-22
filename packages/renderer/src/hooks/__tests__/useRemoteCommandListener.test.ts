import { describe, expect, it } from 'vitest';
import { buildLiveMomentNote, isLocalP2PCommand, isValidCoordinate, shouldProcessStudioCommand, shouldReportQueuedChatToRemote } from '../useRemoteCommandListener';

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

describe('isValidCoordinate (ISSUE-988)', () => {
    it('accepts valid zero coordinates (equator / prime meridian) that a truthiness check would reject', () => {
        expect(isValidCoordinate(0, 0)).toBe(true);
        expect(isValidCoordinate(0, -83.045)).toBe(true);
        expect(isValidCoordinate(42.3314, 0)).toBe(true);
    });

    it('accepts boundary coordinates', () => {
        expect(isValidCoordinate(90, 180)).toBe(true);
        expect(isValidCoordinate(-90, -180)).toBe(true);
    });

    it('rejects out-of-range coordinates', () => {
        expect(isValidCoordinate(90.1, 0)).toBe(false);
        expect(isValidCoordinate(0, 180.1)).toBe(false);
        expect(isValidCoordinate(-91, 0)).toBe(false);
        expect(isValidCoordinate(0, -181)).toBe(false);
    });

    it('rejects NaN, non-finite, and non-numeric values', () => {
        expect(isValidCoordinate(NaN, 0)).toBe(false);
        expect(isValidCoordinate(0, Infinity)).toBe(false);
        expect(isValidCoordinate(undefined, 0)).toBe(false);
        expect(isValidCoordinate('42', 0)).toBe(false);
    });
});

describe('shouldProcessStudioCommand (ISSUE-1025)', () => {
    it('does not let the Studio listener claim cloud-owned Boardroom chat', () => {
        expect(shouldProcessStudioCommand({ text: 'Hi', executionTarget: 'cloud' })).toBe(false);
    });

    it('only accepts explicitly Studio-owned work', () => {
        expect(shouldProcessStudioCommand({ text: 'Hi', executionTarget: 'studio' })).toBe(true);
        expect(shouldProcessStudioCommand({ text: '[GENERATE_IMAGE] artwork' })).toBe(true);
    });
});

describe('isLocalP2PCommand (ISSUE-1025)', () => {
    it('keeps synthetic WebSocket commands out of the Firestore claim/completion path', () => {
        expect(isLocalP2PCommand('p2p-remote-123')).toBe(true);
        expect(isLocalP2PCommand('firestore-command-123')).toBe(false);
    });
});

describe('shouldReportQueuedChatToRemote (desktop-busy honesty)', () => {
    it('reports queued when sendMessage returned without a new response and the desktop is still busy', () => {
        // The exact false-"Done." scenario: the request was queued behind an
        // active desktop run — that state must reach the phone, not a fake
        // completion.
        expect(shouldReportQueuedChatToRemote(false, true)).toBe(true);
    });

    it('does not report queued when a fresh agent response exists', () => {
        expect(shouldReportQueuedChatToRemote(true, true)).toBe(false);
    });

    it('does not report queued when the desktop settled before sendMessage returned', () => {
        expect(shouldReportQueuedChatToRemote(false, false)).toBe(false);
    });
});
