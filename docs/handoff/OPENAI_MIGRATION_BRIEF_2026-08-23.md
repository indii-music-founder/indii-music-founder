# INDII — FINAL HANDOFF / MIGRATION BRIEF

**Prepared:** 2026-08-23 (Sunday session, main branch)
**Repo:** `indii-music-founder` — npm workspace monorepo (Electron + React + Firebase)
**Project:** indii (`indii.music`) — The Independent Creative Engine, v1.65.0
**Live:** private founder beta at app.indii.music / indii-studio.web.app; 195 Cloud Functions deployed
**Purpose of this document:** complete knowledge transfer for a fresh agent in a new environment (OpenAI). Read it fully before acting.

---

## 0. TRUTH IN ONE PARAGRAPH

This is a working, live product used daily by founders — not vaporware. Its security, payments, and rules suites are unusually hardened (Firestore rules 235/235 emulator-proven, storage rules 20/20, Stripe webhook idempotency fixed, Electron config verified, App Check enforced). But it cannot be publicly offered yet, and its flagship promise (direct-to-DSP distribution bypassing aggregators) is 0% operable by design until real-world prerequisites exist. The code tail is short; the external dependencies are long.

---

## 1. WHAT THIS SESSION SHIPPED (local commits, NOT yet pushed)

Local unpushed commits on `main`:
1. **`e2e535dac`** — ISSUE-1163 updater-feed systemic fixes (release.yml feed-level verification job, publish idempotency, user-safe updater copy, incident runbook, removed vestigial release-please.yml)
2. **`f241df6d8`** — ISSUE-1365 follow-up hardening (stripUndefined applied to ALL creative_jobs write paths in gateway.ts; ledger entries for ISSUE-1365 root cause, ISSUE-1168 verification, new ISSUE-1400)
3. The commit that adds this document.

Run after reading: `git log origin/main..HEAD --oneline` to see exactly what's pending push.

### Session accomplishments
- **ISSUE-1365 root cause CONFIRMED from production logs** (founder-run console review): `generateImageV3` initial Firestore `set` fails because `sessionId` is `undefined`; the subsequent `update` then fails `code: 5 / NOT_FOUND` because the doc was never created. The repo already contained the strip for `safeDbSet`/`safeDbUpdate` (`f5eef5629`, ISSUE-1368) — **this is a deploy problem, not a re-code problem.**
- Hardened the two remaining RAW `creative_jobs` writes in `generateOmniRemixV3` (initial `set` + completion `update`) so optional undefined fields can never hit the same wall.
- **ISSUE-1168 verified in console:** alert policy "AI generation billing/quota exhaustion (RESOURCE_EXHAUSTED)" exists, attached to "Founder email (William)" channel. Test alert email not yet sent (residual item).
- **ISSUE-1400 NEW:** GCP OAuth consent screen is **Testing, not In production**, with **zero test users** configured. YouTube/Gmail OAuth restricted until fixed.

---

## 2. ALL THE LINKS

### Google Cloud Console (project: `indii-music-founder`)
| Task | Link |
|---|---|
| generateImageV3 logs (ISSUE-1365 verify) | https://console.cloud.google.com/functions/details/us-central1/generateimagev3/logs?project=indii-music-founder |
| Cloud Functions list | https://console.cloud.google.com/functions/list?project=indii-music-founder |
| Alert policies (ISSUE-1168) | https://console.cloud.google.com/monitoring/alerting/policies?project=indii-music-founder |
| OAuth consent screen (ISSUE-1400) | https://console.cloud.google.com/apis/credentials/consent?project=indii-music-founder |
| Credentials / API keys / OAuth clients | https://console.cloud.google.com/apis/credentials?project=indii-music-founder |
| Logs Explorer (general) | https://console.cloud.google.com/logs/query?project=indii-music-founder |

### Firebase Console
| Task | Link |
|---|---|
| Project overview | https://console.firebase.google.com/project/indii-music-founder |
| Functions (deploy status) | https://console.firebase.google.com/project/indii-music-founder/functions |
| Firestore (check creative_jobs/usage) | https://console.firebase.google.com/project/indii-music-founder/firestore |

