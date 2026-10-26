# GAUNTLET LOOP — EVOLAS BUILD PASS

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.

Same Builder/Critic discipline as the standard gauntlet loop, retargeted from
bug-fixing against `OPEN_ISSUES.md` to build-out against
`docs/EVOLAS_BUILD_PLAN.md`. Do not skip setup. Do not ask questions —
resolve ambiguity by reading the build plan and this repo's own conventions.

## 0. ORIENT (every run)
- Read `docs/EVOLAS_BUILD_PLAN.md` in full.
- Read `.agent/test_ledger/OPEN_ISSUES_V3.md` for any ISSUE-NNN entries
  already tagged Evolas/persona (search `persona`, `fader`, `Evolas`).
- Confirm test/lint/typecheck commands from `package.json` before assuming
  command names.

## 1. SCOPE SELECTION
Pick the next unbuilt sub-item under the CURRENT phase only (start at T1.1,
proceed in order — T1.2 cannot start before T1.1 exists, etc.). One sub-item
per run (e.g. "T1.1 — Fader data model"), never a whole phase, never two
sub-items at once. State which sub-item you picked and why it's next in
sequence.

If a sub-item's file target already exists and looks complete, verify it
against the build plan's description before assuming it's done — do not
trust a filename match alone.

## 2. PRODUCT RULE (non-negotiable — applies to every sub-item, no exceptions)
The seven non-negotiables in `docs/EVOLAS_BUILD_PLAN.md` under
"Non-negotiables" apply in full to every line of code this loop writes.
In particular:
- Style/substance split is structural, not a comment or a prompt
  instruction — verify with a real test, not a read-through.
- No per-user weight tuning, no exceptions, no "just this once for testing."
- No persona named Lawyer/Attorney or equivalent.
- Faders labeled by professional posture, never by personality trait.

## 3. ROLE SEPARATION (required)
- BUILDER: implements the scoped sub-item only. Full context on the build
  plan section + touched files only.
- CRITIC: fresh pass, no reliance on the builder's own summary. Inspects
  only the diff, real test output, real lint/typecheck output. If single-
  agent, perform this as a distinct pass: discard stated reasoning, re-read
  the diff cold as if reviewing a stranger's PR, specifically hunting for
  substance leaking into the style layer (that is the one failure mode this
  system cannot tolerate).

## 4. VERIFICATION CRITERIA (critic checks all five, per-criterion pass/fail)
1. Correctness — matches the build plan sub-item's stated spec; passes
   existing + new tests; null/empty/network-failure edges handled.
2. Types & architecture — no implicit `any`, single-responsibility
   functions, no dead code, zero compiler/linter warnings.
3. Performance — no sequential `await` in loops where `Promise.all` applies.
4. Security — input validation at every Firestore/API ingress in scoped
   files; no bare empty `catch`; no credentials/PII in logs.
5. **Style/substance isolation (Evolas-specific, in addition to the
   standard four)** — for any code touching `PersonaResponseService` or the
   prompt compiler: write or run a test that renders the same verdict at
   multiple fader positions and asserts the verdict object is byte-identical
   across renders. If this criterion cannot be tested for the scoped
   sub-item (e.g. T1.1 is pure schema, no rendering yet), state that
   explicitly rather than skipping silently.

## 5. LOOP RULE
No fixed round cap. After each builder pass, run the critic pass. If any
criterion fails, identify the single largest remaining gap and do another
builder round. Stop only when all five criteria pass against real
test/lint output.

## 6. LOGGING (required, every run)
- If the sub-item surfaces a design gap not covered by the build plan
  (e.g. a fader axis that doesn't compile cleanly to language, a cache
  break-even that doesn't hold at expected volume), log it as a new
  `ISSUE-NNN` entry in `.agent/test_ledger/OPEN_ISSUES_V3.md`, tagged
  `[Evolas]` in the title, and note it in `docs/EVOLAS_BUILD_PLAN.md` under
  the relevant phase if it changes the plan itself.
- Do not create new standalone summary/notes files. Only
  `OPEN_ISSUES_V3.md`, `EVOLAS_BUILD_PLAN.md` (plan changes only, not status
  logs), and code files change.

## 7. OUTPUT
- Diff (unified diff or full changed files) — not a prose description.
- Real test output and real lint/typecheck output, unedited.
- Critic's per-criterion verdict (pass/fail, one line each, five lines).
- Which build plan sub-item this closes, and which is next in sequence.
- End with exactly one line: `GAUNTLET_PASSED` or `GAUNTLET_FAILED — <gap>`.
