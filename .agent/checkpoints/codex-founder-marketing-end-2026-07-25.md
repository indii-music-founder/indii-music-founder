# Codex Checkpoint — Founder Marketing Release

Date: 2026-07-25
Objective: Publish the redesigned Founder marketing website, keep the product preview private, and close the session with production evidence.

## Delivered State

- Release commit `3a5c9704aa71de4ccc24b886862224cc1feab09a` is on `origin/main`.
- Production URL: `https://founder.indii.music/`.
- Exact-SHA workflow: `https://github.com/indii-music-founder/indii-music-founder/actions/runs/30177503173`.
- All 26 workflow jobs completed successfully, including 20 unit-test shards, rules tests, build, staging, staging E2E, and production deployment.
- Production browser proof:
  - both preview links read `Preview coming soon`;
  - both resolve to `#preview-status`;
  - the status panel is present;
  - `Built in Detroit.` and `wiil, Founder` are present;
  - `William Roberts` is absent.

## Product Decisions

- Founder preview access fails closed unless `VITE_FOUNDER_PREVIEW_ENABLED` is exactly `true`.
- Closed preview CTAs remain visible and move visitors to an honest on-page status explanation.
- The purchase is described as enterprise software rather than an investment; tax language remains qualified.
- The marketing surface uses actual product workstreams rather than placeholder screenshots or invented feature counts.
- The thesis sequence ends on `wiil, Founder`, does not loop automatically, and can continue playing its soundtrack after the crawl.
- The thesis title card and closing signature attribute the work to `wiil, Founder`; the LLC name remains only where the legal entity is appropriate.
- Core website and in-app copy now states that indii is both the conductor and the orchestra: the artist gives one direction and the connected system carries the work.
- `indii`, `indii.music`, and `wiil` are protected lowercase marks. Visible uses override inherited all-caps typography and use a typeface with true lowercase forms.
- A user-supplied original soundtrack can be dropped in as MP3, M4A, or WAV; the temporary synth is only a fallback.

## Closeout Health

- Pattern detector baseline: `171`.
- Final pattern detector score: `171`.
- Delta: `0` — the landing-only changes introduced no tracked renderer/Firebase patterns.
- Dependency drift: clean.
- `/better` task-scope audit: no implementation change required.
- Anti-hallucination scan: no task-path TODO, FIXME, stub, or mock implementation. The only `MOCK` matches were unrelated `.env.example` feature flags.
- Open pull requests and CodeRabbit review threads: none.
- Sentry CLI authentication succeeded, but the visible organization contains zero projects; unresolved production issues could not be enumerated with the available account context.
- No new generation-failure or error-ledger pattern was discovered.

## Architecture Handoff

`docs/flowcharts/founder-dynamic-routing.md` now documents:

1. Founder versus public route selection.
2. The exact-true preview feature gate and local coming-soon anchor.
3. Funnel target labeling for closed versus open preview access.
4. Thesis timing and terminal end-card behavior.
5. Soundtrack source priority, synth fallback, and resource cleanup.
6. The conductor-and-orchestra positioning and lowercase `wiil` founder mark.

## Remaining Founder Input

- Supply an original cleared thesis soundtrack using the filenames documented in `packages/landing/public/audio/README.txt`.
- Set `VITE_FOUNDER_PREVIEW_ENABLED=true` only when public product entry is intentionally ready.
