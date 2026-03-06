# Loudness Standards & Audio Formats

## Overview

Technical specifications for audio files ensure your music sounds its best across all playback systems and meets platform requirements. This guide covers loudness standards (LUFS), audio formats, delivery specifications, and best practices for professional releases.

---

## Loudness Standards (LUFS)

### What is LUFS?

**LUFS** (Loudness Units Full Scale) is the standard unit for measuring perceived loudness in audio. Unlike peak levels (dBFS), LUFS accounts for how humans actually hear sound, making it the preferred metric for streaming platforms.

### Why LUFS Matters

Streaming platforms normalize audio to target loudness levels. If your track is louder than the target, it gets turned down. If it's quieter, it stays quiet (platforms rarely boost). Understanding LUFS ensures your music competes appropriately.

### Platform Loudness Targets

| Platform | Target LUFS | Peak | Notes |
|----------|-------------|------|-------|
| **Spotify** | -14 LUFS | -1 dBTP | Normalization on by default |
| **Apple Music** | -16 LUFS | -1 dBTP | Sound Check normalization |
| **YouTube** | -14 LUFS | -1 dBTP | Automatic normalization |
| **Tidal** | -14 LUFS | -1 dBTP | Normalization option |
| **Amazon Music** | -14 to -16 LUFS | -1 to -2 dBTP | Variable by service tier |
| **Deezer** | -15 LUFS | -1 dBTP | Normalization enabled |
| **Pandora** | -14 LUFS | -1 dBTP | Normalization applied |
| **SoundCloud** | -8 to -13 LUFS | -1 dBTP | No normalization (louder = better) |
| **Bandcamp** | No standard | -0.1 dBTP | No normalization |

### Understanding the Measurements

| Term | Description | Typical Range |
|------|-------------|---------------|
| **Integrated LUFS** | Average loudness of entire track | -8 to -16 LUFS |
| **Short-term LUFS** | 3-second moving average | Varies by section |
| **Momentary LUFS** | 400ms measurement | Peak moments |
| **LRA** (Loudness Range) | Dynamic range measurement | 3–15 LU |
| **dBTP** (True Peak) | Maximum peak level | -1 to -3 dBTP |

### LUFS Recommendations by Genre

| Genre | Recommended LUFS | Notes |
|-------|------------------|-------|
| **Pop** | -9 to -11 LUFS | Competitive, limited dynamics |
| **Hip-Hop** | -8 to -10 LUFS | Loud, punchy, compressed |
| **Rock** | -10 to -12 LUFS | Balanced, some dynamics |
| **Electronic** | -9 to -12 LUFS | Varies by subgenre |
| **Jazz** | -14 to -16 LUFS | More dynamic range |
| **Classical** | -16 to -20 LUFS | Wide dynamics preserved |
| **Folk/Acoustic** | -14 to -16 LUFS | Natural dynamics |

### The Loudness Wars

**Historical context:**
- 1990s–2000s: Race to be "loudest"
- Heavy limiting destroyed dynamics
- Streaming normalization largely ended the war

**Modern approach:**
- Aim for appropriate loudness, not maximum
- Preserve dynamics for emotional impact
- Let platforms handle normalization
- Master for -14 to -16 LUFS for streaming

### Measuring LUFS

**Professional Tools:**
- **iZotope Insight** — Comprehensive metering
- **WLM Plus** (Waves) — Loudness meter
- **Youlean Loudness Meter** — Free, accurate
- **TBProAudio dpMeter** — Free, multiple standards

**DAW Built-in:**
- Logic Pro: Loudness Meter
- Ableton Live: LUFS metering in 11+
- Pro Tools: UV22HR with loudness
- Studio One: Loudness detection

**Online:**
- **Orban Loudness Meter** — Browser-based
- **Youlean Online** — Quick checks

### Mastering for Multiple Platforms

