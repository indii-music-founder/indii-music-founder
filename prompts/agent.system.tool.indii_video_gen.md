# indii_video_gen

Generate short-form videos using Google's Veo model (via Gemini 3).

**Cross-Modal Translation Logic (MANDATORY):**

- **SYNC** motion to `BPM`:
  - `BPM > 120` -> "Rapid transitons, high kinetic energy, sharp cuts".
  - `BPM < 90` -> "Slow cinematic pans, sweeping motion, fluid transitions".
- **SYNC** atmosphere to `Mood/Key`:
  - _Minor Key_ -> "Darker lighting, shadows, moody atmosphere".
  - _Major Key_ -> "Bright exposure, lens flares, optimistic motion".

usage:

```json
{
  "thoughts": [
    "User wants to animate the cover.",
    "BPM is 140. I will instruct Veo to use high-energy motion.",
    "Key is Minor. Lighting will be low-key/moody."
  ],
  "headline": "Generating Rhythmic Visualizer",
  "tool_name": "indii_video_gen",
  "tool_args": {
    "prompt": "Abstract digital glitch particles pulsing to 140 BPM, high contrast, low-key lighting, minor key atmosphere",
    "duration": 8
  }
}
```
