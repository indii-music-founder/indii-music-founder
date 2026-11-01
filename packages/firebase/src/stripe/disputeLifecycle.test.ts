import { describe, expect, it } from 'vitest';
import { shouldAdvanceDisputeSummary } from './disputeLifecycle';

describe('dispute finance-summary ordering', () => {
  it('accepts newer state and preserves a closed dispute against late updates', () => {
    expect(shouldAdvanceDisputeSummary(undefined, { created: 100, type: 'charge.dispute.created', status: 'needs_response' })).toBe(true);
    expect(shouldAdvanceDisputeSummary({ lastEventCreated: 100, lastEventType: 'charge.dispute.created', status: 'needs_response' }, { created: 101, type: 'charge.dispute.updated', status: 'under_review' })).toBe(true);
    expect(shouldAdvanceDisputeSummary({ lastEventCreated: 105, lastEventType: 'charge.dispute.closed', status: 'won' }, { created: 104, type: 'charge.dispute.updated', status: 'under_review' })).toBe(false);
    expect(shouldAdvanceDisputeSummary({ lastEventCreated: 105, lastEventType: 'charge.dispute.closed', status: 'won' }, { created: 106, type: 'charge.dispute.updated', status: 'under_review' })).toBe(false);
    expect(shouldAdvanceDisputeSummary({ lastEventCreated: 106, lastEventType: 'charge.dispute.updated', status: 'under_review' }, { created: 105, type: 'charge.dispute.closed', status: 'won' })).toBe(true);
  });

  it('prioritizes closure within a Stripe event second', () => {
    const prior = { lastEventCreated: 105, lastEventType: 'charge.dispute.updated', status: 'under_review' };
    expect(shouldAdvanceDisputeSummary(prior, { created: 105, type: 'charge.dispute.closed', status: 'lost' })).toBe(true);
    expect(shouldAdvanceDisputeSummary({ lastEventCreated: 105, lastEventType: 'charge.dispute.closed', status: 'lost' }, { created: 105, type: 'charge.dispute.created', status: 'needs_response' })).toBe(false);
  });

  it('rejects missing event ordering data', () => {
    expect(() => shouldAdvanceDisputeSummary(undefined, { created: 0, type: 'charge.dispute.created', status: 'needs_response' })).toThrow('event time');
  });
});