**Option 1: Single Master (-14 LUFS)**
- Works for all streaming platforms
- May sound quiet on SoundCloud/Bandcamp
- Recommended for most artists

**Option 2: Multiple Masters**
- **Streaming master:** -14 LUFS
- **SoundCloud/Bandcamp:** -10 to -11 LUFS
- **Vinyl:** -16 to -18 LUFS (less limiting)
- **CD:** -9 to -11 LUFS

**Option 3: Dynamic Master**
- Master at -14 LUFS with headroom
- Let platforms normalize
- Accept slight loudness disadvantage on non-normalized platforms

---

## Audio Formats

### Uncompressed Formats

#### WAV (Waveform Audio File Format)
- **Extension:** .wav
- **Compression:** None
- **Quality:** Lossless, identical to source
- **Use for:** Masters, archiving, distribution delivery
- **Pros:** Universal compatibility, simple
- **Cons:** Large file sizes

**Common WAV Specifications:**
| Spec | Use Case |
|------|----------|
| 16-bit / 44.1kHz | CD quality, final consumer format |
| 24-bit / 48kHz | Standard for video, streaming masters |
| 24-bit / 96kHz | High-resolution archiving |
| 24-bit / 192kHz | Audiophile releases, overkill for most |

#### AIFF (Audio Interchange File Format)
- **Extension:** .aiff or .aif
- **Compression:** None
- **Quality:** Lossless, identical to WAV
- **Use for:** Mac ecosystem, professional audio
- **Pros:** Supports metadata better than WAV
- **Cons:** Slightly less universal than WAV

**Note:** WAV and AIFF are sonically identical. Choose based on workflow and metadata needs.

#### Broadcast Wave Format (BWF)
- **Extension:** .wav
- **Features:** Timecode, metadata embedding
- **Use for:** Film/TV, professional workflows
- **Standard:** EBU R128 compliance

### Lossless Compressed Formats

#### FLAC (Free Lossless Audio Codec)
- **Extension:** .flac
- **Compression:** ~50–70% of original size
- **Quality:** Bit-perfect reconstruction
- **Use for:** Archiving, high-quality distribution
- **Pros:** Smaller than WAV, full quality
- **Cons:** Not supported by all DAWs natively

**FLAC Specifications:**
- Supports up to 32-bit / 655kHz
- Tagging support (Vorbis comments)
- Streaming compatible

#### ALAC (Apple Lossless Audio Codec)
- **Extension:** .m4a
- **Compression:** Similar to FLAC
- **Quality:** Lossless
- **Use for:** Apple ecosystem
- **Pros:** Native Apple support
- **Cons:** Less universal than FLAC

### Lossy Compressed Formats

#### MP3 (MPEG-1 Audio Layer III)
- **Extension:** .mp3
- **Compression:** 90%+ size reduction
- **Quality:** Varies by bitrate
- **Use for:** Consumer distribution, streaming

**MP3 Bitrate Guide:**
| Bitrate | Quality | Use Case |
|---------|---------|----------|
| 128 kbps | Acceptable | Voice, previews |
| 192 kbps | Good | Casual listening |
| 256 kbps | Very Good | Standard for distribution |
| 320 kbps | Excellent | Maximum MP3 quality |

**MP3 Types:**
- **CBR (Constant Bitrate):** Fixed file size, predictable
- **VBR (Variable Bitrate):** Smarter allocation, better quality
- **ABR (Average Bitrate):** Compromise between CBR and VBR

#### AAC (Advanced Audio Coding)
- **Extension:** .m4a, .aac
- **Compression:** Better than MP3 at same bitrate
- **Quality:** Superior to MP3
- **Use for:** Apple Music, iTunes, streaming

**AAC Bitrate Equivalents:**
- 256 kbps AAC ≈ 320 kbps MP3
- 128 kbps AAC ≈ 192 kbps MP3

#### Ogg Vorbis
- **Extension:** .ogg
- **Compression:** Open-source, efficient
- **Quality:** Comparable to AAC
- **Use for:** Spotify streaming, open-source projects

