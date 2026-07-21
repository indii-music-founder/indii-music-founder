/**
 * CE-4, ISSUE-1113: remote dispatch of computer_task via the existing dispatch queue.
 * Covers the two pure guard/builder functions extracted from the switch-case branch —
 * the branch itself (lease acquisition, agentService.sendMessage routing) is exercised
 * the same way sibling dispatch types are: not unit-tested directly, matching this file's
 * existing coverage convention (only extracted pure logic gets dedicated tests).
 */
import { describe, it, expect } from 'vitest';
import { validateComputerTaskDispatch, buildComputerTaskInstruction } from './useRemoteCommandListener';

describe('validateComputerTaskDispatch', () => {
    it('rejects when the desktop Computer API is unavailable', () => {
        const error = validateComputerTaskDispatch({ payload: { goal: 'open Safari' } }, false);
        expect(error).toMatch(/indii desktop app/);
    });

    it('rejects a missing goal even when the Computer API is available', () => {
        const error = validateComputerTaskDispatch({ payload: {} }, true);
        expect(error).toMatch(/missing a goal/);
    });

    it('rejects a whitespace-only goal', () => {
        const error = validateComputerTaskDispatch({ payload: { goal: '   ' } }, true);
        expect(error).toMatch(/missing a goal/);
    });

    it('passes when the Computer API is available and a goal is present', () => {
        const error = validateComputerTaskDispatch({ payload: { goal: 'open Safari' } }, true);
        expect(error).toBeNull();
    });

    it('checks the Computer API guard before the goal guard', () => {
        // Both conditions fail — the desktop-app message should win since it's checked first.
        const error = validateComputerTaskDispatch({ payload: {} }, false);
        expect(error).toMatch(/indii desktop app/);
    });
});

describe('buildComputerTaskInstruction', () => {
    it('builds a plain instruction from the goal alone', () => {
        const text = buildComputerTaskInstruction({ payload: { goal: 'open Safari and check email' } });
        expect(text).toContain('computer_drive');
        expect(text).toContain('open Safari and check email');
        expect(text).not.toContain('Constraints:');
    });

    it('appends constraints when present', () => {
        const text = buildComputerTaskInstruction({ payload: { goal: 'open Safari', constraints: 'never enter any password' } });
        expect(text).toContain('open Safari');
        expect(text).toContain('Constraints: never enter any password');
    });
});
