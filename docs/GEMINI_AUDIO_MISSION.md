# GEMINI_AUDIO_MISSION.md - The Sonic Cortex

## 🎯 OBJECTIVE

Integrate **Gemini 3 Pro**'s native audio-understanding capabilities into the indiiOS "Sovereign Engine." Move beyond simple metadata to **Deep Sonic Reasoning**.

## 🧠 CORE RESEARCH: GEMINI 3 AUDIO MODALITY

Gemini 3 Pro (and the 2.5 TTS/Audio variants) does not just "transcribe" audio; it **hears** it.

### Key Capabilities

1. **Multimodal Reasoning:** Can process raw audio (MP3, WAV, FLAC) up to 1M+ tokens in context (approx. 22 hours of audio).
2. **Sonic Texture Analysis:** Can describe the "soul" of a song—timbre, mood, spatial arrangement, and emotional weight.
3. **Instrumental Attribution:** Identifies specific instruments and their roles in the mix.
4. **Contextual Alignment:** Can align a lyric sheet (text) with a recording (audio) to verify performance accuracy.

## 🧪 MISSION TASKS

### 1. The "Sonic Soul" Prompt Engineering

Develop the master prompt for the `AudioAnalysisService` to exploit Gemini 3's ears.

- **Target:** "Describe the emotional trajectory, the production style (e.g., analog warmth vs. digital precision), and the key melodic motifs of this track."

### 2. Audio-to-Metadata Mapping

Bridge the gap between Gemini's "Deep Description" and our **DDEX ERN 4.3** fields.

- **Goal:** Automatically populate the `marketingComment` and `keyWords` fields in the ERN packet using Gemini's analysis.

### 3. Verification & Compliance

Use Gemini to "listen" for AI artifacts.

- **Goal:** If the `aiGeneratedContent` flag is missing, have Gemini flag potential AI textures for human review (Goal 3 compliance).

## 📡 INTEGRATION PATH

- **Model:** `google/gemini-3-pro-preview`
- **Modality:** `AUDIO`
- **Output:** Structured JSON for the `Music DNA` ledger.

---

_Status: MISSION_INIT. Knowledge base updated with Gemini 3 Pro Audio parameters._
