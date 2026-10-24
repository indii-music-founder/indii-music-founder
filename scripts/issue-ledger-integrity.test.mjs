import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateIssueLedger } from './issue-ledger-integrity.mjs';

const finding = (id, title, status = '🔴 OPEN', extra = '') =>
  `### ISSUE-${id}: ${title}\n\n- **Status:** ${status}\n${extra}\n`;

test('preserves historical duplicate IDs without allowing another duplicate', () => {
  const base = finding(1122, 'Original') + finding(1122, 'Historical continuation');
  assert.deepEqual(validateIssueLedger(base, base + finding(1122, 'Original')), [
    'ISSUE-1122: duplicate finding added (Original).',
  ]);
  assert.deepEqual(validateIssueLedger(base, base + finding(2000, 'New finding')), []);
});

test('rejects deletion and identifier reuse across ledger revisions', () => {
  const base = finding(1512, 'Lost jobs') + finding(1513, 'Statement identity');
  const next = finding(1512, 'Unrelated UI issue') + finding(1513, 'Statement identity');
  assert.deepEqual(validateIssueLedger(base, next), [
    'ISSUE-1512: existing finding removed or renamed (Lost jobs).',
    'ISSUE-1512: identifier reused for another finding (Unrelated UI issue).',
  ]);
  assert.deepEqual(validateIssueLedger(base, finding(1513, 'Statement identity')), [
    'ISSUE-1512: existing finding removed or renamed (Lost jobs).',
  ]);
});

test('requires new closure evidence when an open finding becomes fixed', () => {
  const base = finding(1540, 'Budget resources');
  assert.deepEqual(validateIssueLedger(base, finding(1540, 'Budget resources', '✅ FIXED')), [
    'ISSUE-1540: resolved status needs newly added Closure evidence.',
  ]);
  assert.deepEqual(validateIssueLedger(base, finding(1540, 'Budget resources', '✅ FIXED',
    '- **Closure evidence:** commit abc1234, CI https://github.com/example/repo/actions/runs/123')), []);
});
