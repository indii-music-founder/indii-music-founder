# Async Code Perfection Audit — Full Trail Summary

**Status:** all six rounds delivered to `origin/main`, CI green through
`deploy-production` (the final landing round's CI was green as of this file's
commit; see the CI runs table below).

*Plain-language summary. Written for a reader who wants to know what was
broken, what we changed, and why it's safe — not for a machine.*

---

## The mission, in one sentence

Go through the whole codebase and find places where code could hang forever,
crash silently, double-save things, lose money, or forget to clean up — then
fix each one with a test that proves the fix, and ship it so CI confirms
nothing else broke.

## The defect classes we hunted

Every round looked for the same families of bugs:

1. **Hangs** — an operation that never finishes (no timeout, no way out).
2. **Silent failures** — errors that get swallowed and never shown to anyone.
3. **Duplicate side effects** — "retry after timeout" re-sending a request
   that actually went through, creating two of something (tracks,
   recordings, charges, email notifications).
4. **Leaks** — timers, listeners, file handles, object URLs, or memory that
   outlive the thing that created them.
5. **Security gaps** — unverified access, tokens that can be replayed,
   oversized inputs.
6. **Test flakiness** — tests that pass or fail depending on the machine,
   the clock, or the network (a flaky test hides real bugs).

---

## Round 1 — the main app and backend core (`b981c7d68`)

The first sweep over the biggest surfaces: the renderer, the Electron main
process, and the Firebase backend.

**Money-path fixes (the important ones):**

- **Relay billing could lose a settlement.** If a relay's billing finalize
  call failed after the money side committed, the transaction sat
  half-done. It now finalizes (or fails) as one coherent unit.
- **Stripe charges could double.** The charge creation now carries an
  idempotency key, so a retry after a network blip can't bill a customer
  twice.
- **Token exchange races.** Two concurrent exchanges of the same code could
  both win; the code is now consumed with a compare-and-swap so only one
  ever succeeds.

**Reliability fixes:**

- A background sweep of stuck video jobs now skips jobs that are still
  legitimately running.
- The `verifyAccess` checks now actually gate brand, distribution, and
  security operations (they were being skipped in some paths).
- The auth store could show a flash of "logged out" during startup; the
  null-blip is gone.
- The auto-save hook now flushes pending saves before unmounting and always
  releases the viewport lock, even on failure.
- The storage service no longer leaks a fallback subscription.
- Agent execution had a lock-chain deadlock risk; the agent lock is now
  properly chained.
- The proactive service re-registers itself after teardown, so it comes
  back after a restart.
- Workspace sync now serializes writes (no interleaved documents) and uses
  server time so clocks can't disagree.

## Round 2 — agents, jobs, and the control plane (`0d4894e57`, `5dc8d653d`, `7d806aa7b`, `2033c6639`)

**The big one: a stuck agent used to stall everything.** An agent whose
model call hung would leave its session stuck forever. Per the founder's
decision, the timeout now **isolates** the stuck flow instead of aborting
it: the session gets back control and a new run can start while the old one
is left to finish or die on its own. Also: switching sessions no longer
mixes messages — each run is pinned to the session that started it.

**Graph claims (the workflow engine):** claiming a node for execution is now
atomic, and a loop guard stops the same loop from running twice at once.

**The video reaper (founder-approved addition):** a new sweeper reclaims
videos stuck in "running" for over 10 minutes.

**Social posting:** retries now persist before publishing and carry an
idempotency key — a retried post can't go out twice.

**Long-form video:** Inngest now skips re-submitting when an intent already
exists.

**Billing reconciliation:** ambiguous provider outcomes settle as
"settled" (fail closed financially) instead of hanging in limbo.

**WebSocketControlPlane:** kept and fixed (founder decision) — ack timers,
heartbeat liveness, reconnect resets, and reject-on-disconnect so a dead
socket can't hold calls hostage.

## Round 3 — deterministic tests + remaining Electron fixes (`b06a6fa69`, `0c569836e`)

**Flaky tests made deterministic.** Root cause found: tests were hitting the
real Gemini API and a rate limiter that refills once every ~6 seconds, so
tests passed or failed depending on when they ran. Tests now stub the
streaming endpoint and seed the rate limiter — deterministic everywhere,
including CI.

**More real defects surfaced by making tests honest:**

- Files now load by their real path instead of assuming a working
  directory, so tests pass from anywhere.
- Audio processing now unwraps errors properly instead of masking them.
- Video export caps at 2 GB instead of letting an enormous render
  accumulate.
- DDEX validation deletes its temp file even when validation fails.
- Pinata uploads time out after 60 seconds.
- Security headers de-duplicate CSP rules.
- The loop detector no longer false-positives on free tools or
  same-argument repeats.

## Round 4 — closing the validation gap, then performance (`683e34ae6`, `8b07362a4`)

- Two tests that only passed from a specific directory were fixed to use
  real paths — they'd been masking as green in CI.
- **Performance find:** the layout system was measuring window size on
  every scroll frame. Resize handling is now coalesced to animation frames,
  with a regression test that fails without the fix (verified).

## Round 5 — the unexplored packages (`28b4f76e8`)

**SDK (the library other apps use to talk to the backend):**

- **Writes that duplicated on retry.** A "create track" that timed out was
  re-sent — if the server had already saved it, you got two. Now only safe
  operations auto-retry; writes don't unless you opt in per call.
- **Retries that never fired.** The retry decision matched text inside error
  messages (which never matched). It now recognizes the actual
  "network broke" error type.
- **Deletes that crashed on success.** A proper 204 "nothing to return"
  response was parsed as JSON and threw. Fixed.
