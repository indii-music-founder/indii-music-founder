import { describe, expect, it } from 'vitest';
import { canApproveCwrExport } from './cwrLifecycle.js';

describe('exact CWR export approval boundary', () => {
  it('allows first approval and an idempotent repeat before transmission', () => {
    expect(canApproveCwrExport('exported')).toBe(true);
    expect(canApproveCwrExport('approved_export')).toBe(true);
  });
  it('cannot use approval to reset a claimed, sent or uncertain external delivery', () => {
    for (const state of ['delivery_claimed', 'transmitted', 'delivery_outcome_unknown', 'registered', 'assembling', undefined, 'unrecognized']) expect(canApproveCwrExport(state)).toBe(false);
  });
});
