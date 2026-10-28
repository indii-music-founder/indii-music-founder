import { describe, expect, it } from 'vitest';
import { boardroomConversationIsReadOnly, parseBoardroomIntentDecision } from './boardroomIntentPolicy';

// Pure routing policy; no fabricated classifier, account, provider or customer session.
describe('Conductor conversation continuity and execution authority', () => {
    it.each([null, 'discussion', 'capability'] as const)('keeps %s in read-only conversation instead of refusing to talk', intent => {
        expect(boardroomConversationIsReadOnly(intent)).toBe(true);
    });
    it('permits the execution path only after an action decision', () => {
        expect(boardroomConversationIsReadOnly(parseBoardroomIntentDecision({ choice: 'action', confidence: 0.8 }, 0.8))).toBe(false);
    });
    it.each([undefined, null, {}, { choice: 'action' }, { choice: 'action', confidence: NaN },
        { choice: 'action', confidence: Infinity }, { choice: 'action', confidence: -1 },
        { choice: 'action', confidence: 1.01 }, { choice: 'action', confidence: '0.99' },
        { choice: 'action', confidence: 0.79 }, { choice: 'execute', confidence: 1 }])('invalid or uncertain decision cannot authorize work: %j', value => {
        const intent = parseBoardroomIntentDecision(value, 0.8);
        expect(intent).toBeNull();
        expect(boardroomConversationIsReadOnly(intent)).toBe(true);
    });
    it.each(['discussion', 'capability', 'action'] as const)('preserves a valid %s decision', choice => {
        expect(parseBoardroomIntentDecision({ choice, confidence: 1 }, 0.8)).toBe(choice);
    });
});
