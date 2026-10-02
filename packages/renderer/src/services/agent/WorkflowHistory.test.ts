import { describe, expect, it } from 'vitest';
import { getWorkflowHistorySummary, parseWorkflowHistoryRecord } from './WorkflowHistory';

// Literal schema inputs for pure boundary/presentation checks; no customer path is simulated.
const input = {
    id: 'record', userId: 'owner', sessionId: 'project', workflowId: 'DRAFT', status: 'PLANNED',
    createdAt: 1, updatedAt: 2,
    steps: { draft: { stepId: 'draft', agentId: 'writer', status: 'PLANNED', idempotencyKey: 'key' } },
};
const parse = (value: unknown = input) => parseWorkflowHistoryRecord('owner', 'project', 'record', value);

describe('workflow history boundaries (structural)', () => {
    it('rejects owner, project, and document mismatches', () => {
        for (const override of [{ userId: 'other' }, { sessionId: 'other' }, { id: 'other' }]) {
            expect(() => parse({ ...input, ...override })).toThrow();
        }
    });
    it('rejects unknown states instead of treating them as completion', () => {
        expect(() => parse({ ...input, status: 'UNKNOWN' })).toThrow();
    });
    it('shows queued work as unfinished and cancellable', () => {
        expect(getWorkflowHistorySummary(parse())).toMatchObject({ finished: 0, total: 1, canCancel: true, canResume: false });
    });
    it('requires terminal step evidence when server status is completed', () => {
        expect(getWorkflowHistorySummary(parse({ ...input, status: 'COMPLETED' })).completionEvidenceConsistent).toBe(false);
        const completed = parse({ ...input, status: 'COMPLETED', steps: { draft: { ...input.steps.draft, status: 'STEP_COMPLETE', result: 'Review this draft.' } } });
        expect(getWorkflowHistorySummary(completed)).toMatchObject({ finished: 1, completionEvidenceConsistent: true, canCancel: false, canResume: false });
    });
    it('permits retry only when both execution and step failed', () => {
        expect(getWorkflowHistorySummary(parse({ ...input, status: 'FAILED' })).canResume).toBe(false);
        const failed = parse({ ...input, status: 'FAILED', steps: { draft: { ...input.steps.draft, status: 'FAILED', error: 'Unavailable' } } });
        expect(getWorkflowHistorySummary(failed)).toMatchObject({ canResume: true, canCancel: false });
    });
    it('counts skipped steps separately from claiming saved output', () => {
        const skipped = parse({ ...input, status: 'COMPLETED', steps: { draft: { ...input.steps.draft, status: 'SKIPPED' } } });
        expect(getWorkflowHistorySummary(skipped).completionEvidenceConsistent).toBe(true);
        expect(skipped.steps.draft?.result).toBeUndefined();
    });
});