### GitHub
| Task | Link |
|---|---|
| Releases | https://github.com/indii-music-founder/indii-music-founder/releases |
| Stable feed check — macOS | https://github.com/indii-music-founder/indii-music-founder/releases/latest/download/latest-mac.yml |
| Stable feed check — Windows | https://github.com/indii-music-founder/indii-music-founder/releases/latest/download/latest.yml |
| Stable feed check — Linux | https://github.com/indii-music-founder/indii-music-founder/releases/latest/download/latest-linux.yml |

### Founder real-world registrations
| Item | Link | Cost | Time |
|---|---|---|---|
| Apple Developer Program | https://developer.apple.com/programs/enroll/ | $99/yr | days–2wks approval |
| Windows code signing (OV or EV) | e.g. SSL.com, Sectigo, Azure Trusted Signing | ~$100–400/yr (verify) | 1–3 days |
| DDEX Implementation Licence | https://kb.ddex.net/general-implementation-guidance/licensing-the-standards/ | FREE | same day |
| DDEX DPID lookup (resolve conflict!) | https://dpid.ddex.net | FREE | days |
| US ISRC Rights Owner prefix | https://redesign.usisrc.org/apply-for-an-isrc-account/?user-is-manager=false | $95+/yr | days–wks |
| GS1 GTIN/UPC | https://store.gs1us.org/gs1-company-prefix/p | $30/single or $250+$50/yr prefix | days |
| US Copyright fees | https://www.copyright.gov/about/fees.html | $45 single / $65 std+group | wks |
| The MLC | https://www.themlc.com/membership | FREE | days |
| SoundExchange | https://www.soundexchange.com/register/ | FREE | days |
| Meta Rights Manager | https://about.fb.com/news/2023/01/helping-creators-and-publishers-manage-intellectual-property/ | FREE | wks |
| Merlin membership path | https://merlinnetwork.org/path-to-merlin-membership/ | by application | wks |

---

## 3. DO THIS FIRST IN THE NEW ENVIRONMENT

1. **Read the active ledger:** `.agent/test_ledger/OPEN_ISSUES_V3.md` (append-only; statuses 🔴 OPEN / 🟡 PARTIAL / ✅ FIXED / 🟢 WONTFIX).
2. **Read the founder task source:** `docs/RELEASE_CHECKLIST.md` (~83 open checkboxes, the canonical real-world-task list).
3. **Verify build health** (new env should have write perms):
   ```bash
   npm run typecheck && npm run test:ci
   ```