### Format Comparison Table

| Format | Size (3-min song) | Quality | Best For |
|--------|-------------------|---------|----------|
| WAV 24/48 | ~75 MB | Perfect | Masters, archiving |
| FLAC | ~35 MB | Perfect | Distribution, archiving |
| ALAC | ~35 MB | Perfect | Apple ecosystem |
| MP3 320 | ~7 MB | Excellent | General distribution |
| AAC 256 | ~6 MB | Excellent | Apple platforms |
| MP3 128 | ~3 MB | Acceptable | Previews, voice |

---

## Delivery Specifications

### Digital Distribution Requirements

#### Standard Delivery Specs

| Parameter | Specification |
|-----------|---------------|
| **Format** | WAV or FLAC |
| **Bit Depth** | 16 or 24-bit |
| **Sample Rate** | 44.1kHz or 48kHz |
| **Channels** | Stereo (2.0) |
| **Loudness** | -14 LUFS (streaming) |
| **True Peak** | -1 dBTP |

#### Platform-Specific Requirements

**Spotify:**
- Accepts: WAV, FLAC, MP3 320
- Recommended: WAV 24-bit/48kHz
- Loudness: -14 LUFS integrated

**Apple Music:**
- Accepts: WAV, AIFF, CAF
- Recommended: WAV 24-bit/48kHz
- Loudness: -16 LUFS (Sound Check)

**Bandcamp:**
- Accepts: WAV, AIFF, FLAC, MP3 320
- Recommended: WAV or FLAC
- No loudness normalization

**SoundCloud:**
- Accepts: WAV, AIFF, FLAC, MP3, OGG
- Recommended: WAV 24-bit
- No normalization (louder masters perform better)

### Physical Format Specifications

#### CD (Red Book Standard)

| Parameter | Specification |
|-----------|---------------|
| **Format** | PCM |
| **Bit Depth** | 16-bit |
| **Sample Rate** | 44.1kHz |
| **Channels** | Stereo |
| **Maximum Length** | 79.8 minutes |
| **File System** | ISO 9660 |

**CD Master Delivery:**
- DDP (Disc Description Protocol) image
- PQ codes for track markers
- ISRC embedding
- UPC/EAN barcode

#### Vinyl

| Parameter | Specification |
|-----------|---------------|
| **Format** | Analog lacquer/DMM |
| **Source** | 24-bit/96kHz minimum |
| **Side Length** | < 20 min for 12" 33 RPM |
| **Bass Management** | Centered below 150Hz |
| **High Frequencies** | Limited above 15kHz |

**Vinyl Master Considerations:**
- Sides over 20 min reduce quality
- Inner grooves have less fidelity
- Stereo bass causes skipping
- Sibilance causes distortion

#### Cassette

| Parameter | Specification |
|-----------|---------------|
| **Format** | Analog tape |
| **Source** | 24-bit/48kHz |
| **Type** | Type I (ferric), Type II (chrome) |
| **Length** | C30, C60, C90, C120 |

---

## Sample Rate & Bit Depth

### Sample Rate

Sample rate determines the highest frequency that can be recorded (Nyquist theorem: max frequency = sample rate ÷ 2).

| Sample Rate | Max Frequency | Use Case |
|-------------|---------------|----------|
| 44.1kHz | 22.05kHz | CD standard, music distribution |
| 48kHz | 24kHz | Video, film, streaming |
| 96kHz | 48kHz | High-res recording, archiving |
| 192kHz | 96kHz | Audiophile, experimental |

**Recommendation:** Record at 48kHz or 96kHz, deliver at 48kHz for streaming, 44.1kHz for CD.

### Bit Depth

Bit depth determines dynamic range (the difference between quietest and loudest sounds).

