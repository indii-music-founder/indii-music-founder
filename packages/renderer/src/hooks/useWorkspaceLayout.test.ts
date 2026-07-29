import { describe, expect, it } from 'vitest';
import { getWorkspaceMode } from './useWorkspaceLayout';

describe('getWorkspaceMode', () => {
    it.each([
        [959, 'focused'],
        [960, 'standard'],
        [1359, 'standard'],
        [1360, 'wide'],
    ] as const)('uses the module container width at %ipx', (width, expected) => {
        expect(getWorkspaceMode(width)).toBe(expected);
    });

    // ISSUE-1267: 840px is what a room actually gets on a 1920px screen with the
    // sidebar open and the chat panel at its 800px max. It must resolve to
    // `focused` so the rails become drawers instead of crushing the centre column.
    it('treats the real 1920px-with-chat-panel workspace as focused', () => {
        expect(getWorkspaceMode(840)).toBe('focused');
    });
});
