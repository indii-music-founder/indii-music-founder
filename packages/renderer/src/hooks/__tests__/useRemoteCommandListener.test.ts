import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildLiveMomentNote, collectRemoteAgentResponses, isLocalP2PCommand, isValidCoordinate, MAX_REMOTE_AGENT_RESPONSES, shouldProcessStudioCommand, shouldReportQueuedChatToRemote } from '../useRemoteCommandListener';
import { resolveRemoteConversationMode } from '@/services/agent/AgentService';
import { useStore } from '@/core/store';

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

describe('resolveRemoteConversationMode (Controller mode targeting)', () => {
    it('accepts the three concrete T1 modes the Controller can select', () => {
        expect(resolveRemoteConversationMode('boardroom')).toBe('boardroom');
        expect(resolveRemoteConversationMode('department')).toBe('department');
        expect(resolveRemoteConversationMode('direct')).toBe('direct');
    });

    it('rejects everything else so a malformed relay payload cannot pick an execution path', () => {
        expect(resolveRemoteConversationMode('orchestrated')).toBeUndefined();
        expect(resolveRemoteConversationMode('admin')).toBeUndefined();
        expect(resolveRemoteConversationMode(42)).toBeUndefined();
        expect(resolveRemoteConversationMode(undefined)).toBeUndefined();
    });
});

describe('collectRemoteAgentResponses (full boardroom relay)', () => {
    const START = 10_000;
    const msg = (over: Partial<{ id: string; role: string; text: string; timestamp: number; isStreaming: boolean; agentId: string }>) => ({
        id: 'm', role: 'model', text: 'reply', timestamp: START, isStreaming: false, agentId: 'generalist', ...over,
    }) as any;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns every final agent message of the run in chronological order — not only the last speaker', () => {
        vi.spyOn(useStore, 'getState').mockReturnValue({
            agentHistory: [
                msg({ id: 'conductor', timestamp: START + 100, agentId: 'generalist' }),
                msg({ id: 'finance', timestamp: START + 300, agentId: 'finance' }),
                msg({ id: 'legal', timestamp: START + 200, agentId: 'legal' }),
            ],
        } as any);

        const collected = collectRemoteAgentResponses(START);
        expect(collected.map(m => m.id)).toEqual(['conductor', 'legal', 'finance']);
    });

    it('filters streaming placeholders, empty texts, and pre-run messages', () => {
        vi.spyOn(useStore, 'getState').mockReturnValue({
            agentHistory: [
                msg({ id: 'placeholder', text: '*(Reviewing request...)*', isStreaming: true }),
                msg({ id: 'blank', text: '   ' }),
                msg({ id: 'before-run', timestamp: START - 1 }),
                msg({ id: 'user-voice', role: 'user' }),
                msg({ id: 'real' }),
            ],
        } as any);

        expect(collectRemoteAgentResponses(START).map(m => m.id)).toEqual(['real']);
    });

    it('caps relayed responses so a large seated boardroom cannot fan out unbounded writes', () => {
        expect(MAX_REMOTE_AGENT_RESPONSES).toBeGreaterThan(0);
        expect(MAX_REMOTE_AGENT_RESPONSES).toBeLessThanOrEqual(25);
    });
});
