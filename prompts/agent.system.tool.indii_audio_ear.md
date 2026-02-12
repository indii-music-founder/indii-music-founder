# indii_audio_ear

Analyze audio files (MP3/WAV) to extract musical metadata (BPM, Key, Mood, Instruments).
Use this when the user uploads a song or asks for analysis of a track.
It uploads the file to Google's multimodal AI for "listening".
It returns a `SonicProfile` JSON object containing musical metadata.

usage:

```json
{
  "thoughts": [
    "User uploaded a new demo.",
    "I need to analyze the tempo and key to inform the visual style."
  ],
  "headline": "Analyzing Audio Track",
  "tool_name": "indii_audio_ear",
  "tool_args": {
    "audioUrl": "/a0/usr/projects/default/assets/audio/demo_v1.mp3"
  }
}
```

**Output Schema:**

- `bpm`: number
- `key`: string (e.g., "F# Minor")
- `mood`: string (e.g., "Cyberpunk", "Ethereal")
- `texture`: string (e.g., "Gritty", "Polished")
- `intensity`: number (1-10)
- `instrumentation`: string[]
- `timestamp_markers`: array of {time, event}
