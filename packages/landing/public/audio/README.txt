INDII THESIS SOUNDTRACK

CURRENT TRACK: "Fader Fights Back" — Treblo ("Mix Pushing Back"), placed by the
founder 2026-08-27, replacing "Machine Code" (theme 2026-08-22 → 2026-08-27).

`indii-thesis-theme.mp3` is a web-optimized transcode of the founder's
`Fader Fights Back - Mix Pushing Back - Treblo.mp3`
(folder: `~/Desktop/indii.music.demo.music/`; source: 44.1 kHz stereo,
320 kbps, 166.5 s). Encoding: 44.1 kHz stereo, 192 kbps MP3 (~4.0 MB).

Loop treatment: a 40 ms fade-in head and a 1.2 s fade-out tail were added to
the transcode so the loop join is click-free. The source file is untouched.

PLAYBACK BEHAVIOR (ThesisCrawl)

- Auto-starts when the thesis experience opens — the "Watch the thesis" click
  provides the browser's required user activation. If a browser refuses
  autoplay (e.g. a deep link with no prior interaction), the track starts on
  the visitor's first pointer/key/touch gesture instead.
- Loops for the whole experience (audio.loop = true), whether the track is
  shorter or longer than the crawl.
- Fades out over 5 seconds once the crawl reaches the signed end card, then
  stops and releases its media resources.
- The visitor can mute/unmute at any time with the HUD control; a muted
  choice is respected across replay and reopen.

PREVIOUS TRACKS (kept in `archive/Music/` and mirrored in
`test-fixtures/audio/`): "Machine Code" (techno, 120 BPM, theme until
2026-08-27), "What To Come" (theme until 2026-08-22), and
"Fading Echoes ext v2.2".

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
