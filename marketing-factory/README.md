# indii Autonomous Marketing & Ad Factory (Track 2)

This workspace dogfoods `indii`'s own `@indii/video-compiler` (HyperFrames) Multi-Shape Ad Matrix + TypeSafe **Jev (`jev-latest`)** System One test/improve loop + **Gemini 4 Neon (`gemini-4-neon`)** `/10` multimodal scoring rubric to market `indii` itself across short-form video, paid ads, and coordinated social launch posts.

## What It Generates From One Campaign JSON Brief
1. **Multi-Shape HyperFrames Compositions** (`marketing-factory/out/<campaignId>/`):
   - `9:16` (`1080×1920`) — TikTok, Instagram Reels, YouTube Shorts (safe-zone-enforced)
   - `1:1` (`1080×1080`) — Instagram, X, Meta Square Feed
   - `4:5` (`1080×1350`) — High-real-estate Meta / Instagram Feed
   - `16:9` (`1920×1080`) — YouTube In-Stream / Website Hero
   - Durations: `6s` Bumper, `15s` Hook Ad, `30s` Story Ad
2. **Jev System One Pre-Flight Test & Auto-Improve (`jev-evaluation-report.json`)**:
   - Runs `jev-latest` (when `TYPESAFE_API_KEY` is set) or the identical deterministic baseline across every cut (`hookPunchScore`, `mobileCopyClarityScore`, `ctaConversionScore`, `safeZoneOverflowRisk`, `brandVoiceFit`) and automatically re-compiles weak/overflowing cuts with `AdRefinementPatch`.
3. **Gemini 4 Neon `/10` Scoring Manifest (`scorecard-manifest.json`)**:
   - Captures keyframe checkpoints (`0.5s`, `1.5s`, mid-cut, end-card) for `gemini-4-neon` evaluation against the 5-part rubric (`firstTwoSecondHook`, `mobileLegibility`, `safeZoneIntegrity`, `audioVisualPacing`, `brandAlignment`) with `>= 9.0/10` pass gate and automatic regression discard.
4. **Coordinated Social Launch Kit (`social-launch-kit.json`)**:
   - Synchronized Instagram Reel/Story, TikTok, YouTube Shorts, and X Post + Header copy ready for `/teamwork` rollout.

## Run
```bash
node marketing-factory/run-ad-factory.mjs marketing-factory/campaigns/indii-launch-01.json
node marketing-factory/jev-evaluate-ads.mjs indii-launch-01
node marketing-factory/score-ads-gemini.mjs indii-launch-01 --capture-only
# Live Gemini 4 Neon /10 multimodal scorecard (requires GEMINI_API_KEY or GOOGLE_API_KEY):
GEMINI_API_KEY=... node marketing-factory/score-ads-gemini.mjs indii-launch-01
```
