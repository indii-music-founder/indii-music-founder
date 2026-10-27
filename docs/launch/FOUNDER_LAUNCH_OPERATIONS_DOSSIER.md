# Founder Launch Operations Dossier

**Target Surface:** Founder Main Computer Launch Station  
**Status:** 🟡 FOUNDER-ACTION REQUIRED (Zero code defects remain; 4 real-world operational gates)  
**Governing Authorities:**
- [`docs/business-decisions/07_FOUNDING_ARTIST_BETA_MARKETING.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.codex/worktrees/issue-1543-admission-inventory/indii-music-founder/docs/business-decisions/07_FOUNDING_ARTIST_BETA_MARKETING.md)
- [`docs/business-decisions/08_INDII_MUSIC_LAUNCH_SOCIAL_CHECKLIST.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.codex/worktrees/issue-1543-admission-inventory/indii-music-founder/docs/business-decisions/08_INDII_MUSIC_LAUNCH_SOCIAL_CHECKLIST.md)
- [`docs/RELEASE_CHECKLIST.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.codex/worktrees/issue-1543-admission-inventory/indii-music-founder/docs/RELEASE_CHECKLIST.md)

---

## 1. Executive Summary & Order of Operations

All **37 engineering and architectural issues** across the [`.agent/test_ledger/OPEN_ISSUES_V3.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.codex/worktrees/issue-1543-admission-inventory/indii-music-founder/.agent/test_ledger/OPEN_ISSUES_V3.md) ledger are **100% closed, tested, and verified with mainline GitHub Actions CI**.

When you sit down at the main computer, follow this exact sequence to knock out the 4 remaining real-world founder gates:

```mermaid
flowchart LR
    A["1. GCP OAuth Test User (2 min)"] --> B["2. Seed Marketing Campaign (1 min)"]
    B --> C["3. Social Accounts & 2FA Vault (15 min)"]
    C --> D["4. Record 8 Real-Product Clips (35 min)"]
    D --> E["🚀 FULL LAUNCH READY"]
```

| Order | Gate | Action | Est. Time | Tools Needed |
|---|---|---|---|---|
| **Step 1** | `ISSUE-1400` | Add founder Google account to GCP OAuth "Test users" | 2 minutes | Web Browser |
| **Step 2** | `ISSUE-1429` | Seed the internal marketing campaign into Firestore | 1 minute | Terminal (`npx tsx scripts/seed-...`) |
| **Step 3** | `ISSUE-1428` | Audit social handles & copy secrets to 1Password vault | 15 minutes | Password Vault + Mobile App |
| **Step 4** | `ISSUE-1427` | Record 8 founder-narrated lifecycle clips (15–30s each) | 35 minutes | QuickTime / OBS + Microphone |

---

## 2. Gate 1: GCP OAuth Consent Screen (`ISSUE-1400`)

