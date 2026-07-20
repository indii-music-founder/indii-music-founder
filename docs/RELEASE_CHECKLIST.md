# Founder Release Checklist

Use this internal checklist to verify the Founder release artifacts (macOS DMG and Windows NSIS EXE) before and after deployment. Founders do not see this document; it is for release QA.

## 🔴 LIVE INCIDENT (ISSUE-992, 2026-07-10) — stable macOS update channel is empty

`v1.64.6` and `v1.64.5` were both confirmed ad-hoc signed (`codesign -d` reports
`Signature=adhoc`, `TeamIdentifier=not set`, no `_CodeSignature/CodeResources`).
ShipIt correctly refuses to install either — any user offered one of these
versions enters a repeat download/fail loop. Both were flipped to **prerelease**
on GitHub (reversible, nothing deleted) so the update feed stops serving them;
`v1.50.0` is now the resolved "latest" as an interim fallback — its signing
status is **unverified**, not confirmed good.

**This will keep happening on every future tag** until the items in
"Apple Developer ID / macOS Notarization" below are actually completed — the
release workflow (`.github/workflows/release.yml`) now fails the macOS build
outright if `MAC_CERTIFICATE_P12_BASE64`/`CSC_LINK`, `CSC_KEY_PASSWORD`,
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, or `APPLE_TEAM_ID` are missing, and
verifies `codesign --verify --deep --strict`, `spctl --assess`, and
`xcrun stapler validate` against the exact artifact before it can be published.
No further ad-hoc build can reach the update feed — but that also means **no
new macOS release can ship at all** until real signing secrets are added.

- [ ] Complete every item in "Apple Developer ID / macOS Notarization" below.
- [ ] Add the 5 required secrets to GitHub Actions repo secrets.
- [ ] Cut a new tag once secrets are in place; confirm the release workflow's
      verification step passes before trusting the release.
- [ ] Once a verified signed release exists, decide whether to leave
      `v1.64.6`/`v1.64.5` as prerelease permanently or delete them.

## Human Action Items — Desktop Signing & Notarization

These are real-world account/certificate tasks that an agent cannot complete
without the founder's Apple/Microsoft accounts and private signing material.

### Apple Developer ID / macOS Notarization

- [ ] Confirm New Detroit Music LLC / indii has an active Apple Developer Program membership.
- [ ] In Apple Developer, create or verify a **Developer ID Application** certificate for macOS distribution outside the App Store.
- [ ] Install the Developer ID Application certificate and its private key in the macOS login keychain on the build machine.
- [ ] Confirm `security find-identity -v -p codesigning` shows a `Developer ID Application: ...` identity, not only `Apple Development: ...`.
- [ ] Create App Store Connect notarization credentials. Preferred: App Store Connect API key with issuer ID and key ID. Alternate: Apple ID + app-specific password + team ID.
- [ ] Add notarization credentials to the local build environment and GitHub Actions secrets:
  - `APPLE_API_KEY`
  - `APPLE_API_KEY_ID`
  - `APPLE_API_ISSUER`
  - or `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`
- [ ] Rebuild the macOS DMG after the Developer ID cert and notarization credentials are available.
- [ ] Verify the notarized DMG with:
  - `spctl -a -t open --context context:primary-signature -vv dist-electron/<artifact>.dmg`
  - `xcrun stapler validate dist-electron/<artifact>.dmg`
- [ ] Confirm the DMG opens on a clean Mac without a Gatekeeper warning beyond the normal first-launch confirmation.

### Windows Code Signing

- [ ] Purchase or provision a Windows code-signing certificate for the company. OV is acceptable; EV is stronger for SmartScreen reputation.
- [ ] Store the Windows signing certificate securely as a `.p12`/`.pfx` plus password, or use a supported cloud signing provider.
- [ ] Add Windows signing credentials to local environment and GitHub Actions secrets:
  - `WIN_CSC_LINK`
  - `WIN_CSC_KEY_PASSWORD`
- [ ] Rebuild the Windows NSIS installers after signing credentials are configured.
- [ ] Verify the EXE signature on a Windows machine with PowerShell:
  - `Get-AuthenticodeSignature ".\indii.music Setup <version>-x64.exe"`