4. **Deploy the ISSUE-1365 fix to production** (this is the #1 engineering urgency):
   ```bash
   cd "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder"   # adjust path in new env
   npm run build -w packages/shared && npm run build -w packages/firebase && firebase deploy --only functions:generateImageV3,functions:generateOmniRemixV3
   ```
5. **Post-deploy verify:** generate ONE image in the app (Boardroom is fine), then check:
   - No new `[creativeGateway] Firestore set/update failed` lines in the generateImageV3 logs link (above)
   - `creative_jobs` has the new job document
   - Usage meter moves (top-level `usage` collection)
6. **Push the local commits** once the deploy verifies: `git push`
7. **OAuth interim fix (30 seconds, founder does):** OAuth consent screen link above → Audience → Test users → add `wiil@indii.music`. Full "In production" + Google review can wait for the launch push.

---

## 4. LIVE TRACKER — COST/TIME/OWNER FOR EVERY BLOCKER

Legend: Cost = founder's money. Time = elapsed once started.

### TABLE A — Desktop shipping (HARD BLOCKER #1)
| Item | Cost | Time | Owner | Status |
|---|---|---|---|---|
| Apple Developer Program | $99/yr | days–2wks | FOUNDER | NOT STARTED |
| Developer ID cert + keychain | incl. | <1 hr | FOUNDER | blocked on row 1 |
| Notarization credentials | incl. | <1 hr | FOUNDER | blocked on row 1 |
| Signed+notarized DMG via CI | $0 | <1 day | AGENT/CI | workflow gates on secrets |
| Windows code signing cert | ~$100–400/yr | 1–3 days | FOUNDER | NOT STARTED |
| Updater feed systemic checks | $0 | DONE | AGENT | committed `e2e535dac` |

Stable macOS channel currently resolves to empty `v1.50.0` → every desktop client sees "cannot check for updates." No new macOS release can ship until the Apple secrets exist.

### TABLE B — DDEX direct-delivery chain (flagship promise, 0% operable by design)
| Chain link | Cost | Time | Depends on | Status |
|---|---|---|---|---|
| 1. Accept DDEX Implementation Licence + archive ERN 4.3 XSDs w/ SHA-256 | FREE | same day | nothing | NOT STARTED |
| 2. Confirm DPID at dpid.ddex.net — **repo has TWO conflicting values**: `PA-DPIDA-2025122604-E` (distributors.ts, DeliveryProfile.ts) vs `PA-DPIDA-2025122601-E` (verify-adapters.test.ts). Resolve + fix wrong file | FREE (allocated w/ licence) | days | link 1 | CONFLICT UNRESOLVED (ISSUE-859/861) |
| 3. Set `DDEX_SENDER_PARTY_ID` (digits-only, e.g. PADPIDA2025122604E) as Functions runtime secret | FREE | minutes | link 2 | code fail-closed & waiting |
| 4. Recipient partner: DPID, endpoint, transport creds, profile requirements | FREE | WEEKS–MONTHS (partner-scheduled, biggest unknown) | links 1–3 | NOT STARTED |
| 5. One non-commercial test delivery (owned master + art) | FREE | days after partner test instructions | link 4 | NOT STARTED |
| 6. Production transport creds + live releases | FREE | partner-gated | link 5 | NOT STARTED |

**Partner call packet:** legal name/address, business+technical contacts, label/distributor role, intended recipients, a test release, confirmation indii controls the master/artwork. Playbook: `docs/RELEASE_CHECKLIST.md` §Direct DDEX Delivery Activation and `docs/business-decisions/04_DSP_ONBOARDING_PLAYBOOK.md`.

### TABLE C — Music-industry registrations (gates any customer release)
Prices from ISSUE-1121; re-verify at purchase.
| Registration | Cost | Time | Notes |
|---|---|---|---|
| US ISRC Rights Owner prefix | $95+/yr (up to 100k codes) | days–wks | videos need separate ISRCs |
| GTIN/UPC | $30/single or $250+$50/yr prefix (1–10) | days | gs1us.org |
| PRO (writer/publisher) | ASCAP ~$50/$75 or BMI free-writer (VERIFY) | wks | capture IPI separately |
| ISWC | via PRO/society, small fee | wks | app must NEVER self-issue |
| The MLC | FREE | days | does not replace PRO |
| SoundExchange (performer + owner) | FREE | days | both roles |
| US Copyright | $45 single / $65 std or group (electronic) | wks | copyright.gov |
| Meta Rights Manager / YouTube Content ID eval | FREE | wks | separate applications |

### TABLE D — Open engineering defects (the short tail)
| Issue | Severity | State | First move |
|---|---|---|---|
| ISSUE-1365 follow-up | 🔴 OPEN (root cause found, fix coded, DEPLOY PENDING) | generateimagev3 Firestore writes failing on undefined sessionId | deploy `generateImageV3` + `generateOmniRemixV3`; then generate one image and verify |
| Image jobId reconciliation | backlog | retry after gateway commit pays twice; needs job-receipt contract | design gateway receipt contract |
| ISSUE-1399 | 🟡 MEDIUM | admin magic-link email delivery unproven | founder: check spam, do one real sign-in |
| ISSUE-1168 residual | 🟡 PARTIAL | Vertex postpaid routing + alert policy LIVE; test alert email unsent | send one test alert |
| ISSUE-1400 | 🔴 OPEN | OAuth consent Testing, zero test users | add test users now; publish to production before public launch |
| Tail (~11 PARTIAL + backlogged UX items) | low | eviction cap, storage-url echo, IDB bloat… | own passes; none block launch |

### TABLE E — Business/legal layer (all unchecked in `docs/business-decisions/05_LAUNCH_TIMELINE.md`)
| Item | Cost | Time | Blocks |
|---|---|---|---|
| Fill decision docs 01–03 (identity, AI-copyright stance, pricing) | $0 | ~1.5 hrs founder | everything below |
| Email aliases legal@/privacy@/dmca@/support@ | ~$0 | 10 min | DMCA, ToS |
| DMCA agent registration | small statutory fee (verify) | same day | public offering |
| Attorney brief → attorney → ToS/Privacy | attorney rates | 2–3 wks | public offering |
| Pricing + Stripe products + config | $0 | ~1 hr | charging anyone |

---

## 5. BINDING REPO DISCIPLINE (do not violate)

- Active ledger: `.agent/test_ledger/OPEN_ISSUES_V3.md` — append-only, dated entries. V2 ledger is sealed/archive-only.
- Test/QA agents never modify code; fix agents never run tests. (You may have to wear both hats in a fresh env — record what you did honestly.)
- NEVER substitute placeholder/example identifiers for real-world IDs (DPID, ISRC, GTIN…). Code deliberately fails closed on missing real-world prerequisites. Do not "fix" that.
- Do NOT flip `v1.64.5`/`v1.64.6` back out of prerelease — macOS builds are ad-hoc signed; ShipIt rejects them.
- Do NOT upload manifests to `v1.50.0`; do NOT rebuild/upload unsigned artifacts locally; do NOT un-prerelease bad releases.
- Before ANY commit, verify `git diff --cached --name-only` matches EXACTLY your intended files (shared-index race observed LIVE on 2026-08-23). Use pathspec-limited commits: `git commit --only <paths> -m ...` — by git semantics this cannot include unrelated staged entries, and it avoids lint-staged touching the shared index during another agent's work.
- The working tree currently has a CONCURRENT video-studio workstream with dirty files (deleted remotion/*, modified VideoEditor etc.). Do not commit broadly. Do not `git add -A`. Do not run `git stash`/`git reset` on paths you don't own.
- Commit message style: conventional (`fix(creative): ...`, `fix(release): ...`) referencing issue numbers.

---

## 6. DEFINITION OF "READY TO OFFER" (gate list)

- [ ] Signed+notarized macOS build installs clean & auto-updates (stable feed 200s)
- [ ] Authenticode-signed Windows installer smoke-tested x64+ARM
- [ ] ISSUE-1365 deployed & verified (creative_jobs persisting; usage meters moving)
- [ ] Retry-doesn't-double-charge (job receipts) live
- [ ] ToS/Privacy attorney-reviewed & linked; DMCA agent registered
- [ ] Stripe products live OR explicit free-beta positioning documented
- [ ] EITHER DDEX test delivery succeeded OR distribution via documented partner path (do NOT market "direct-to-DSP" until Table B link 5 has evidence)
- [ ] Founder registrations (Table C) complete enough for first real customer release

---

## 7. KEY FILE MAP

| Area | Path |
|---|---|
| Active issue ledger | `.agent/test_ledger/OPEN_ISSUES_V3.md` |
| Sealed V2 archive | `.agent/test_ledger/archive/OPEN_ISSUES_LEGACY_V2_2026-08-02.md` |
| Founder release checklist (real-world tasks) | `docs/RELEASE_CHECKLIST.md` |
| Launch timeline (business/legal) | `docs/business-decisions/05_LAUNCH_TIMELINE.md` |
| DSP onboarding playbook | `docs/business-decisions/04_DSP_ONBOARDING_PLAYBOOK.md` |
| Creative gateway (Firestore writes) | `packages/firebase/src/functions/creative/gateway.ts` |
| Release workflow (feed checks) | `.github/workflows/release.yml` |
| Updater error copy | `packages/main/src/updater.ts` |
| Firestore rules | `packages/firebase/firestore.rules` |
| Package scripts (build/test/deploy) | `package.json` |
| Top-50 production priorities | `docs/TOP_50_PLATINUM_RELEASE.md` |

---

## 8. VERIFY-DON'T-TRUST

Most claims above come from repo documents and the 2026-08-23 cloud session; the new environment MUST re-run health checks with its own permissions. First commands: `npm run typecheck`, `npm run test:ci`, and `git status` to see the dirty worktree. Then follow Section 3 in order.

---

## 9. SEC-001 CORRECTION (do not re-litigate)

SEC-001 (leaked OAuth secret in git history) is **ALREADY FIXED** — rotated and purged via filter-repo on 2026-07-17, per the July archive. The root `OPEN_ISSUES.md` file still lists it as partial because that root file is a stale pointer. Do not waste cycles re-rotating it.