### Direct Console Link
👉 [Google Cloud Console — OAuth Consent Screen (`indii-music-founder`)](https://console.cloud.google.com/apis/credentials/consent?project=indii-music-founder)

---

### Path A: Fast Dev Unblock (2 Minutes — Immediate Verification)
If you want to unblock YouTube Video Upload and Gmail dispatches immediately without waiting for Google's multi-week verification review:

1. Open the console link above.
2. In the left menu, click **OAuth consent screen**.
3. Under the **Test users** section, click **+ ADD USERS**.
4. Enter:
   - Your primary Google account email (e.g. `wiil@indii.music` or personal Gmail).
   - Any designated beta artist testing emails.
5. Click **SAVE**.
6. **Result:** All sensitive Google OAuth scopes (`youtube.upload`, `gmail.send`) will now authenticate instantly without Google's 403 `access_denied` error screen.

---

### Path B: Production Verification Submission (For Public Artists)
When submitting for permanent "In production" status:

#### 1. App Information Tab
- **App name:** `indii.music`
- **User support email:** `wiil@indii.music`
- **App logo:** Upload `packages/renderer/public/assets/branding/indii-logo.png` (120×120 PNG).
- **Application home page:** `https://indii.music`
- **Application privacy policy link:** `https://indii.music/privacy`
- **Application terms of service link:** `https://indii.music/terms`
- **Authorized domain:** `indii.music`
- **Developer contact information:** `wiil@indii.music`

#### 2. Scopes Justification (Copy-Paste Text into Google Form)

**Scope 1: `https://www.googleapis.com/auth/youtube.upload` (Sensitive)**
> *"indii.music is an operating platform for independent artists. The `youtube.upload` scope is used exclusively at the explicit request and confirmation of the artist to upload promotional music videos, visualizers, and teasers created in the indii Studio NLE timeline directly to their official YouTube channel. The application never deletes, edits, or inspects unrelated videos on the user's channel."*

**Scope 2: `https://www.googleapis.com/auth/gmail.send` (Sensitive)**
> *"The `gmail.send` scope allows artists to dispatch booking inquiries, press releases, tour routing confirmations, and sync licensing pitches directly from their connected professional email address inside the indii Road Manager. The app only sends emails composed and explicitly approved by the artist; it does not read, index, or store incoming inbox emails."*

#### 3. YouTube Demo Walkthrough Video Requirement
Google requires an unlisted YouTube video showing the consent flow.
- **Recording flow:**
  1. Show the user in indii Studio clicking **Settings → Connected Accounts → Connect YouTube**.
  2. The Google OAuth consent popup appears displaying the client ID in the URL bar.
  3. The user signs in and grants the `youtube.upload` scope.
  4. Show the user navigating to the HyperFrames NLE timeline, clicking **Publish to YouTube**, entering a title, and confirming the upload.
  5. Show the completed video appearing in YouTube Studio.

---

## 3. Gate 2: Eight Founder-Narrated Real-Product Clips (`ISSUE-1427`)

### Recording Standards
- **Duration:** 15–30 seconds maximum per clip (must be punchy, zero dead air).
- **Resolution:** 1080p (1920×1080) desktop master + vertical crop (1080×1920) for TikTok/Reels/Shorts.
- **Microphone:** Dedicated studio mic (USB/XLR), dry room, clear diction.
- **Framerate:** 30fps or 60fps, stereo 48kHz AAC audio.
- **Output Path:** Save raw exports into `packages/landing/public/clips/`.

---

### Clip 01: Song Registration & Immutable Rights Intake
- **File Name:** `clip-01-registration.mp4` | **Target Duration:** 20–22s
- **View Route:** `http://localhost:4242/#/registration`
- **On-Screen Action:**
  1. Open Registration Center. Show track title and metadata card.
  2. Click into Founder Readiness panel (ISRC prefix, GTIN prefix, SoundExchange, PRO).
  3. Show split percentage allocation slider locking 100% writer/publisher ownership.
- **Word-for-Word Voiceover Script:**
  > *"When you write a song, you own 100% of it until you say otherwise. In indii, song registration isn’t an afterthought. We anchor your legal rights, track your official ISRC ownership, SoundExchange allocations, and split contracts directly into an immutable ledger. Nothing gets lost, and no middleman takes a cut."*
- **WebVTT Caption Template (`clip-01-registration.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.500
  When you write a song, you own 100% of it until you say otherwise.

  00:04.500 --> 00:08.500
  In indii, song registration isn’t an afterthought.

  00:08.500 --> 00:14.000
  We anchor your legal rights, track your official ISRC ownership,

  00:14.000 --> 00:18.500
  SoundExchange allocations, and split contracts directly into an immutable ledger.

  00:18.500 --> 00:22.000
  Nothing gets lost, and no middleman takes a cut.
  ```

---

### Clip 02: Audio Profiling & Sonic Fingerprinting
- **File Name:** `clip-02-audio-analysis.mp4` | **Target Duration:** 20–23s
- **View Route:** `http://localhost:4242/#/creative` (Audio Analyzer tab)
- **On-Screen Action:**
  1. Drag and drop a stereo WAV master file onto the Audio Analyzer stage.
  2. Show waveform rendering with frequency spectrum analysis.
  3. Highlight instant extraction of BPM (e.g. 124 BPM), musical key (e.g. F Minor), dynamic range LUFS, and stem separation visualizer.
- **Word-for-Word Voiceover Script:**
  > *"Drop your master WAV file in, and indii instantly profiles the sonic DNA. We extract your exact tempo, musical key, loudness range, and vocal stems in seconds. No cloud waiting lines, no third-party subscription fees—just raw musical intelligence built directly into your workstation."*
- **WebVTT Caption Template (`clip-02-audio-analysis.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.500
  Drop your master WAV file in, and indii instantly profiles the sonic DNA.

  00:04.500 --> 00:09.500
  We extract your exact tempo, musical key, loudness range, and vocal stems in seconds.

  00:09.500 --> 00:15.000
  No cloud waiting lines, no third-party subscription fees—

  00:15.000 --> 00:21.000
  just raw musical intelligence built directly into your workstation.
  ```

---

### Clip 03: Creative Canvas & Artwork Generation
- **File Name:** `clip-03-creative-canvas.mp4` | **Target Duration:** 22–25s
- **View Route:** `http://localhost:4242/#/creative` (Canvas tab)
- **On-Screen Action:**
  1. Open Creative Canvas. Select Square (3000×3000) Album Cover template.
  2. Click **Generate Visual Concept** using Gemini 3 Pro Image.
  3. Apply artist brand kit palette, drag title typography into place, show vinyl mockup preview.
- **Word-for-Word Voiceover Script:**
  > *"Artwork shouldn’t take three weeks and ten email threads. On the Creative Canvas, you direct visual concepts with studio typography, high-res generation, and streaming-compliant aspect ratios. Export 3000-pixel single covers, Spotify Canvas loops, and vinyl mockups from a single master canvas."*
- **WebVTT Caption Template (`clip-03-creative-canvas.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.000
  Artwork shouldn’t take three weeks and ten email threads.

  00:04.000 --> 00:09.500
  On the Creative Canvas, you direct visual concepts with studio typography,

  00:09.500 --> 00:15.000
  high-res generation, and streaming-compliant aspect ratios.

  00:15.000 --> 00:23.000
  Export single covers, Spotify Canvas loops, and vinyl mockups from a single master canvas.
  ```

---

### Clip 04: HyperFrames Video Engine & NLE Timeline
- **File Name:** `clip-04-video-nle.mp4` | **Target Duration:** 24–27s
- **View Route:** `http://localhost:4242/#/video`
- **On-Screen Action:**
  1. Open HyperFrames NLE Studio.
  2. Show multi-track timeline with audio waveforms, text clips, and video layers.
  3. Scrub playhead smoothly showing seek-safe 60fps canvas preview.
  4. Show kinetic lyric text animating in lockstep with the beat markers.
- **Word-for-Word Voiceover Script:**
  > *"This is HyperFrames—our built-in non-linear video editing engine. It’s timeline-based, seek-safe, and code-rendered. Drag your stems onto the timeline, generate kinetic lyric animations synced to your drum transients, and render broadcast-ready promotional clips in seconds without leaving indii."*
- **WebVTT Caption Template (`clip-04-video-nle.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.500
  This is HyperFrames—our built-in non-linear video editing engine.

  00:04.500 --> 00:08.500
  It’s timeline-based, seek-safe, and code-rendered.

  00:08.500 --> 00:14.500
  Drag your stems onto the timeline, generate kinetic lyric animations synced to your drum transients,

  00:14.500 --> 00:24.000
  and render broadcast-ready promotional clips in seconds without leaving indii.
  ```

---

### Clip 05: Desktop Rights Copilot & Member Portal Filing
- **File Name:** `clip-05-rights-copilot.mp4` | **Target Duration:** 23–26s
- **View Route:** `http://localhost:4242/#/registration` (Rights Copilot modal)
- **On-Screen Action:**
  1. Click **Launch Rights Copilot**.
  2. Select US Copyright eCO and ASCAP/BMI registration options.
  3. Show the automated assistant mapping verified song metadata, writer IPIs, and split shares directly into the filing checklist.
- **Word-for-Word Voiceover Script:**
  > *"Filing copyright and PRO registrations by hand is tedious and full of trapdoors. The Desktop Rights Copilot guides you step-by-step through official member portals—pre-populating your verified publisher, writer, and sound recording identities directly into official forms. Zero middleman fees."*
- **WebVTT Caption Template (`clip-05-rights-copilot.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.500
  Filing copyright and PRO registrations by hand is tedious and full of trapdoors.

  00:04.500 --> 00:10.000
  The Desktop Rights Copilot guides you step-by-step through official member portals—

  00:10.000 --> 00:17.500
  pre-populating your verified publisher, writer, and sound recording identities directly into official forms.

  00:17.500 --> 00:23.000
  Zero middleman fees.
  ```

---

### Clip 06: Direct DDEX Delivery & Release Packaging
- **File Name:** `clip-06-ddex-packaging.mp4` | **Target Duration:** 22–25s
- **View Route:** `http://localhost:4242/#/distribution`
- **On-Screen Action:**
  1. Open Distribution Hub. Click **Package DDEX Release**.
  2. Show generation of official DDEX ERN 4.3 XML package.
  3. Show offline checksum validation passing and release bundle inspection view.
- **Word-for-Word Voiceover Script:**
  > *"When your record is ready for global distribution, indii compiles official DDEX ERN 4.3 delivery packages. Full schema validation, lossless audio checksums, and distributor-grade metadata trees. You own your DPID, and you own your distribution pipe."*
- **WebVTT Caption Template (`clip-06-ddex-packaging.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.500
  When your record is ready for global distribution,

  00:04.500 --> 00:09.500
  indii compiles official DDEX ERN 4.3 delivery packages.

  00:09.500 --> 00:15.500
  Full schema validation, lossless audio checksums, and distributor-grade metadata trees.

  00:15.500 --> 00:22.000
  You own your DPID, and you own your distribution pipe.
  ```

---

### Clip 07: Ad Automation & CAPI Attribution Bus
- **File Name:** `clip-07-ad-automation.mp4` | **Target Duration:** 23–26s
- **View Route:** `http://localhost:4242/#/marketing`
- **On-Screen Action:**
  1. Open Marketing Dashboard. Click **Ad Automation**.
  2. Show multi-platform creative generator (Meta, TikTok, Google).
  3. Highlight minimum budget safety floors and Conversions API (CAPI) deduplication metrics.
- **Word-for-Word Voiceover Script:**
  > *"Marketing your music doesn’t mean burning ad budget blindly. indii creates targeted multi-platform ad variants, enforces automated budget safety floors, and tracks real streaming conversions through server-side CAPI deduplication. Real attribution, zero guesswork."*
- **WebVTT Caption Template (`clip-07-ad-automation.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:04.500
  Marketing your music doesn’t mean burning ad budget blindly.

  00:04.500 --> 00:10.000
  indii creates targeted multi-platform ad variants and enforces automated budget safety floors,

  00:10.000 --> 00:16.500
  tracking real streaming conversions through server-side CAPI deduplication.

  00:16.500 --> 00:23.000
  Real attribution, zero guesswork.
  ```

---

### Clip 08: Mobile Remote QuickCapture & StreamView Car Test
- **File Name:** `clip-08-mobile-remote.mp4` | **Target Duration:** 23–26s
- **View Route:** `http://localhost:4242/#/mobile-remote` (or mobile phone connected via Cloud Relay)
- **On-Screen Action:**
  1. Show mobile viewfinder capturing video with framing guides.
  2. Tap voice memo button with live Whisper auto-transcription preview.
  3. Show instant peer-to-peer sync onto desktop Creative Canvas.
  4. Switch to StreamView player playing unreleased audio mix.
- **Word-for-Word Voiceover Script:**
  > *"Your studio goes where you go. With indii Mobile Remote, capture backstage footage, record voice memos with instant AI transcription, and sync media directly to your desktop canvas. Plus, test your unreleased mixes in the car with lossless StreamView."*
- **WebVTT Caption Template (`clip-08-mobile-remote.vtt`):**
  ```vtt
  WEBVTT

  00:00.000 --> 00:03.500
  Your studio goes where you go.

  00:03.500 --> 00:09.500
  With indii Mobile Remote, capture backstage footage, record voice memos with instant AI transcription,

  00:09.500 --> 00:14.500
  and sync media directly to your desktop canvas.

  00:14.500 --> 00:23.000
  Plus, test your unreleased mixes in the car with lossless StreamView.
  ```

---

## 4. Gate 3: Social Account Ownership & 2FA Vault (`ISSUE-1428`)

Execute **Job M-02** per [`docs/business-decisions/08_INDII_MUSIC_LAUNCH_SOCIAL_CHECKLIST.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.codex/worktrees/issue-1543-admission-inventory/indii-music-founder/docs/business-decisions/08_INDII_MUSIC_LAUNCH_SOCIAL_CHECKLIST.md):

### Master Channel Registry Table

| Platform | Desired Handle | Fallback Handle | Canonical Public URL | Admin Account | 2FA Status | Vault Entry UUID |
|---|---|---|---|---|---|---|
| **Instagram** | `@indii_music` | `@indii.music` | `https://instagram.com/indii_music` | `wiil@indii.music` | App TOTP / Passkey | `vault-ig-indii` |
| **Instagram (Alt)** | `@indii.music` | redirect bio | `https://instagram.com/indii.music` | `wiil@indii.music` | App TOTP / Passkey | `vault-ig-alt` |
| **Facebook Page** | `indii.music` | `indii.music.official` | `https://facebook.com/indii.music` | Personal Admin Profile | Security Key / TOTP | `vault-fb-indii` |
| **TikTok** | `@indii.music` | `@indii_music` | `https://tiktok.com/@indii.music` | `wiil@indii.music` | SMS + App Auth | `vault-tt-indii` |
| **YouTube** | `@indii_music` | `indii.music` | `https://youtube.com/@indii_music` | Google Workspace Brand | Hardware 2FA | `vault-yt-indii` |
| **X (Twitter)** | `@indii_music` | `@indii_hq` | `https://x.com/indii_music` | `wiil@indii.music` | FIDO2 Security Key | `vault-x-indii` |
| **Threads** | `@indii_music` | `@indii.music` | `https://threads.net/@indii_music` | via Instagram Auth | Shared with IG | `vault-threads-indii` |
| **LinkedIn** | `indii-music` | `indii-music-hq` | `https://linkedin.com/company/indii-music` | Personal Founder Profile | App TOTP | `vault-li-indii` |
| **Bluesky** | `indii.music` | `@indii.bsky.social` | `https://bsky.app/profile/indii.music` | Custom Domain DNS | Password + TOTP | `vault-bsky-indii` |

### 1Password / Bitwarden Credential Template
For every platform in the table above, ensure a dedicated vault item exists with:
```
Title: indii.music — [Platform Name]
Username: [Handle or Email]
Password: [Strong Randomly Generated Password (24+ characters)]
One-Time Password (OTP): [Configured in Vault]
Website: [Canonical Login URL]
Notes:
  - Admin Owner: wiil@indii.music
  - Recovery Email: [Founder Backup Email]
  - Recovery Phone: [Founder Mobile Phone]
  - Associated Brand Assets: packages/renderer/public/assets/branding/
```

---

## 5. Gate 4: indii Internal Marketing Launch Seed (`ISSUE-1429`)

Execute **Job M-01** to seed the internal campaign into your local or production Firestore:

```bash
# Dry-run check (verifies JSON payload structure without modifying database)
npx tsx scripts/seed-internal-marketing-launch.ts --dry-run

# Live Firestore execution (inserts "indii.music Public Launch" campaign)
npx tsx scripts/seed-internal-marketing-launch.ts --user wiil-founder
```

### What This Establishes:
1. **Campaign Record**: Injects `indii.music Public Launch` into `campaigns` collection.
2. **Scheduled Posts**: Seeds 6 launch posts mapped to Twitter/X and Instagram highlighting the 8 lifecycle clips.
3. **Task Ledger**: Tracks all 9 Stack M jobs (`M-01` through `M-09`) and 8 Stack C jobs (`C-01` through `C-08`) directly within indii Studio.
4. **Dogfooding Proof**: Proves to Founding Artists and prospective investors that indii.music was planned, marketed, and launched entirely through indii.music.
