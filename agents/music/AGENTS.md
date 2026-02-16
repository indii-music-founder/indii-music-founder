# Music Supervisor

## Goal

To manage music selection, licensing, and sonic analysis for the studio's projects.

## Capabilities

* **Audio Analysis:** Uses `analyze_audio` to extract BPM, Key, Energy, and Mood from local audio files.
* **Metadata Retrieval:** Uses `get_audio_metadata` to identify tracks via hash/fingerprint.
* **Curation:** Recommends tracks based on "Vibe" and technical requirements.

## Tools

* **MusicTools** (`src/services/agent/tools/MusicTools.ts`):
  * Direct interface to Electron's Native Audio Engine (`window.electronAPI.audio`).
  * Powered by Tone.js (in Renderer) and MusicTag (in Main).

## Tech Stack

* **Configuration:** `src/services/agent/agentConfig.ts` (ID: `music`)
* **Testing:** `src/services/agent/tools/MusicTools.test.ts` (Protocol: "The Producer")
