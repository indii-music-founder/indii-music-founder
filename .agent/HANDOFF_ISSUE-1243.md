# Handoff — ISSUE-1243 Firebase Gen1 → Gen2 migration

**Written:** 2026-07-29 · **Branch:** `main` · **HEAD:** `e55f09cdd` · **19 commits ahead of origin, nothing pushed.**

---

## 1. State: source migration is COMPLETE. Cutover is NOT.

`packages/firebase/src` contains **zero Gen1**. All 82 source declarations (81 deployed
endpoints) are Gen2. Typecheck 0 errors. 606 tests pass, 5 skipped, 90 files.
Three guards green and wired into `lint` + `.husky/pre-commit` (stage 3b) + `deploy.yml:216`:

```bash
npm run check:functions   # = check:no-gen1 && check:fn-memory && check:gen2-semantics
```

What is left is **deployment**, which has never run. It is blocked on expired cloud auth,
not on code.

---

## 2. Do this next

### Step A — re-auth (only the founder can run these)

```bash
firebase login --reauth
```

```bash
gcloud auth login && gcloud auth application-default login
```

### Step B — verify the cutover list against live reality before deploying

The delete list in `.github/workflows/deploy.yml` was derived from source, not from the
live project. Confirm each name actually exists and its generation:

```bash
for f in $(node -e "const s=require('fs').readFileSync('.github/workflows/deploy.yml','utf8');const b=s.split('for function_name in')[1].split(/\ndo\n/)[0];console.log(b.split('\n').map(l=>l.replace(/\\\\$/,'').trim()).filter(l=>/^[A-Za-z][A-Za-z0-9_]*$/.test(l)).join(' '))"); do printf '%s\t%s\n' "$f" "$(gcloud functions describe "$f" --region us-central1 --project indii-music-founder --format='value(environment)' 2>/dev/null || echo ABSENT)"; done
```

Empty generation = Gen1 (will be deleted). `GEN_2` = preserved. `ABSENT` = created fresh.

### Step C — deploy

Push `main` and let `deploy.yml` run, or deploy locally. **The repo path contains a space,
which the firebase CLI mishandles** — use the symlink:

```bash
ln -sfn "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder" /tmp/indii-deploy
```

### Step D — live verification after deploy (this is the acceptance gate)

Per function, confirm the three preserved invariants and the invoker rebinding:

```bash
gcloud functions describe <name> --region us-central1 --project indii-music-founder --format="value(serviceConfig.maxInstanceRequestConcurrency,serviceConfig.availableCpu,serviceConfig.availableMemory)"
```

Expect `1`, a Gen1-ratio CPU, and ≥512MiB. Then check IAM: **Gen1 grants
`roles/cloudfunctions.invoker` on the function; Gen2 grants `roles/run.invoker` on the
backing Cloud Run service.** Any public endpoint that was Gen1 needs its binding
re-established on the Run service or it will 403 after cutover. Verified examples:
`createStripeAccount` held `cloudfunctions.invoker/allUsers` (Gen1);
`getCustomerPortal` holds `run.invoker/allUsers` (native Gen2).

Do not declare this done until real invocations succeed. See the McLear Rule in CLAUDE.md.

---

## 3. Why the cutover step exists, and the bug just fixed (`e55f09cdd`)

Cloud Functions **cannot change generation in place**. Each Gen1 endpoint must be deleted
before its Gen2 replacement deploys, or the deploy fails ~18 minutes in.

The in-flight script could never delete anything: it matched the literal string `GEN_1`,
which gcloud never emits — `describe --format="value(environment)"` prints `GEN_2` for
2nd-gen and **prints nothing** for 1st-gen. Every Gen1 endpoint fell to the empty branch
and was logged "not currently deployed". It also passed `--gen2`, which filters the lookup
to 2nd-gen only, so it could not have seen a Gen1 function even in principle.

Now: two lookups (existence via `value(name)`, generation via `value(environment)`), no
`--gen2`, all 81 endpoints, idempotent on repeat deploys.

---

## 4. The three silent divergences this migration had to defend against

None produce a type error, a failing test, or a deploy failure. This is why the guards
exist rather than a one-time sweep — the original Gen1/Gen2 split was accretion, not a
decision, and will silently reappear without enforcement.

| | Gen1 | Gen2 default | Fix applied |
|---|---|---|---|
| Concurrency | 1 req/instance | 80 | `concurrency: 1` per export |
| CPU | scales with memory tier | full vCPU | `cpu: 'gcf_gen1'` |
| Memory | 256MB when unpinned | inherits global | **deliberately NOT preserved** — see below |

**The memory exception (ISSUE-1242).** An unpinned Gen1 trigger runs at 256MB. That is
below this repo's shared cold-start import floor. `generateContentStream` pinned nothing,
ran at 256MB, could not complete its outbound Arcjet call under memory pressure, and
**denied 100% of authenticated AI requests in production.** Migration must never carry the
live 256MB forward. Floor is 512MiB, enforced by `scripts/check-function-memory.cjs`.
Note `setGlobalOptions({ memory: '512MiB' })` in `index.ts` applies only to v2
declarations — it never covered Gen1 `runWith`.