| Bit Depth | Dynamic Range | Use Case |
|-----------|---------------|----------|
| 16-bit | 96 dB | CD quality, final delivery |
| 24-bit | 144 dB | Recording, mixing, archiving |
| 32-bit float | 1528 dB | DAW internal processing |

**Recommendation:** Record and mix at 24-bit, master to 16-bit for CD or 24-bit for streaming.

### The Recording Chain

**Optimal workflow:**
1. **Record:** 24-bit / 48kHz or 96kHz
2. **Mix:** 32-bit float / session rate
3. **Bounce for mastering:** 24-bit / session rate
4. **Master:** 24-bit / session rate
5. **Deliver:** 
   - Streaming: 24-bit / 48kHz
   - CD: 16-bit / 44.1kHz
   - Archive: 24-bit / 96kHz

---

## File Organization & Naming

### Naming Conventions

**Master Files:**
```
ArtistName_SongName_Master_24bit_48kHz.wav
ArtistName_SongName_Master_16bit_44kHz.wav
ArtistName_AlbumName_UPC_123456789012.wav
```

**Stems:**
```
ArtistName_SongName_Stem_Drums.wav
ArtistName_SongName_Stem_Bass.wav
ArtistName_SongName_Stem_Instruments.wav
ArtistName_SongName_Stem_Vocals.wav
```

**Versions:**
```
ArtistName_SongName_RadioEdit.wav
ArtistName_SongName_Instrumental.wav
ArtistName_SongName_TVTrack.wav
ArtistName_SongName_Clean.wav
```

### Folder Structure

```
AlbumName_UPC/
├── 01_Masters/
│   ├── 24bit_48kHz/
│   ├── 16bit_44kHz/
│   └── MP3_320/
├── 02_Stems/
│   ├── SongName1/
│   ├── SongName2/
│   └── ...
├── 03_Alternates/
│   ├── RadioEdits/
│   ├── Instrumentals/
│   └── CleanVersions/
├── 04_Artwork/
│   ├── Cover_3000x3000.jpg
│   ├── Cover_1500x1500.jpg
│   └── Cover_600x600.jpg
└── 05_Docs/
    ├── Tracklist.txt
    ├── Credits.txt
    ├── ISRC_Codes.txt
    └── LinerNotes.pdf
```

---

## Quality Control Checklist

### Before Delivery

- [ ] Listen on multiple systems (car, earbuds, home stereo)
- [ ] Check for clicks, pops, distortion
- [ ] Verify fade-ins and fade-outs
- [ ] Confirm track spacing (for albums)
- [ ] Measure LUFS with professional meter
- [ ] Check true peak levels
- [ ] Verify metadata (ID3 tags, ISRC)
- [ ] Confirm file naming convention
- [ ] Create backup copies

### Technical Verification

| Check | Tool | Pass Criteria |
|-------|------|---------------|
| **Loudness** | LUFS meter | Within ±1 LUFS of target |
| **True Peak** | True peak meter | Below -0.5 dBTP |
| **DC Offset** | DC meter | < 0.1% |
| **Phase** | Correlation meter | Mostly positive |
| **Mono Compatibility** | Mono check | No cancellation issues |

---

## Tools & Resources

### Loudness Meters
- **Youlean Loudness Meter** (Free/Paid)
- **Waves WLM Plus**
- **iZotope Insight**
- **TBProAudio dpMeter**

### Format Conversion
- **XLD** (Mac) — Free
- **dBpoweramp** (Windows) — Paid
- **FFmpeg** (Cross-platform) — Free, command-line
- **Audacity** (Cross-platform) — Free

### Quality Analysis
- **Spek** — Free spectrum analyzer
- **Fakin' The Funk?** — Bitrate detector
- **Audacity** — Waveform analysis

### Standards Organizations
- **ITU-R BS.1770** — LUFS standard
- **EBU R128** — European broadcast standard
- **ATSC A/85** — US broadcast standard
- **AES** — Audio Engineering Society

---

*Last updated: 2025*
