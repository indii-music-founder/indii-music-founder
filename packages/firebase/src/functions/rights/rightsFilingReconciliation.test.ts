import { describe, expect, it } from 'vitest';
import { canReopenUncertainFiling } from './rightsFilingReconciliation';

const identity = { uid: 'artist-1', caseId: 'case-1', manifestHash: 'hash-1' };
const filing = { ownerUid: identity.uid, caseId: identity.caseId, manifestHash: identity.manifestHash, state: 'outcome_unknown', evidenceSource: 'none' };

describe('uncertain rights filing reconciliation', () => {
  it('allows only the exact owned preparation after browser capacity is released', () => {
    expect(canReopenUncertainFiling(filing, {}, identity)).toBe(true);
    expect(canReopenUncertainFiling(filing, { session: { uid: identity.uid } }, identity)).toBe(false);
    expect(canReopenUncertainFiling({ ...filing, manifestHash: 'older' }, {}, identity)).toBe(false);
    expect(canReopenUncertainFiling({ ...filing, ownerUid: 'other' }, {}, identity)).toBe(false);
  });

  it('preserves filings with a reported receipt or a terminal official outcome', () => {
    expect(canReopenUncertainFiling({ ...filing, evidenceSource: 'user_report' }, {}, identity)).toBe(false);
    expect(canReopenUncertainFiling({ ...filing, state: 'submitted' }, {}, identity)).toBe(false);
  });
});
