#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseIssueLedger } from './issue-ledger-integrity.mjs';

// Anchor lifecycle words: “code complete, live proof pending” is not closed.
export function classifyIssueStatus(status) {
  const text = status.replace(/^[^\p{L}]*/u, '').trim();
  if (/^(?:FIXED|CLOSED|COMPLETED|COMPLETE|DONE|RESOLVED|WONTFIX)\b/i.test(text)) return 'terminal';
  if (/^RESEARCH COMPLETE\b/i.test(text)) return 'decision';
  if (/^(?:OPEN|PARTIAL|BACKLOG|BLOCKED|PLANNED|FOUNDER-GATED|IMPLEMENTED|FIX IN FLIGHT|ISOLATED|CODE COMPLETE)\b/i.test(text)) return 'nonterminal';
  return 'ambiguous';
}

export function inventoryIssueLedger(markdown) {
  const grouped = new Map();
  for (const entry of parseIssueLedger(markdown)) {
    const record = {
      title: entry.title,
      status: entry.status,
      classification: classifyIssueStatus(entry.status),
    };
    const existing = grouped.get(entry.id) ?? [];
    existing.push(record);
    grouped.set(entry.id, existing);
  }
  const issues = [...grouped].map(([id, entries]) => {
    // A duplicate with an unresolved or unknown status cannot disappear behind
    // a terminal companion. Report every original title and status for review.
    const states = entries.map(entry => entry.classification);
    const classification = ['ambiguous', 'nonterminal', 'decision', 'terminal']
      .find(state => states.includes(state));
    return { id, classification, entries };
  }).sort((a, b) => Number(a.id) - Number(b.id));
  return {
    numberedEntries: [...grouped.values()].reduce((sum, entries) => sum + entries.length, 0),
    uniqueIds: issues.length,
    terminal: issues.filter(issue => issue.classification === 'terminal').length,
    decisions: issues.filter(issue => issue.classification === 'decision').length,
    nonterminal: issues.filter(issue => issue.classification === 'nonterminal').length,
    ambiguous: issues.filter(issue => issue.classification === 'ambiguous').length,
    duplicateIds: issues.filter(issue => issue.entries.length > 1).map(issue => issue.id),
    issues,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inventory = inventoryIssueLedger(readFileSync('.agent/test_ledger/OPEN_ISSUES_V3.md', 'utf8'));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(inventory, null, 2));
  } else {
    console.log(`Numbered entries: ${inventory.numberedEntries}; unique IDs: ${inventory.uniqueIds}`);
    console.log(`Terminal: ${inventory.terminal}; decisions: ${inventory.decisions}; nonterminal: ${inventory.nonterminal}; ambiguous: ${inventory.ambiguous}`);
    console.log(`Historical duplicate IDs: ${inventory.duplicateIds.join(', ') || 'none'}`);
    console.log('Ledger classification only; terminal labels are not independently verified closure evidence.');
    for (const issue of inventory.issues.filter(issue => issue.classification !== 'terminal')) {
      console.log(`ISSUE-${issue.id} [${issue.classification}]: ${issue.entries.map(entry => entry.status || '(missing status)').join(' | ')}`);
    }
  }
}
