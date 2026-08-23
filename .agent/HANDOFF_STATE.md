# Session Checkpoint — Remote Control System Repair (2026-08-22, DSH agent)

**Updated:** 2026-08-22 (session close, round 2)
**Branch:** `main` — local == origin/main (0/0).

## Shipped round 2 — phone reaches files / notes / boardroom (same day)

**Commit: fix(remote): phone-side mode targeting, full boardroom relay, notes tools for every agent**
(Foundation: `851e656a1` earlier this session — freshness honesty, truthful busy
responses, dead P2P removal, live relay health; CI 32600606995 green.)

Founder bottom line: desktop execution stays the brain; the phone must reach
the user's files, notes, and boardroom through it. Audit found files already
wired (`browse_local_files` in SUPERPOWER_TOOLS + DesktopFileIndexService) but
two capabilities silently degraded:

1. **Mode targeting was decorative.** AgentChat sent no mode; executeFlow
   routed by the desktop's own conversationMode/directTarget/department
   state. Now the Controller sends `metadata.conversationMode`, the relay
   validates it and passes `conversationModeOverride`/`targetOverride`
   through sendMessage; desktop-initiated behavior unchanged. Firestore
   rules metadata allowlist extended (enum-checked) — the old allowlist
   would have permission-denied every phone chat write.
2. **Boardroom was truncated to its last speaker.** Relay now forwards ALL
   final agent messages (cap 12), each attributed + rateable on the phone.
3. **Notes were unreachable from chat.** save_note/save_media_note/list_notes
   declared in SUPERPOWER_TOOLS, implemented in BaseAgent.functions,
   risk-registered. `list_notes` is new (read-only, snippet-only).

Evidence: full monorepo Vitest 6,683 passed / 0 failed (incl. 15 new tests
across notes tools, mode resolution, transcript collection, rules metadata);
typecheck green; lint 0 errors; production build green; rules test extended
for the new metadata key (emulator suites run in CI).

## Next up (PLANNED, not started)

**`docs/REMOTE_EXECUTOR_CORE_PLAN.md`** — founder directive (2026-08-22, adopted as plan of record): separate remote-executor lifecycle from React renderer lifecycle via StudioExecutorCore + StudioExecutionAdapter, then move the Core to the smallest safe background runtime. Phased, test-first, single-executor invariant. The doc includes §19 evidence annotations from this session: verified claims (audio proxy boundary, no existing utilityProcess infra), corrections for same-day shipped work that moved its premises (freshness contract, lease-gated writes, lock/queue shapes), and a defined Phase-1 first work package.

## Known follow-ups (NOT done, deliberately out of scope)

- Real two-device validation (iPhone ↔ Electron) still required before
  claiming end-to-end smoothness on hardware — unit/local evidence is
  structural+local only. REMOTE_RELAY_TEST_PLAN scenarios 4-7 unrun.
- Hybrid cloud fallback (cloud answers when desktop offline) remains a
  product decision, deliberately not built.
- Orphaned preload IPC (`remote.onMessageFromMobile` / `remote.broadcast`)
  could be removed from packages/main/preload.ts + electron.d.ts.
- Unrelated in-flight working-tree files (NOT mine, do not commit):
  envelope.json fixture, archive/Music/Machine Code.mp3 (untracked), docs/video/ (untracked).


- Unrelated in-flight working-tree files (NOT mine, do not commit):
  envelope.json fixture, archive/Music/Machine Code.mp3 (untracked), docs/video/ (untracked).

## Shipped round 1 (earlier this session) — `851e656a1`, CI 32600606995 green, production deployed

**`851e656a1` fix(remote): honest presence freshness, truthful busy responses, dead P2P removal, live relay health**

1. **Presence freshness forgery (the "pairs but won't hold" flapping).**
   `onDesktopState` stamped `_localReceivedAtMs = Date.now()` on every snapshot
   and `isFreshDesktopState` trusted that stamp over the doc's server heartbeat
   timestamp. Firestore re-serves cached doc content as the first snapshot of
   EVERY subscription (mount / manual retry / each auto-reconnect resubscribe),
   so an `online:true` doc with a hours-old heartbeat certified as "connected"
   for a fresh 120s window per resubscribe. Replaced with heartbeat-ADVANCE
   tracking (`_heartbeatAdvancedAtMs`): only a snapshot whose server timestamp
   VALUE changed witnesses a live beat, measured on the local monotonic clock;
   without a witness, the doc's own age (+30s skew tolerance) must hold alone.
   `studioStateFreshnessRemainingMs` mirrors the same boundary.
2. **False completions under desktop busyness.** Chat route answered
   sendMessage's silent queue-and-return with a literal "Done."; single-slot
   `pendingSend` discarded older queued messages; the relay command lock was
   taken only after an awaited cloud claim; dispatch tasks were marked
   completed while merely queued. Now: explicit QUEUED response, bounded FIFO
   queue in AgentService, synchronous lock with one release point,
   `assertDesktopWasFreeToRun` fails captures loudly so the phone keeps them.
3. **Dead LAN P2P WebSocket transport removed** (renderer side). Preload API
   left intact (follow-up hygiene).
4. **Settings now shows real Cloud Relay Heartbeat state** via new
   `studioRelayHealth.ts` — "Ready" no longer means merely "Electron bridge exists".

Evidence: focused remote suites 102/102 (8 new regression tests); full
monorepo Vitest 6,672 passed / 0 failed; typecheck green; lint 0 errors;
production build green. ERROR_LEDGER entries 2026-08-21 (cache-hit forgery;
silent-queue false completions) and 2026-08-22 (partially-reachable bottom line).

## Prior session (2026-08-20, performance engineering) — superseded context

Shipped then: `7e47e7d05` perf(web) startup-JS cut (~640KB, minified deploy
build), `825e0ef44` perf lazy landing sections + deferred Sentry. Measured:
studio login JS transfer 1.91MB → 1.12MB; landing FCP ~430-730ms. Details in
git history; CI runs 32375459143 + 32388085318 green at the time.