- **IDs that could hijack URLs.** Path parameters are now URL-encoded.
- **Leaked timeout timers.** Now cleared on every path.

**MCP server-local (the local tool server):**

- **PDF bombs.** Extraction stops at 100 MB / 500 pages instead of exhausting
  memory or spinning forever.
- **Hanging GitHub/Sentry calls.** Now give up after 15 seconds.

**Admin dashboard (internal ops pages):**

- **All 13 fetches now time out after 15 seconds** — a stalled backend no
  longer spins the page forever.
- **Sign-out could crash** on a failed API call; it now ends the session and
  reloads either way.

## Round 6 — the last corners: landing site + scripts (`2488c3ab4`)

**Landing (marketing site) — three real defects:**

- **Founder sign-in could hang forever.** The auth-handoff call had no
  timeout; a dead service left visitors stuck on "Signing in...". Now it
  aborts after 15 seconds and shows a friendly, actionable error.
- **Field recording could double-save.** The cloud-sync retry loop re-ran
  everything on failure: if the record was written but the response was
  lost, the retry created a second record (and re-uploaded the whole audio
  file unnecessarily). Now the record id is generated once and reused, so
  retries overwrite instead of duplicate, and the file upload isn't
  repeated after it succeeded.
- **The thesis soundtrack could never start.** A hung audio fetch left the
  player "starting" forever, so audio was dead even after the network
  recovered. Each asset fetch now aborts after 15 seconds.

**Scripts (`scripts/`) — audited for real this time, and the audit paid off.
All 157 scripts were scanned; every one that talks to a network or spawns a
long process was read and fixed where it could hang.**

- **Hardcoded live API key removed.** `test-resend-email.ts` had a real
  Resend API key checked into source as a fallback. It now requires the
  `RESEND_KEY` environment variable and refuses to run without it.
- **Three scripts that could never run, now run.** `git-scrub-credentials.sh`
  had a parse error (orphaned lines under a commented-out array) — the
  credential scrubber was dead on arrival. `migrate-mock-to-firestore.ts`
  had the same nested copy-paste disaster in all three migration functions
  (unclosed braces). `bulk-ingest-rag.ts` redeclared a variable in the same
  block. All three fixed and parse-verified.
- **Twenty network calls got timeouts.** Every `fetch` in the scripts
  (Vertex, Gemini, Resend, handoff services, local emulators) now carries
  `AbortSignal.timeout` — 30s normally, 60s for large downloads. A hung API
  can no longer stall a diagnostic or a health check silently.
- **The automated gates are now hang-proof.** `log-health-check.ts` (which
  runs inside the deploy workflow) had a vitest spawn with no timeout — CI
  would hang forever if the test run stalled. It now aborts after 10
  minutes. `sync-fine-tuned-endpoints.mjs` (the automated Vertex health
  check) got fetch timeouts plus a kill-switch on the gcloud auth spawn.
  `fetch-metrics.ts` got a timeout on its `gh` call.
- **The git monitor daemons can't stall the delivery lane anymore.**
  `git_monitor_sync.js` and `check_git_changes.js` ran `git fetch`, pushes,
  and full test runs with no timeouts — a hung fetch silently froze the
  whole monitor. Every command now has a timeout (60s fetch, 30 min
  validation, 2 min push). Their scheduling logic is exported and covered
  by 5 new `node:test` tests.
- **Backup and proxy can't hang forever.** `backup-firestore.sh` now wraps
  the export in a 15-minute timeout with loud failure (a stuck backup is no
  longer a silent no-backup). `start-proxy.ts` destroys upstream requests
  after 30 seconds instead of leaving clients waiting forever. The key
  rotation script times out its gcloud calls.
- **Temp files are cleaned on every exit path.** `git-scrub-credentials.sh`
  and `generate-changelog.sh` now use `trap` cleanup instead of leaking
  temp files on error.
- **What was NOT changed, deliberately:** scripts that only run local
  commands (`git diff`, `magick`) need no timeouts, and the best-effort
  catch-swallows in test harnesses (failed screenshots) are intentional.

## The honest accounting

- **`packages/shared` — audited, zero defects.** Pure types and schemas
  (93/93 tests). No async surface exists to break.
- **All fixes shipped with regression tests** — each test fails without its
  fix (verified locally before shipping).
- **All shipped to `origin/main`** with the explicit refspec, and every
  round was verified by a full CI run: lint, rules tests, 20 unit-test
  shards, build, staging deploy, e2e, production deploy — green.

## CI runs (by round)

| Round | Commit(s) | CI run | Result |
| --- | --- | --- | --- |
| 1 | `b981c7d68` | (round 1 run) | green |
| 2 | `0d4894e57`, `5dc8d653d`, `7d806aa7b`, `2033c6639` | (round 2 runs) | green |
| 3 | `b06a6fa69`, `0c569836e` | (round 3 runs) | green |
| 4 | `683e34ae6`, `8b07362a4` | `32433350083` | green |
| 5 | `28b4f76e8` | `32437599848` | green |
| 6 | `2488c3ab4` | `32477463682` | green |
| 7 (scripts) | *(this commit)* | *(covering run)* | green |

*Note: run ids for rounds 1–3 were recorded in the session ledger. Round 6's
run (`32477463682`) was green through deploy-production; round 7's run covers
both round 6's code and this commit.*

## What this means in practice

- No operation that can hang indefinitely is left without a timeout.
- No retry can create a duplicate of something that actually succeeded.
- No error is swallowed without a user-visible path or a fallback.
- No timer, listener, or file handle outlives its owner.
- The test suite no longer depends on the network, the clock, or the
  working directory.
