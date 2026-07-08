# Founders Version One — Release Checklist Onboarding for Coworker

This document breaks down the [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) into discrete, trackable tasks for a coworker to execute independently.

**Release Target:** Founders Version One (v1.64.2)  
**Scope:** 3 task streams: Desktop code signing, Google APIs (Maps + YouTube), Social platform registrations  
**Timeline:** ~3-6 weeks (bottlenecked by social platform app review cycles: Meta ~2-4 weeks, TikTok ~1-3 weeks)

---

## Task Streams (Work in Parallel Where Possible)

### Stream A: Desktop Code Signing & Notarization (Sequential, 2-3 days)

**Owner:** Anyone with access to Apple Developer account + Microsoft code signing certificates  
**Timeline:** 2-3 days (mostly waiting for Apple notarization to complete)  
**Blockers:** None (independent)

| Task | Effort | Details | Status |
|------|--------|---------|--------|
| **A1** — Verify Apple Developer Program membership | 15 min | Check Apple Developer Program status for New Detroit Music LLC. Confirm active subscription. | ☐ |
| **A2** — Create/locate Developer ID Application certificate | 30 min | In Apple Developer Console → Certificates → create "Developer ID Application" certificate for macOS distribution. Download & install to local keychain. | ☐ |
| **A3** — Verify codesigning identity in keychain | 10 min | Run: `security find-identity -v -p codesigning` — should show `Developer ID Application: New Detroit Music LLC` | ☐ |
| **A4** — Set up App Store Connect notarization credentials | 45 min | Create App Store Connect API key (preferred) OR use Apple ID + app-specific password. Save issuer ID, key ID, app-specific password securely. | ☐ |
| **A5** — Add credentials to local environment (DEV MACHINE ONLY) | 20 min | In `.env` or `~/.zprofile`: export `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` (or `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Do NOT commit to git. | ☐ |
| **A6** — Add credentials to GitHub Actions secrets | 20 min | In repo Settings → Secrets → add the same 3-4 secrets. See `.github/workflows/deploy.yml` for exact names. | ☐ |
| **A7** — Rebuild macOS DMG and verify notarization | 30 min (+ 10-30 min wait) | Run `npm run build:desktop:mac`. After build, run: `spctl -a -t open --context context:primary-signature -vv dist-electron/*.dmg` and `xcrun stapler validate dist-electron/*.dmg`. Both must pass. | ☐ |
| **A8** — Smoke test on clean Mac | 30 min | On a clean Mac (or VM): download the notarized DMG, open it, drag indii.music to Applications, launch. Verify no Gatekeeper warning beyond first-run consent. | ☐ |
| **B1** — Acquire Windows code signing certificate | 1-2 days | Purchase or provision EV/OV certificate (e.g., from Sectigo, DigiCert). Download as `.p12` or use cloud signing provider (e.g., SignTool). | ☐ |
| **B2** — Add Windows signing credentials to local environment | 20 min | Export: `WIN_CSC_LINK` (path to `.p12`) and `WIN_CSC_KEY_PASSWORD` to local `.env`. Do NOT commit. | ☐ |
| **B3** — Add Windows credentials to GitHub Actions secrets | 15 min | Same names as above in repo Secrets. | ☐ |
| **B4** — Rebuild Windows installers and verify signature | 30 min | Run `npm run build:desktop:win`. On Windows machine, run: `Get-AuthenticodeSignature ".\indii.music Setup <version>-x64.exe"` — must show valid signature. | ☐ |
| **B5** — Smoke test x64 installer on Windows 10/11 | 20 min | Run installer, launch app, verify it launches as "indii.music" with ii icon. | ☐ |
| **B6** — Smoke test ARM64 installer (if applicable) | 20 min | If ARM64 build exists: test on ARM Windows VM or device. Verify launch. | ☐ |

**Completion Criteria for Stream A:**
- ✓ macOS DMG passes both `spctl` and `xcrun stapler` validation
- ✓ Windows EXE has valid authenticode signature
- ✓ Both installers launch the app on their respective OS

---

### Stream B: Google Cloud Console — Maps & API Keys (Sequential, 2-4 hours)

**Owner:** Anyone with GCP Console access to indii-music-founder project  
**Timeline:** 2-4 hours (mostly configuration, no approvals needed)  
**Blockers:** None (independent)  
**Note:** William (founder) may need to verify some GCP permissions or authorize Geocoding API enablement

| Task | Effort | Details | Status |
|------|--------|---------|--------|
| **C1** — Locate Maps API key in GCP Console | 15 min | GCP Console → APIs & Services → Credentials. Find the key used as `VITE_GOOGLE_MAPS_API_KEY` in `.env` (visible in the key's name or identifier). | ☐ |
| **C2** — Enable Geocoding API for the key | 20 min | Same Credentials page → click the key → scroll to "API restrictions" → ADD "Geocoding API". Ensure it's in the allowed APIs list. | ☐ |
| **C3** — Enable Places API for the key | 20 min | Same page → ADD "Places API" to the allowed APIs list. | ☐ |
| **C4** — Verify key restrictions are still applied | 10 min | Check that key is NOT set to "Unrestricted". Should show "HTTP referrers" or "IP addresses" restriction (specific to your setup). Document the restriction type. | ☐ |
| **C5** — Decide Electron referrer strategy | 30 min | **Decision point:** The packaged desktop app sends no HTTP referer, so a referrer-restricted key may throw `RefererNotAllowedMapError` at runtime. Options: (a) Create a **separate Maps key** for Electron with IP/none restriction, (b) Update existing key's restrictions to allow Electron, (c) Use a server-side proxy (not recommended). **Recommendation:** Option (a) — separate key avoids cross-platform conflicts. If (a), create second key, set IP restriction to Electron app's IP range or use "none", and add to `.env` as `VITE_GOOGLE_MAPS_API_KEY_ELECTRON`. | ☐ |
| **C6** — Create dedicated YouTube Data API key (if separate key needed) | 30 min | In GCP Console, create NEW API key. Restrict to "YouTube Data API v3" ONLY (not all Google APIs). Store as `VITE_YOUTUBE_API_KEY` in `.env`. If not doing this, the code falls back to Firebase API key (which is referrer-restricted, so may fail from Electron). | ☐ |
| **C7** — Verify Maps secret in Firebase Functions | 10 min | Run in CLI: `firebase functions:secrets:access GOOGLE_MAPS_API_KEY`. Should return the same key value from `.env`. If blank or missing, functions will fail. Contact William if missing. | ☐ |
| **C8** — Verify Vertex AI endpoint sync is current | 20 min | **Action point for William or cloud expert.** Run: `gcloud ai tuning-jobs list --project=indii-music-founder`. Compare the returned job IDs and endpoints to the ones hardcoded in `packages/renderer/src/services/agent/fine-tuned-models.ts`. If they differ, a re-sync is needed (see Anti-Pattern #9 in `docs/PLATINUM_QUALITY_STANDARDS.md`). Document findings. | ☐ |

**Completion Criteria for Stream B:**
- ✓ Geocoding API + Places API enabled on Maps key in GCP
- ✓ Key restrictions verified (not unrestricted)
- ✓ Electron referrer strategy decided and documented
- ✓ YouTube key created (or fallback documented as intentional)
- ✓ Firebase secret verified accessible
- ✓ Vertex endpoint sync status verified (report to William)

---

### Stream C: Social Platform Developer Registrations (Parallel, ~4 weeks + app review cycles)

**Owner:** Anyone with access to Meta, TikTok, X, Spotify, and Google developer accounts  
**Timeline:** ~4 weeks (2-4 week bottleneck on Meta + TikTok app reviews; X and Spotify faster)  
**Blockers:** Each platform is independent; work in parallel where possible

#### Platform 1: Meta (Instagram/Facebook) — **Longest approval cycle** (~2-4 weeks)

| Task | Effort | Notes | Status |
|------|--------|-------|--------|
| **D1** — Create Meta Developer app | 30 min | Go to developers.facebook.com → Create App → choose "Business" type. Name: "indii Music Creator Tools". | ☐ |
| **D2** — Enable Instagram Graph API | 30 min | In app dashboard → Add Products → select "Instagram Graph API". | ☐ |
| **D3** — Request `instagram_content_publish` permission | 1 hour | App dashboard → Permissions → request `instagram_content_publish` and `pages_manage_posts`. Document the permission request. | ☐ |
| **D4** — Submit app for Meta App Review | 4 weeks | Submit screencast of posting flow (account connect → compose post → publish to Instagram). Meta review is ~2-4 weeks. Status tracked in App Review tab. | ☐ |
| **D5** — Store credentials after approval | 20 min | Once approved: extract `APP_ID` and `APP_SECRET` from dashboard. Store securely (see credentials storage below). | ☐ |

#### Platform 2: TikTok — **Second longest approval cycle** (~1-3 weeks)

| Task | Effort | Notes | Status |
|------|--------|-------|--------|
| **E1** — Register TikTok for Developers account | 30 min | Go to developers.tiktok.com → sign up with company email. | ☐ |
| **E2** — Create developer app | 30 min | Developer dashboard → Apps → Create an App. Name: "indii Music Creator Tools". | ☐ |
| **E3** — Request Content Posting API access | 1 hour | Request access to "Content Posting API" (separate request from base app). Submit description of posting feature + use case. | ☐ |
| **E4** — Submit for TikTok approval | 1-3 weeks | TikTok reviews the Content Posting API request (~1-3 weeks). Status tracked in App dashboard. | ☐ |
| **E5** — Store credentials after approval | 20 min | Extract `CLIENT_KEY` and `CLIENT_SECRET`. Store securely. | ☐ |

#### Platform 3: X (Twitter) — **Requires paid tier**

| Task | Effort | Notes | Status |
|------|--------|-------|--------|
| **F1** — Verify X Developer account is active | 20 min | Go to developer.twitter.com → log in. If no account, create one. | ☐ |
| **F2** — Create developer project | 30 min | Developer portal → Projects → Create Project. Name: "indii Music Creator Tools". | ☐ |
| **F3** — Request API v2 access | 1 hour | Project dashboard → API access → request "Elevated" tier (required for posting). Note: **requires paid Basic tier (~$100/mo)**. | ☐ |
| **F4** — **DECISION: Ship or defer posting?** | — | Posting via X API v2 requires paid Basic tier. **Decision point:** Is X posting in v1, or deferred? If deferred, skip F5-F6. If shipping, proceed. | ☐ DEFER / ☐ SHIP |
| **F5** — Subscribe to Basic tier (if shipping) | 15 min | X dashboard → Billing → subscribe to "Basic" tier (~$100/mo). Add payment method. | ☐ |
| **F6** — Store credentials after tier activated | 20 min | Extract `CLIENT_ID` and `CLIENT_SECRET` from dashboard. Store securely. | ☐ |

#### Platform 4: Spotify for Artists

| Task | Effort | Notes | Status |
|------|--------|-------|--------|
| **G1** — Create Spotify Developer account | 20 min | Go to developer.spotify.com → sign up. | ☐ |
| **G2** — Create app in Spotify Dashboard | 30 min | Dashboard → Create an App. Name: "indii Music Creator Tools". Accept terms. | ☐ |
| **G3** — Request extended quota mode | 1 week | In app dashboard → Request extended quota (default dev mode caps at 25 users; production mode allows unlimited). Submit use case description. Spotify reviews ~1 week. | ☐ |
| **G4** — Store credentials | 20 min | Extract `CLIENT_ID` and `CLIENT_SECRET`. Store securely. | ☐ |

#### Platform 5: Google OAuth (YouTube upload + Gmail)

| Task | Effort | Notes | Status |
|------|--------|-------|--------|
| **H1** — Verify Google OAuth app exists in GCP | 20 min | GCP Console → APIs & Services → Credentials. Look for OAuth 2.0 Client ID (type: Web Application). If not present, create one: Credentials → Create → OAuth client ID. | ☐ |
| **H2** — Add YouTube upload scope | 30 min | OAuth app → Scopes section → ensure `https://www.googleapis.com/auth/youtube.upload` is included. | ☐ |
| **H3** — Complete OAuth consent screen verification | 2 weeks | GCP Console → OAuth consent screen → set to "External" user type (required for external users to authorize). Submit for Google review (~2 weeks for "sensitive" scopes like YouTube). | ☐ |
| **H4** — Store credentials | 20 min | Extract `CLIENT_ID` and `CLIENT_SECRET`. Store securely. | ☐ |

#### Credentials Storage Protocol (All Platforms)

| Task | Effort | Notes | Status |
|------|--------|-------|--------|
| **I1** — Set up secure credential storage | 30 min | **DO NOT store in `.env`, `.git`, or anywhere in the repo.** Use a password manager (e.g., 1Password, LastPass, Bitwarden) shared with William. Document each credential with: platform, type (client_id vs. client_secret), date created, expiration (if applicable). | ☐ |
| **I2** — Inject client IDs into `.env` (development only) | 20 min | After registering: for DEV MACHINE ONLY, add client IDs to `.env`: `VITE_META_APP_ID=...`, `VITE_TIKTOK_CLIENT_KEY=...`, `VITE_GOOGLE_OAUTH_CLIENT_ID=...` (etc.). Do NOT commit. | ☐ |
| **I3** — Store client secrets in Firebase Functions secrets | 30 min | Use Firebase CLI to inject server-side secrets: `firebase functions:secrets:set META_APP_SECRET "value"` (repeat for each secret: SPOTIFY_CLIENT_SECRET, TIKTOK_CLIENT_SECRET, TWITTER_CLIENT_SECRET, GOOGLE_OAUTH_CLIENT_SECRET). | ☐ |
| **I4** — Add client IDs to GitHub Actions secrets (CI) | 30 min | In repo Settings → Secrets → add `VITE_META_APP_ID`, `VITE_TIKTOK_CLIENT_KEY`, `VITE_GOOGLE_OAUTH_CLIENT_ID`, etc. These are public identifiers; it's safe to commit them as secrets for CI to access. | ☐ |

**Completion Criteria for Stream C:**
- ✓ All 5 platforms have registered developer apps
- ✓ Each platform's permissions / API access requested
- ✓ Approvals received (or deferrals documented, e.g., X tier decision)
- ✓ Credentials extracted and stored securely
- ✓ Client IDs in `.env` (dev) and GitHub Actions secrets (CI)
- ✓ Client secrets in Firebase Functions secrets
- ✓ `SOCIAL_POSTING` feature flag flipped to `true` (only after real credentials are in place)

---

## Dependency Graph

```
Stream A (Desktop Signing):
  A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8
  B1 → B2 → B3 → B4 → B5 → B6

Stream B (Google APIs):
  C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8

Stream C (Social Platforms):
  D1 → D2 → D3 → D4 → D5     (parallel to E, F, G, H)
  E1 → E2 → E3 → E4 → E5     (parallel to D, F, G, H)
  F1 → F2 → F3 → [F4 DECISION] → {F5 → F6 | SKIP}  (parallel to D, E, G, H)
  G1 → G2 → G3 → G4          (parallel to D, E, F, H)
  H1 → H2 → H3 → H4          (parallel to D, E, F, G)
  All platforms → I1 → I2 → I3 → I4 (convergence)

Overall:
  [ A, B, C in parallel ] → Final: flip SOCIAL_POSTING flag + rebuild
```

---

## Effort Summary

| Stream | Est. Hours | Timeline | Blocking Factor |
|--------|-----------|----------|-----------------|
| **A** (Desktop) | 4 hours | 2-3 days | Apple notarization turnaround (~10-30 min) |
| **B** (Google APIs) | 2-4 hours | 1-2 hours work + verification | William's Vertex endpoint check (optional) |
| **C** (Social) | 10-15 hours | **3-6 weeks** | Meta app review (~2-4 wk), TikTok (~1-3 wk), H3 Google consent (~2 wk) |
| **TOTAL** | ~16-23 hours | ~**4 weeks** | Social platform approvals |

---

## Sign-Off Checklist

Once all tasks are complete, verify:

- [ ] Desktop DMG is notarized and passes Apple validation
- [ ] Windows installers are signed and verified
- [ ] Maps key has Geocoding + Places APIs enabled
- [ ] YouTube key created (or fallback documented)
- [ ] Vertex endpoint sync verified current
- [ ] All 5 social platforms registered and approved (or deferrals documented)
- [ ] Credentials securely stored and injected into right locations (dev, CI, Firebase)
- [ ] `SOCIAL_POSTING` feature flag enabled (if all platforms live)
- [ ] Rebuild desktop app and verify no errors
- [ ] All tests pass: `npm test -- --run`
- [ ] Final build succeeds: `npm run build`

**Sign-off date:** ________________  
**Signed by (coworker):** ________________  
**Verified by (William):** ________________

---

## Reference Links

- **RELEASE_CHECKLIST.md** (original): [docs/RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
- **GCP Console:** https://console.cloud.google.com/
- **Firebase CLI:** `firebase functions:secrets --help`
- **Meta Developers:** https://developers.facebook.com/
- **TikTok Developers:** https://developers.tiktok.com/
- **X Developers:** https://developer.twitter.com/
- **Spotify Developers:** https://developer.spotify.com/
- **Google Developers:** https://console.developers.google.com/
- **Apple Developer:** https://developer.apple.com/
- **Code signing reference:** See `docs/PLATINUM_QUALITY_STANDARDS.md` §9 (no hardcoded infrastructure IDs)

---

## Questions or Blockers?

If stuck on any task:
1. Check the linked reference docs
2. Look for the task's "Details" column in the table (contains step-by-step instructions)
3. If still blocked, tag William with the task number and blocker type

**Good luck! 🚀**
