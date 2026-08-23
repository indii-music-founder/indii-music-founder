# macOS Signing, Notarization & Auto-Update

How to go from "unsigned build, right-click-to-open" to a clean, auto-updating
macOS app. The code is already wired (`electron-builder.json` has
`hardenedRuntime`, entitlements, `notarize`, and a GitHub publish feed;
`packages/main/src/updater.ts` reads that feed). What's missing is only the
credentials and one command.

## 1. One-time Apple setup

You need ONE of these notarization routes, plus a signing identity.

### Signing identity (Developer ID Application)
- Apple Developer account → Certificates → create a **Developer ID Application** cert.
- Import the `.cer`/`.p12` into your **login keychain**. (`security find-identity -v -p codesigning` should list it.)

### Notarization route A — App Store Connect API key (recommended)
- Apple Developer → Users & Access → Keys → create an **App Store Connect API** key with **Developer** role.
- Download the `.p8`, note the **Key ID** and **Issuer ID**.
- Export as env vars:
  ```bash
  export APPLE_API_KEY=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
  export APPLE_API_KEY_ID=XXXXXXXXXX
  export APPLE_API_ISSUER=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  ```

### Notarization route B — Apple ID + app-specific password
- appleid.apple.com → Sign-In & Security → App-Specific Passwords → create one.
- ```bash
  export APPLE_ID=your@email.com
  export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
  export APPLE_TEAM_ID=XXXXXXXXXX   # 10-char team id, from developer.apple.com account page
  ```

## 2. GitHub token for the update feed
- `gh auth token` (if already logged in) or a fine-grained PAT with repo write.
  ```bash
  export GH_TOKEN=$(gh auth token)
  ```

## 3. Ship it
```bash
./scripts/release-macos.sh stable
```
This runs preflight → `electron-vite build` → `electron-builder --mac --publish always`,
which signs, notarizes, and publishes `dist-electron/indii.music-<ver>-arm64.dmg` +
`latest-mac.yml` to GitHub Releases. electron-updater then serves that feed to
installed apps on the same channel.

## 4. Local unsigned build (what we have today)
```bash
npm run build:desktop:mac          # --publish never, unsigned
```
Users install by right-click → Open the first time. This path never touches
Apple or GitHub credentials.

## Notes
- Notarization credentials never belong in the repo or in `.env` — they are
  passed via the shell env only (see `scripts/release-macos.sh` gate).
- The app version is `package.json` → `version` (currently 1.65.0). Bump it
  before a release so electron-updater sees a newer `latest-mac.yml`.
- Windows signing is a separate task (cert + `CSC_LINK`); out of scope here.
