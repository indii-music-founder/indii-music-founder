# OPEN_ISSUES append — Release QA findings 2026-07-08

> Written by the Cowork release-QA agent on behalf of William. These entries follow
> OPEN_ISSUES.md house format and continue numbering after ISSUE-766. A fixing/maintenance
> agent should merge them into `.agent/test_ledger/OPEN_ISSUES.md`.

---

### ISSUE-767: Version drift — package.json 1.64.5 vs. checklist release target 1.64.2

- **Status:** 🔴 OPEN
- **Severity:** 🔴 HIGH (release-blocking decision)
- **Evidence:** `package.json` on `main` reads `"version": "1.64.5"`; Founder Release Checklist targets technical updater version `1.64.2`. `.agent/DEPLOYMENT_STATUS_v1.64.4.md` also exists, confirming versions moved past the checklist.
- **Impact:** Release tag, electron-builder artifact names, and updater manifests must agree with package.json. Tagging `v1.64.2` against a 1.64.5 package.json will produce mismatched/failed updater metadata.
- **Action:** Founder decision — pick the shipping version (presumably `v1.64.5` or bump to `v1.64.6`), update checklist, then tag.

---

### ISSUE-768: No v1.64.x GitHub Release exists — updater manifests 404, installed 1.50.0 builds cannot update

- **Status:** 🔴 OPEN
- **Severity:** 🔴 HIGH (release-blocking)
- **Evidence (live probe 2026-07-08):** Latest GitHub release is `v1.50.0` (2026-05-19) with only source archives — no DMG/EXE assets and no `latest-mac.yml` / `latest.yml` / `latest-linux.yml`. All three `releases/latest/download/latest*.yml` URLs return no content.
- **Impact:** electron-updater publish target is this repo's GitHub Releases; every installed build since 1.50.0 has had no update channel.
- **Action:** Blocked behind signing credentials (Apple Developer ID + Windows cert). Once secrets are in Actions, pushing the release tag runs `release.yml`, which builds, publishes assets + manifests, and verifies manifest presence.

---

### ISSUE-769: GCP project `indiios-v-1-1` suspended — decommission and purge references

- **Status:** 🟡 OPEN (cleanup)
- **Severity:** 🟠 MEDIUM
- **Evidence (live probe 2026-07-08):** Firestore call against `indiios-v-1-1` returns 403 `CONSUMER_SUSPENDED` ("Consumer 'projects/indiios-v-1-1' has been suspended").
- **Founder context (William, 2026-07-08):** Suspension followed an agent overrun; the project was deliberately abandoned as a separation from that instance. **All old projects/references relating to v-1-1 can be removed.**
- **Action (coding agent):** grep the repo for `indiios-v-1-1`, `indiiOS-Alpha-Electron`, and related RTDB/hosting URLs; remove or migrate references. Founder action: verify no billing account or DNS is shared with `indii-music-founder`, then delete the GCP/Firebase project.

---

### ISSUE-770: Founder download-gate fields not re-verifiable via Firestore query

- **Status:** 🟡 OPEN (needs live verification)
- **Severity:** 🟠 MEDIUM
- **Evidence (live probe 2026-07-08):** Queries on `users` for `isFounder == true` (boolean and string) and `email == "wiil@indii.music"` all return `[]` on project `indii-music-founder`. Checklist marked the gate verified 2026-06-02.
- **Caveat:** May be an MCP query-tool filter quirk rather than missing data. Needs a manual look in Firestore console (users/{uid}: `tier`, `subscriptionTier`, `isFounder`) or a scripted admin-SDK read before the Founders Version One portal test.

---

### ISSUE-771: Web build ships with `VITE_ENABLE_GOOGLE_MAPS: "false"` while Maps key fixes are in flight

- **Status:** 🟡 OPEN (decision needed)
- **Severity:** 🟢 LOW
- **Evidence:** `deploy.yml` "Build studio app" step sets `VITE_ENABLE_GOOGLE_MAPS: "false"` and already injects `VITE_GOOGLE_MAPS_API_KEY` / `VITE_YOUTUBE_API_KEY` from Actions secrets (ISSUE-765 code-side fix has landed).
- **Impact:** Even after the GCP key gains Geocoding/Places (ISSUE-764) and the secret value is set, hosted web maps stay dark until this flag flips.
- **Action:** Confirm whether the flag is intentionally off for launch; flip to `"true"` when key + secret are verified.

---

## Cost of Doing Business — Founder real-world action items (added 2026-07-08)

Real-world purchases/actions only William can complete. Blockers marked ⛔ gate release features.

| Item | Cost | Blocks | Where |
| --- | --- | --- | --- |
| ⛔ Apple Developer Program (org enrollment; needs D-U-N-S for New Detroit Music LLC) | $99/yr | macOS DMG notarization → Founders release | developer.apple.com/programs/enroll |
| ⛔ Spotify Premium on info@indii.music | ~$12/mo | Spotify Web API dev app creation (new Spotify policy) | spotify.com/premium |
| ⛔ Windows code-signing cert (OV; via cloud signing, e.g. SSL.com eSigner or Azure Trusted Signing) | ~$200–475/yr | Windows Authenticode → Founders release | ssl.com / DigiCert / Azure |
| X (Twitter) API Basic tier — decide ship-or-defer for v1 | ~$200/mo | X posting only | developer.x.com |
| D-U-N-S number for New Detroit Music LLC (prereq for Apple org enrollment) | Free (up to ~30 days) | Apple enrollment | dnb.com/duns |

Status notes (2026-07-08): Meta developer registration blocked at SMS verify (rate-limited; retry after a few hours). Spotify app creation blocked on Premium. GCP Maps/YouTube keys + GitHub secrets completed. `indiios-v-1-1` project deleted (30-day undelete window).

---

*Positive verifications from the same pass (no issues filed): Storage artifacts `founders/releases/indii-Installer.dmg` and `indii-Setup.exe` exist with valid tokens; `release.yml` signing env, manifest verification, and `gcloud storage cp` uploads all correctly wired; Firebase auth/project access healthy on `indii-music-founder`.*
