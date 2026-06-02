# Founder Release Checklist

Use this checklist to manually verify the release artifacts (macOS DMG and Windows NSIS EXE) before and after deployment.

## 1. Local Build Verification
- [ ] Run `npm run build:desktop:mac` and `npm run build:desktop:win` locally (if environment allows).
- [ ] Verify `dist-electron` contains `.dmg` and `.exe` artifacts.
- [ ] Confirm no older, uncleaned artifacts (e.g., zip files in `dist/`) corrupted the package size. (Run `npm run clean` if the artifact size exceeds expected ~150-200MB).

## 2. GitHub Actions CI/CD Verification
- [ ] After pushing to `main`, check the "Build & publish desktop installer" step in the `release.yml` GitHub Actions run.
- [ ] Expand the logs and verify `electron-builder` successfully packaged `macOS` (`dmg`) and `Windows` (`nsis`).
- [ ] Check the "Upload Installer to Firebase Storage" steps.
  - [ ] macOS step uploaded exactly to `founders/releases/indii-Installer.dmg`.
  - [ ] Windows step uploaded exactly to `founders/releases/indii-Setup.exe`.

## 3. Post-Deployment Smoke Test
- [ ] Go to the Firebase Storage Console -> `founders/releases/`.
- [ ] Check the file sizes for `indii-Installer.dmg` and `indii-Setup.exe`. They should not be zero bytes and should match the expected ~150-200MB.
- [ ] Log in to the application as a Founder user.
- [ ] Navigate to the Founder Download section and attempt to download the DMG/EXE.
- [ ] Verify the downloaded file opens cleanly on macOS (Disk Image) and Windows (NSIS Installer) without immediate corruption errors.
