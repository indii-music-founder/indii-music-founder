# Founder Release Checklist

Use this internal checklist to verify the Founder release artifacts (macOS DMG and Windows NSIS EXE) before and after deployment. Founders do not see this document; it is for release QA.

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

## Current Release Target

Public release identity: **Founders Version One**.

Technical updater version: **1.64.2**. Do not reset `package.json` to `1.0.0` for this launch, because installed `v1.50.0` builds would treat that as a downgrade and skip the update while `allowDowngrade` remains false.

- [ ] Push a `v1.64.2` release tag after local validation is complete.
- [ ] Verify GitHub Release `v1.64.2` includes platform installers and updater manifests:
  - `latest-mac.yml`
  - `latest.yml`
  - `latest-linux.yml`
- [ ] Confirm each manifest URL returns `200` before calling Founders Version One live.

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
