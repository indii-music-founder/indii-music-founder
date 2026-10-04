import { describe, expect, it } from 'vitest';
import { createObservedIssueNode, mergeIssueObservation } from './executionGraphStore';

const issue = 'https://github.com/indii-music-founder/indii-music-founder/issues/356';

// Pure operational identity checks only; no customer journey, service response or authentication is simulated.
describe('GitHub execution graph observation identity', () => {
  it('anchors identity to the issue rather than the wording or reporting surface', () => {
    const first = createObservedIssueNode(issue, 'report-a', 1);
    const second = createObservedIssueNode(issue, 'report-b', 2);
    expect(second.id).toBe(first.id);
    expect(first.source).toEqual({ system: 'github', key: issue });
    const merged = mergeIssueObservation(first, second);
    expect(merged.provenance.map(p => p.sourceId)).toEqual(['bug_reports/report-a', 'bug_reports/report-b']);
    expect(merged.status).toBe('observed');
    expect(merged.terminalOutcome).toBeNull();
  });
  it('makes repeated reports a no-op without resetting progress', () => {
    const observation = createObservedIssueNode(issue, 'report-a', 1);
    const executing = { ...observation, status: 'executing' as const, attempts: 2, executor: 'existing-executor' };
    expect(mergeIssueObservation(executing, observation)).toBe(executing);
  });
  it('refuses wrong repositories, nonissue paths and ambiguous query aliases', () => {
    for (const url of ['https://github.com/other/repo/issues/356', issue.replace('/issues/', '/pull/'), `${issue}?token=x`, `${issue}#comment`]) {
      expect(() => createObservedIssueNode(url, 'report-a', 1)).toThrow('canonical repository issue');
    }
  });
  it('never conflates different issues or silently drops provenance at capacity', () => {
    const observation = createObservedIssueNode(issue, 'report-a', 1);
    expect(() => mergeIssueObservation(observation, createObservedIssueNode(issue.replace('356', '357'), 'report-b', 2))).toThrow('identity mismatch');
    const full = { ...observation, provenance: Array.from({ length: 200 }, (_, i) => ({ sourceId: `report-${i}`, observedAt: 1 })) };
    expect(() => mergeIssueObservation(full, createObservedIssueNode(issue, 'new-report', 2))).toThrow('capacity');
  });
});
