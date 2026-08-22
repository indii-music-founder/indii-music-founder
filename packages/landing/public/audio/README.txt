INDII THESIS SOUNDTRACK

CURRENT TRACK: "Machine Code" (techno, 120 BPM) — chosen by the founder
2026-08-22, replacing "What To Come".

`indii-thesis-theme.mp3` is a web-optimized transcode of the founder's
`archive/Music/Machine Code.mp3` (source upload: 171 s).
Encoding: 48 kHz stereo, 192 kbps MP3 (~4.1 MB).

Facts from analysis of the source:
- Steady 120 BPM grid (315 detected beats across 171 s).
- Spectral centroid ~2790 Hz — brighter, more digital texture than the
  previous track; suits the system-network visualizer's high band.
- Arc: opens at moderate energy (RMS ~0.08), closes near-silence
  (end RMS ~0.001). The fade-out-to-quiet-restart makes a clean loop join —
  no click, just a natural breath between loops.
- The loop plays continuously in the thesis player and drives the
  audio-reactive system network (bass/mid/high bands).

PREVIOUS TRACKS (kept in `archive/Music/` and mirrored in
`test-fixtures/audio/`): "What To Come" (techno ~116 BPM, was theme until
2026-08-22) and "Fading Echoes ext v2.2".

REPLACING IT

Drop the final theme into this folder using one of these filenames (the
thesis player checks them in this order):

  indii-thesis-theme.mp3
  indii-thesis-theme.m4a
  indii-thesis-theme.wav

Recommended delivery:

  - MP3 or M4A for the website
  - 44.1 kHz or 48 kHz stereo
  - A clean loop or a long-form score
  - No important opening transient before 100 ms
  - Keep enough headroom for comfortable browser playback
