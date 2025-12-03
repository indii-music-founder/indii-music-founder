# Music Module

## Purpose

The Music Module is designed for audio synthesis, analysis, and visualization. It integrates `Tone.js` for in-browser audio generation and uses AI to analyze audio features for "synesthetic" visual generation.

## Key Components

### `MusicStudio`

The primary interface for music creation. Features include:

- **Audio Engine Control:** Start/Stop functionality to comply with browser autoplay policies.
- **Basic Synthesizer:** A simple interface to play notes and adjust volume/mute settings.
- **Status Monitor:** Displays audio context information (sample rate, state).

## Tools (`tools.ts`)

- `analyze_audio_features`: Extracts metrics like BPM, energy, and mood from audio data (simulated).
- `generate_visual_prompt`: Translates audio metrics into a detailed image generation prompt.
- `generate_video_treatment`: Creates a structured video treatment based on audio analysis.

## AI Agents

- **Lead Audio Analyst:** Performs deep structural and emotional analysis.
- **Audio Technician:** Executes specific analysis and generation tools.
