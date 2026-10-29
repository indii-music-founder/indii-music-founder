import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyIssueStatus, inventoryIssueLedger } from './issue-ledger-inventory.mjs';

const finding = (id, title, status = '') =>
  `### ISSUE-${id}: ${title}\n\n${status ? `- **Status:** ${status}\n` : ''}`;

test('accepts terminal vocabulary without counting incomplete work as closed', () => {
  for (const state of ['✅ FIXED', '✅ CLOSED', '🟢 COMPLETED', '✅ COMPLETE', '✅ DONE', '✅ RESOLVED', '🟢 WONTFIX']) {
    assert.equal(classifyIssueStatus(state), 'terminal', state);
  }
  for (const state of ['🟠 CODE COMPLETE, LIVE-PROVIDER STEPS OUTSTANDING', '🟡 PARTIAL — fixed locally', '🔴 FIX IN FLIGHT', '🚧 BLOCKED / PLANNED']) {
    assert.equal(classifyIssueStatus(state), 'nonterminal', state);
  }
  assert.equal(classifyIssueStatus('🟢 RESEARCH COMPLETE / implementation gated'), 'decision');
  assert.equal(classifyIssueStatus(''), 'ambiguous');
  assert.equal(classifyIssueStatus('all tests green; held for push'), 'ambiguous');
  assert.equal(classifyIssueStatus('not FIXED'), 'ambiguous');
});

test('deduplicates IDs while preserving conflicting titles and conservative state', () => {
  const result = inventoryIssueLedger(
    finding(1, 'Original', '✅ FIXED') + finding(1, 'Follow-up', '🟡 PARTIAL') +
    finding(2, 'Research', '🟢 RESEARCH COMPLETE') + finding(3, 'No status') +
    finding(4, 'Finished', '✅ RESOLVED'));
  assert.equal(result.numberedEntries, 5);
  assert.equal(result.uniqueIds, 4);
  assert.equal(result.nonterminal, 1);
  assert.equal(result.decisions, 1);
  assert.equal(result.ambiguous, 1);
  assert.equal(result.terminal, 1);
  assert.deepEqual(result.duplicateIds, ['1']);
  assert.equal(result.issues[0].entries[1].title, 'Follow-up');
});

test('later checkpoint statuses and dated proposals do not replace a primary verdict', () => {
  const result = inventoryIssueLedger(finding(1510, 'NLE', '🟡 PARTIAL') +
    '\n#### Implementation checkpoint\n- **Status:** 🟢 COMPLETED\n' +
    '\n## 2026-10-19 — Proposed work\n### CI-V3-01 — Proposal\n- **Status:** 🔴 OPEN\n');
  assert.equal(result.uniqueIds, 1);
  assert.equal(result.nonterminal, 1);
  assert.equal(result.issues[0].entries[0].status, '🟡 PARTIAL');
});
