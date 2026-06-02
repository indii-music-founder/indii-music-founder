# Founder Release Checklist

Use this internal checklist to verify the Founder release artifacts (macOS DMG and Windows NSIS EXE) before and after deployment. Founders do not see this document; it is for release QA.

## Current Beta Verification Snapshot

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
- [ ] Interactive portal login/download click verified with the Founder user's real browser session or password.
- [ ] Windows installer opened on a Windows 10/11 machine without immediate corruption errors.

## 1. Local Build Verification
- [ ] Run `npm run build:desktop:mac` and `npm run build:desktop:win` locally (if environment allows).
- [x] Verify `dist-electron` contains `.dmg` and `.exe` artifacts.
- [x] Confirm no older, uncleaned artifacts corrupted the package size. Current DMG/EXE sizes are in the expected range.

## 2. GitHub Actions CI/CD Verification
- [ ] After pushing a release tag, check the "Build & publish desktop installer" step in the `release.yml` GitHub Actions run.
- [ ] Expand the logs and verify `electron-builder` successfully packaged `macOS` (`dmg`) and `Windows` (`nsis`).
- [x] Check that the "Upload Installer to Firebase Storage" steps use `gcloud storage cp`, not `firebase storage:upload`.
- [x] Check that macOS and Windows upload failures are not hidden behind `continue-on-error`.
  - [ ] macOS step uploaded exactly to `founders/releases/indii-Installer.dmg` in a release-tag workflow run.
  - [ ] Windows step uploaded exactly to `founders/releases/indii-Setup.exe` in a release-tag workflow run.

## 3. Live Storage Verification
- [x] Go to the Firebase Storage Console or use `gcloud storage ls` for `founders/releases/`.
- [x] Check the file sizes for `indii-Installer.dmg` and `indii-Setup.exe`. They should not be zero bytes and should match the expected local build sizes.
- [x] macOS installer exists exactly at `founders/releases/indii-Installer.dmg`.
- [x] Windows installer exists exactly at `founders/releases/indii-Setup.exe`.

## 4. Founder Portal Smoke Test
- [x] Confirm the Founder test account has download-gate fields in `users/{uid}`.
- [ ] Log in to the application as a Founder user.
- [ ] Navigate to the Founder Download section and attempt to download the DMG/EXE.
- [ ] Verify the downloaded file opens cleanly on macOS (Disk Image) and Windows (NSIS Installer) without immediate corruption errors.