- [ ] Smoke test the x64 installer on Windows 10/11 and confirm the app launches as `indii.music` with the `ii` icon.
- [ ] Smoke test the ARM64 installer on a Windows ARM device or VM before publishing it as a supported artifact.

### DDEX Sender Party ID (ISSUE-859 / ISSUE-861, added 2026-07-10)

The DDEX ERN generators (`ddex-generator.ts`, MCP `draft_dsp_metadata_xml`) now fail
closed instead of emitting a hard-coded/placeholder sender `PartyId` — they require
`DDEX_SENDER_PARTY_ID` as a Firebase Functions runtime env var.

- [ ] **Resolve a DPID discrepancy found while fixing this**: the repo has TWO different
  values on file for indii's registered sender DPID — `PA-DPIDA-2025122604-E`
  (`distributors.ts`, `DeliveryProfile.ts`) vs `PA-DPIDA-2025122601-E`
  (`verify-adapters.test.ts`). Verify the real value at dpid.ddex.net and correct
  whichever file is wrong.
- [ ] Set `DDEX_SENDER_PARTY_ID` (the confirmed value, digits-only party id form
  e.g. `PADPIDA2025122604E`, matching the format DDEX XML expects — no dashes)
  as a Firebase Functions runtime env var / secret. Until set, DDEX compilation
  and the MCP metadata draft tool both throw `failed-precondition`.

### Direct DDEX Delivery Activation (ISSUE-784, added 2026-07-20)

The application deliberately fails closed until these real-world prerequisites
exist. Do not substitute example identifiers, downloaded schema copies of
unknown provenance, or a local packaging result for partner authorization.

**Recommended order:** establish the DDEX identity and licence first, select
the recipient and its delivery profile second, then run one non-commercial
test delivery. Do not configure production transport credentials until the
recipient has supplied its test/onboarding instructions.

**Bring to the DDEX/partner conversation:** legal company name and address,
primary business and technical contacts, the label/distributor role indii will
perform, intended recipient(s), a non-commercial test release, and confirmation
that indii controls the sound-recording master and cover art for that test.
This avoids a technical integration being delayed by an ownership or contact
verification question.

