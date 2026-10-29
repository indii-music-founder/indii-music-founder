import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('CLI reads committed and staged ledgers larger than the default subprocess buffer', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'issue-ledger-buffer-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    mkdirSync(join(cwd, '.agent/test_ledger'), { recursive: true });
    writeFileSync(join(cwd, '.agent/test_ledger/OPEN_ISSUES_V3.md'),
      finding(1, 'Large literal ledger') + 'Historical evidence.\n'.repeat(60_000));
    git('add', '.agent/test_ledger/OPEN_ISSUES_V3.md');
    git('-c', 'user.name=Ledger Test', '-c', 'user.email=ledger@example.invalid', 'commit', '--quiet', '-m', 'Literal ledger input');
    const script = fileURLToPath(new URL('./validate-issue-ledger.mjs', import.meta.url));
    for (const args of [['HEAD'], ['HEAD', '--staged']]) {
      assert.match(execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' }),
        /Issue ledger findings, identifiers, and closure evidence preserved/);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
