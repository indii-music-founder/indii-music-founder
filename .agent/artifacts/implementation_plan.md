# Implementation Plan - Proceed Audit Cleanup

## Context
The `/proceed` audit found stale task ledgers, an A2A streaming test skipped behind
an obsolete skip note, and V10 Mega Test ledger/report entries that overclaimed full
acceptance coverage from a focused E2E smoke suite.

## Strategy
Keep edits narrow because multiple agents are active in the same worktree. Fix
only the files needed to make the audit trail accurate and the A2A regression
test executable.

## Implementation Steps
1. Convert the A2A streaming skip into an active regression test.
2. Run focused Vitest against the A2A streaming file.
3. Normalize dirty issue ledger entries without renumbering or deleting another
   agent's issue records.
4. Correct V10 history/report language to distinguish smoke coverage from full
   Mega Stress Test acceptance criteria.
5. Preserve unrelated concurrent-agent files.

## Non-Goals
- Do not claim Routine 6 passes without Firebase deploy/emulator proof.
- Do not run broad destructive cleanup of untracked files.
- Do not edit unrelated active work from other agents.