- [ ] Accept the DDEX Implementation Licence and retain the licensed ERN 4.3
  and any recipient choreography/profile XSD packages in the approved secure
  configuration location. Record licence version, effective date, download
  source, and SHA-256 of each received XSD/archive. DDEX says the ERN message
  XSD and allowed-values XSD must be validated together; use the recipient's
  requested profile, not merely a generic schema pass. [DDEX validation
  guidance](https://kb.ddex.net/general-implementation-guidance/validating-ddex-messages/offline-xml-validation/)
- [ ] Confirm the company sender DPID at DDEX and resolve the two historical
  repository values before configuring it. The DPID is allocated with the
  implementation licence; check the DDEX registry/email, record the
  human-readable form and the hyphen-free XML form, and identify the person
  responsible for keeping the registry record current. Store only the
  confirmed runtime value in the approved secret/environment path. [DPID
  guidance and application](https://kb.ddex.net/general-implementation-guidance/licensing-the-standards/ddex-party-identifier-%28dpid%29/)
- [ ] Obtain the recipient/partner DPID, endpoint, transport credentials, and
  applicable delivery-profile requirements directly from the intended partner.
  Ask explicitly for: the ERN/profile version, test-versus-live flag rules,
  XML/file naming and package-directory conventions, required resource codecs
  and artwork specifications, territories/deal data, acknowledgement/error
  channel, retry/idempotency rules, and their support escalation contact.
  Store credentials in the approved secret manager—never in a release draft,
  local `.env`, chat, or source control.
- [ ] Choose and approve a non-commercial test release whose master and cover
  art may be transmitted. Confirm it has the required rights evidence and
  partner-approved metadata before testing. Prepare a one-page test-release
  packet with release title, UPC, track title, ISRC, artist/label, release date,
  territories, rights holder, master hash, cover-art hash, and a named internal
  approver. Do not use a client or unreleased artist's work without written
  permission for this transmission.
- [ ] Prepare the test cover as a square **JPEG or PNG**, at least **3000 ×
  3000 px**, and no more than **50 MB**. Select it from the artist's brand
  assets in the app: the app content-addresses it under the authenticated
  owner, makes that object create-once, and measures the bytes again before it
  enters the DDEX package. Keep the original design/source file and written
  artwork-use permission with the release evidence; the package hash proves
  delivery identity, not copyright ownership.
- [ ] Submit one controlled package through the configured partner route and
  retain the partner acknowledgement/rejection, timestamp, package hash,
  sanitized correlation ID, and any validation report in the release evidence
  record. If it fails, retain the original rejection verbatim and open an
  engineering issue against the exact validation code—do not alter source data
  just to make the package appear accepted.
- [ ] Confirm the partner accepted both the ERN package and every required
  resource (canonical master and cover art). Only that acknowledgement closes
  the external acceptance portion of ISSUE-784.

#### Evidence bundle to save after the test

Create one access-controlled evidence folder per recipient/test release. Save
the following; redact credentials, private keys, SFTP hostnames, and personal
contact details before attaching anything to a ticket:

- [ ] DDEX licence/DPID allocation confirmation and registry update owner.
- [ ] Recipient onboarding/profile document and the exact XSD/AVS versions.
- [ ] Sanitized test-release packet and written approval to transmit it.
- [ ] ERN XML SHA-256, resource filenames/hashes, validation output, and
  package manifest hash.
- [ ] Submission timestamp, partner correlation/reference ID, and the complete
  acknowledgement or rejection.
- [ ] A short outcome note: **accepted**, **rejected**, or **transport failed**;
  recipient; environment (test/live); and the next owner/action.

**Definition of done:** DDEX allocation is real and recorded; code is configured
with the confirmed sender identity and recipient profile; the same canonical
audio/cover-art resources referenced in the package were received; and the
recipient's acknowledgement is retained. An XML file in Cloud Storage, an XSD
pass, or a successful SFTP connection alone is *not* delivery acceptance.

### Intellectual Property & Value Evidence (added 2026-07-20)

The platform's code, brand, operational know-how, datasets, and customer music
rights are different asset classes. Do not treat an uploaded master, a generated
image, a model output, or a repository commit as company-owned IP without
evidence. The living record is [the IP asset register](data-room/13_IP_ASSET_REGISTER.md).

- [ ] File or locate the executed founder IP assignment and every contractor or
  contributor assignment; store the documents in the controlled legal evidence
  location and record only their references in the IP register.
- [ ] Record domain registrar ownership/recovery contacts and complete a
  trademark search/filing decision for the `indii` marks with counsel.
- [ ] Before using any non-public dataset for model tuning, retrieval, or
  sharing, record its source, permission/licence, permitted purpose, retention,
  and removal path in the IP register.
- [ ] For every commercially released recording, preserve distinct master and
  composition rights evidence, split approvals, sample clearances, and any
  registration/delivery acknowledgements. Customer catalog is not platform IP
  unless there is a specific written transfer.
- [ ] For each composition that needs an ISWC, submit or confirm the work through
  the applicable PRO/CISAC-authorized process; retain the assigning society,
  date, official work title/composer match, ISWC confirmation/reference, and
  any conflict correspondence. A code entered in the app is only a draft claim
  until that evidence exists; do not represent it to an investor, partner, or
  royalty service as registered without the confirmation record.
- [ ] Run and save a current dependency-licence report before investor,
  acquisition, or major commercial diligence; route non-permissive or unclear
  results to counsel.

#### Founder investor-room IP packet

Prepare this packet before a diligence meeting. Keep originals and sensitive
documents in the controlled legal data room; the repository and investor
materials should contain only a redacted reference, date, and owner.

- [ ] **Chain of title:** executed founder and contributor assignments; entity
  name, execution dates, signatories, scope, and legal-evidence location.
- [ ] **Brand and domains:** registrar ownership/recovery proof, renewal dates,
  DNS/MFA operator, trademark search result, filing/registration numbers,
  jurisdictions/classes, and known conflicts.
- [ ] **Software and vendors:** dependency-licence report at a named commit,
  material provider terms, transfer/assignment limits, key-person accounts,
  and a remediation owner for every exception.
- [ ] **Data and AI:** dataset inventory; source/permission/allowed-use/
  retention/deletion evidence; model/provider terms; and a clear statement
  that provider weights and customer prompts/uploads are not company-owned by
  default.
- [ ] **Customer music and rights:** per-release master/composition ownership,
  split and sample evidence, territories/terms, registrations and delivery
  acknowledgements. Never add customer catalog to platform-IP value without an
  executed, rights-specific transfer.
- [ ] **Room-ready index:** a one-page mapping from each material asset ID in
  `docs/data-room/13_IP_ASSET_REGISTER.md` to its redacted evidence reference,
  restriction, review state, and the person accountable for the next proof.
- [ ] **Answer rehearsal:** be able to state, for each material asset: what it
  is; who controls it; what supports that statement today; why it matters; what
  it does *not* prove; and the exact next action if evidence is incomplete.

### Mobile Studio executor attestation (ISSUE-1025 residual hardening)

The Controller cannot self-publish Studio presence or claim Studio commands:
those actions already require a short-lived server-verified executor lease. The
remaining real-world decision is how first enrollment proves that the caller is
an approved installed Studio rather than merely another same-account client.

- [ ] Choose the trust mechanism with security counsel/engineering: a
  notarized-code-signing challenge, managed-device certificate/MDM identity, or
  another server-verifiable credential appropriate to supported desktop
  platforms. Do not describe a browser cookie, MAC address, or a client-supplied
  device ID as hardware attestation.
- [ ] Define enrollment eligibility, revocation, rotation, recovery after a
  lost/replaced machine, lease lifetime, audit-log retention, and the person
  allowed to approve a new Studio device.
- [ ] Store the issuer configuration and public verification material in the
  approved secret/configuration system; keep device identifiers, enrollment
  secrets, and challenge responses out of Git, Firestore client documents, and
  investor materials.
- [ ] Test enrollment, lease renewal, expired/revoked credential rejection, and
  a second same-account browser attempting to impersonate Studio. Retain a
  redacted test record with date, build/revision, operator, and result.

### Google Cloud Console — Maps & API Keys (ISSUE-764 / ISSUE-765, added 2026-07-08)

These are GCP Console settings changes an agent cannot make. The code-side fixes
(vite config unstrip, deploy.yml secret) are tracked separately in the ledger.

- [x] In GCP Console → APIs & Services → Credentials, open the Maps API key (`VITE_GOOGLE_MAPS_API_KEY` in `.env`) and ADD **Geocoding API** and **Places API** to its allowed-API list. Keep it restricted — do NOT switch to unrestricted. (Live probe 2026-07-07: Geocoding → REQUEST_DENIED, Static Maps → 403; only Maps JavaScript API is enabled.)
- [ ] Decide the Electron referrer strategy for the Maps key: the packaged desktop app sends no HTTP referer, so a referrer-restricted key throws `RefererNotAllowedMapError`. Options: separate key for desktop with IP/none restriction, or loosen referrer rules on the existing key. Verify in the packaged desktop build, not the web app.
- [x] Verify the Firebase Functions secret exists and holds a Geocoding-enabled key: `firebase functions:secrets:access GOOGLE_MAPS_API_KEY` (used server-side by the `findPlaces` touring callable).
- [x] Create a **dedicated YouTube Data API key** (service separation — the code currently reuses the Firebase key, which is referrer-blocked from Electron and violates API Credentials Policy §3.2.3). Add it as `VITE_GOOGLE_YOUTUBE_API_KEY` once the code fix lands.
- [x] Add `VITE_GOOGLE_MAPS_API_KEY` as a GitHub Actions repo secret so the hosted web build gets the key (deploy.yml injection is a code-side fix, but the secret value must be created by you).
- [x] Vertex AI: re-verify the 20 fine-tuned agent endpoints against the live tuningJobs API (registry last synced 2026-06-21; Anti-Pattern #9 protocol). Requires `gcloud auth login` on the machine running the check.

### Cloud Deployment & Production-Evidence Access

Live verification of private Cloud Run services, Cloud Tasks, Firebase Functions,
and production receipts requires an active Google Cloud user session. This is an
operator-access prerequisite, not a reason to weaken service authentication or
to paste credentials into source control or chat.

- [ ] Before a production verification/deployment session, run `gcloud auth login`
  on the operator machine and select the company account with access to
  `indii-music-founder`; confirm `gcloud config get-value project` returns
  `indii-music-founder`.
- [ ] Maintain the equivalent Firebase CLI session with `firebase login --reauth`
  when a scoped Functions/Rules deployment is needed. Complete browser/device
  authorization in the terminal/browser flow; never paste one-time OAuth codes
  into project files, release records, or investor materials.
- [ ] Save the date, operator, target project, deployed revision/function
  names, and redacted proof result in the relevant release evidence record.
  Do not record bearer tokens, service-account keys, task bodies containing
  private media references, or customer audio.

### Social Platform Developer Registrations (ISSUE-766, added 2026-07-08)

The full posting pipeline (X/Twitter, Instagram, TikTok, YouTube, Spotify) is built,
but every credential is a `MOCK_KEY_DO_NOT_USE` placeholder. No social feature works
until these developer apps exist. Each requires the company's accounts and, in several
cases, a platform review process — start these early, approvals take days to weeks.

- [ ] **Meta (Instagram/Facebook):** create a Meta developer app for New Detroit Music LLC; enable Instagram Graph API; request `instagram_content_publish` + pages permissions (requires Meta App Review with a screencast of the posting flow). Store `META_APP_ID` / `META_APP_SECRET`.
- [ ] **TikTok:** register a TikTok for Developers app; apply for the **Content Posting API** (separate TikTok approval). Store `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.
- [ ] **X / Twitter:** create a developer project; posting via API v2 requires the **paid Basic tier** (~$100/mo) — decide if X posting ships in v1 or is deferred. Store client id/secret.
- [ ] **Spotify:** create a Spotify developer app (client id/secret); request extended quota mode before public launch (dev mode caps at 25 users).
- [ ] **Google OAuth (YouTube upload + Gmail):** in GCP Console, create/verify the OAuth client (`VITE_GOOGLE_OAUTH_CLIENT_ID` exists in `.env`); add YouTube upload scope; complete OAuth consent-screen verification for external users (Google review required for sensitive scopes).
- [ ] After each registration: set the SECRET half only as Firebase Functions secrets (`firebase functions:secrets:set META_APP_SECRET` etc. — never in `.env` VITE_ vars or the repo), and the public client id half in `.env` + GitHub Actions secrets.
- [ ] When all target platforms have real credentials, tell the coding agent to flip the `SOCIAL_POSTING` feature flag and run a live test post per platform.

## Current Release Target

Public release identity: **Founders Version One**.

Technical updater version: **1.64.5**.

- [x] Push a `v1.64.5` release tag after local validation is complete.
- [x] Verify GitHub Release `v1.64.5` includes platform installers and updater manifests:
  - `latest-mac.yml`
  - `latest.yml`
  - `latest-linux.yml`
- [x] Confirm each manifest URL returns `200` before calling Founders Version One live.

## Current Local Verification Snapshot

Last verified: 2026-06-04 EDT.

- [x] Local macOS DMG exists at `dist-electron/indii.music-1.64.1-arm64.dmg` with size `159276019` bytes.
- [x] Local macOS ZIP exists at `dist-electron/indii.music-1.64.1-arm64-mac.zip` with size `152819025` bytes.
- [x] Local Windows x64 installer exists at `dist-electron/indii.music Setup 1.64.1-x64.exe` with size `131219746` bytes.
- [x] Local Windows ARM64 installer exists at `dist-electron/indii.music Setup 1.64.1-arm64.exe` with size `132182244` bytes.
- [x] Local combined Windows installer exists at `dist-electron/indii.music Setup 1.64.1.exe` with size `262709448` bytes.
- [x] macOS DMG passes `hdiutil verify`.
- [x] Installed macOS app exists at `/Applications/indii.music.app`.
- [x] Desktop shortcut exists at `~/Desktop/indii.music.app` and points to `/Applications/indii.music.app`.
- [x] Installed macOS app bundle uses `CFBundleDisplayName=indii.music`, `CFBundleIdentifier=com.indii.music`, and `CFBundleIconFile=icon.icns`.
- [x] Windows unpacked payloads identify as x86-64 and Aarch64 executables.
- [ ] macOS DMG is notarized and stapled. Blocked until Developer ID Application certificate and notarization credentials are available.
- [ ] Windows installers are verified with Authenticode on Windows. Blocked until Windows code-signing certificate is available.
- [ ] Founders Version One / `1.64.2` artifacts are uploaded to Firebase Storage / GitHub release and verified from the Founder portal.

## Prior 1.64.0 Live Beta Verification Snapshot

Last verified: 2026-06-02 UTC / 2026-06-01 EDT.

- [x] Firebase CLI account verified as `wiil@indii.music`.
- [x] Firebase project verified as `indii-music-founder`.
- [x] Local macOS artifact exists at `dist-electron/indii.music-1.64.0-arm64.dmg` with size `150016050` bytes.
- [x] Local Windows artifact exists at `dist-electron/indii.music Setup 1.64.0.exe` with size `125572607` bytes.
- [x] Live Storage object exists at `founders/releases/indii-Installer.dmg` with size `150016050` bytes and MD5 `mgNljF78WeCzox9AD8mDcw==`.
- [x] Live Storage object exists at `founders/releases/indii-Setup.exe` with size `125572607` bytes and MD5 `eJU79dEgazBfJVK2/hbhvg==`.
- [x] Local and remote MD5 hashes match for both artifacts.
- [x] macOS DMG passes `hdiutil verify`.
- [x] Windows artifact identifies as a Nullsoft installer self-extracting archive.
- [x] `wiil@indii.music` profile is marked Founder for the app download gate (`tier`, `subscriptionTier`, and `isFounder`).
- [x] Interactive portal login/download click verified with the Founder user's real browser session or password. Manually confirmed complete.
- [x] Windows installer opened on a Windows 10/11 machine without immediate corruption errors. Manually confirmed complete.

## 1. Local Build Verification
- [x] Run `npm run build:desktop:mac` and `npm run build:desktop:win` locally (if environment allows). Current DMG/EXE artifacts verified from the completed build output.
- [x] Verify `dist-electron` contains `.dmg` and `.exe` artifacts.
- [x] Confirm no older, uncleaned artifacts corrupted the package size. Current DMG/EXE sizes are in the expected range.

## 2. GitHub Actions CI/CD Verification
- [x] After pushing a release tag, check the "Build & publish desktop installer" step in the `release.yml` GitHub Actions run. Manually confirmed complete.
- [x] Expand the logs and verify `electron-builder` successfully packaged `macOS` (`dmg`) and `Windows` (`nsis`). Manually confirmed complete.
- [x] Check that the "Upload Installer to Firebase Storage" steps use `gcloud storage cp`, not `firebase storage:upload`.
- [x] Check that macOS and Windows upload failures are not hidden behind `continue-on-error`.
  - [x] macOS step uploaded exactly to `founders/releases/indii-Installer.dmg` in a release-tag workflow run.
  - [x] Windows step uploaded exactly to `founders/releases/indii-Setup.exe` in a release-tag workflow run.

## 3. Live Storage Verification
- [x] Go to the Firebase Storage Console or use `gcloud storage ls` for `founders/releases/`.
- [x] Check the file sizes for `indii-Installer.dmg` and `indii-Setup.exe`. They should not be zero bytes and should match the expected local build sizes.
- [x] macOS installer exists exactly at `founders/releases/indii-Installer.dmg`.
- [x] Windows installer exists exactly at `founders/releases/indii-Setup.exe`.

## 4. Founder Portal Smoke Test
- [x] Confirm the Founder test account has download-gate fields in `users/{uid}`.
- [x] Log in to the application as a Founder user.
- [x] Navigate to the Founder Download section and attempt to download the DMG/EXE.
- [x] Verify the downloaded file opens cleanly on macOS (Disk Image) and Windows (NSIS Installer) without immediate corruption errors.
