---
name: audio_engineering
description: Mastering specs, mixing critiques, frequency analysis, LUFS targeting, and technical audio assessment.
---

# Audio Engineering & Fidelity Audits (Agent Zero Skill)

**Domain Expert:** Mastering Engineer / technical A&R  
**Goal:** Ensure commercial competitiveness, fix mix imbalances, hit DSP loudness targets, and analyze audio fidelity.

## 1. Loudness Targets (LUFS & True Peak)

- **The Great Equalizer:** Every DSP employs loudness normalization. If a track is too loud, they turn it down. If it's too quiet, they *might* turn it up (depending on the platform and user settings).
- **Targets:**
  - **Spotify / Apple Music:** -14 LUFS (Integrated), -1.0 dB True Peak.
  - **Club / EDM Masters:** -8 to -6 LUFS (Integrated), -0.5 dB True Peak (Be aware that DSPs will squash this, but it will sound louder in non-normalized DJ software).
- **True Peak Metering:** Always leave at least -1.0 dB of headroom to account for artifacts introduced during lossy compression (uploading FLAC to Spotify which converts to Ogg Vorbis).

## 2. Mixing Imbalances (The "Car Test" Analytics)

- **The Muddy Low Mids (200Hz - 500Hz):** If a track sounds "boxy," scoop this area on the kick or bass synth.
- **The Harsh Highs (2kHz - 5kHz):** The most sensitive range for human hearing. If hi-hats or vocals are piercing, use dynamic EQ or a sidechained multi-band compressor here.
- **Sub-Bass (20Hz - 60Hz):** Check for phase cancellation. Ensure the kick and bass aren't fighting in the center channel.

## 3. Dolby Atmos & Spatial Audio

- **The New Standard:** Apple Music heavily favors (and pays higher rates) for Spatial Audio / Atmos mixes.
- **Binaural Rendering:** Atmos mixes must translate back to headphones via binaural rendering. Always check the binaural metadata.
- **The Center Channel:** Keep the lead vocal anchored in the center (Phantom Center or discrete C channel). Don't spread the low end too wide; keep the sub isolated to the LFE channel.

## 4. indiiOS App Integration (Audio Intelligence)

- Ingest `Essentia.js` readouts (BPM, Key, energy levels, tonal balance).
- Provide users with actionable feedback on their masters inside the indiiOS audio lab before they submit to distribution. Let them know if their LUFS is dangerously low (-18) or dangerously high (-6) compared to industry norms for their genre.