Spellings differ: v1 `'512MB'`/`'1GB'`; v2 `'512MiB'`/`'1GiB'`.

---

## 5. Two false claims already corrected — do not reintroduce them

**A. "v1 and v2 have separate HttpsError classes."** FALSE at firebase-functions 7.2.5.
Measured: `require('firebase-functions/v1').https.HttpsError === require('firebase-functions/v2/https').HttpsError` → `true`. Both re-export one class from
`common/providers/https`; `instanceof` matches both directions. This is recorded as
ISSUE-1243 cause #3 in `.agent/test_ledger/OPEN_ISSUES_V2.md` and **is still wrong there** —
that file is release-owned and was left untouched. Retraction commit: `94d3a30a6`.

The `instanceof` checks in `generateDownloadUrl.ts:70`, `auditReleaseArtwork.ts:40` and
`touring.ts:211` were **never broken**. Three genuine defects did exist and are fixed —
`refreshSocialToken`, `emailExchangeToken`, `emailRefreshToken` had catches with *no
pass-through at all*. `emailRevokeToken` needed none (its try throws no HttpsError).

**B. "The ISSUE-1238 memory guard was never wired into CI."** FALSE. It has been a named
step at `deploy.yml:216` since ISSUE-1238. The mistake was grepping `.github/` for the
script *filename* when CI references the npm script *name*. Corrected in `b97a7ac81`.

---

## 6. Guards

| Script | Enforces |
|---|---|
| `scripts/check-no-gen1.cjs` | zero Gen1 surface in implementation **and** tests |
| `scripts/check-gen2-migration-semantics.cjs` | per-export `memory ≥512MiB`, `cpu:'gcf_gen1'`, `concurrency:1` |
| `scripts/check-function-memory.cjs` | ~259MiB shared cold-start floor (ISSUE-1242) |

The semantics guard is scoped to an explicit `MIGRATED` array (82 entries) so the ~85
native-Gen2 exports are untouched — an earlier version scanned everything and could never
turn green. It checks **values, not key presence**, reports unresolved manifest entries so
the list cannot rot, and was proven non-vacuous by injecting `memory:'256MiB'` +
`concurrency:80` into `requestTaxForms` (2 findings, exit 1).

`check-no-gen1.cjs` deliberately does **not** flag `functions.https.onCall` — that spelling
is ambiguous. `functions/billing/enforceOperationCost.ts` imports
`* as functions from 'firebase-functions/v2'` and uses it for legitimate v2 callables with
`CallableRequest` handlers. The v1-namespace form is caught by the import rule instead.

Call this the **source/runtime-semantics migration inventory**, not a delete-to-deploy
manifest — the founder requires a separately validated cutover with replacement/rollback
evidence before any deletion.

---

## 7. Recurring trap when editing these files

Adding an options object to a v2 factory breaks any test mock shaped
`onCall: (handler) => handler`. Mocks must unwrap both arities:

```ts
(optsOrHandler, maybeHandler) => typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler
```

Fixed across `writeSharedOperationalData`, `distributionRecords`, `generateDownloadUrl`,
`splitEscrow`, `image_generation` (16 sites), `video` (8 sites), `image_gen`. Assertions
were never weakened.

Also: `onDocumentCreated` types `event.data` as **optional**; Gen1 `onCreate` always
delivered a snapshot. `index.ts`'s `executeVideoJob` now returns early when it is absent,
covered by `packages/firebase/src/__tests__/executeVideoJob.cloudevent.test.ts` (6 tests).

---

## 8. Open items

- **Push + deploy** — never done. 19 commits sit unpushed on `main`.
- **Ledger correction** — `.agent/test_ledger/OPEN_ISSUES_V2.md` still records the false
  HttpsError cause. Release-owned; needs the founder or the release lane.
- **`generateImageV3Fn`** — dead (index.ts never instantiates it) but **deliberately
  retained**. Its 11 tests are the only coverage of `GeminiImageService.generate()`
  (model routing, 14 aspect ratios, thoughtSignature extraction, grounding). Deleting it
  orphans that class method and its coverage — a code-path removal, not a cleanup. Separate
  scoped decision.
- **`deploy.yml`'s standalone memory-guard step** — now redundant, `lint` covers it.
- **Uncommitted working tree** — `firebase.json`, `docs/*`, `MediaTools.ts`,
  `packages/renderer/src/services/agent/tools/index.ts`, a deleted
  `extensions/storage-resize-images.env`, and an untracked
  `docs/audits/firebase-gen2-cutover-readiness-2026-07-28.md`. **These belong to another
  lane, not to ISSUE-1243.** Do not sweep them into a Gen2 commit.

---

## 9. Constraints that were in force

Standing founder directives during this work: no push, no deploy, no rewriting prior
commits, no touching release-owned ledger/docs. `deploy.yml` was explicitly handed over
("take it over plz") and is the one exception. Push/deploy authorization has **not** been
given — ask before Step C.
