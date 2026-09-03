# Source and License Register: indii RAW Converter

This document lists all format specifications, reference documentation, libraries, and sample fixtures used in the development of the indii RAW Converter.

---

## 1. Standards and Specifications

| Specification | Version / Date | Publishing Body | Licensing / Terms | Application in indii RAW Converter |
|---|---|---|---|---|
| **Adobe Digital Negative (DNG) Specification** | 1.4.0.0 / 1.6.0.0 / 1.7.0.0 | Adobe Systems Inc. | Public specification; Royalty-Free Patent License granted by Adobe Systems Incorporated | Primary normative reference for DNG tags, SubIFD layout, CFA tags, ColorMatrix calibration, BaselineExposure, and preview IFDs. |
| **TIFF 6.0 Specification** | June 3, 1992 | Aldus Corporation / Adobe Systems | Public domain specification | Byte order (`II`/`MM`), IFD tag serialization, offset calculations, strip and tile structure. |
| **ITU-T Recommendation T.81 / ISO/IEC 10918-1** | 1994 | ITU-T / ISO / IEC | International Standard | Lossless JPEG process (SOF3), Huffman table structures (DHT), selection values/predictors (1–7), restart markers, and bitstream byte stuffing. |
| **Exif 2.32 (DC-008-2019)** | 2019 | JEITA / CIPA | Public industry standard | EXIF IFD structure, camera settings, lens model, exposure parameters. |
| **Sony ARW Public Format Analysis** | 2024–2026 | Public community reverse-engineering (XDA Developers, ExifTool, LibRaw) | Observable public behavior / fair use technical facts | Sony IFD0 / SubIFD offsets, MakerNote tag 0x7313 (`WB_RGGBLevels`), and 14-bit CFA segment layout. |

---

## 2. Dependencies and Crates

All code used in the native Rust conversion core (`packages/raw-converter`) is governed by permissive open-source licenses:

| Component / Crate | Version | License | Verification Status | Usage |
|---|---|---|---|---|
| `clap` | 4.x | MIT OR Apache-2.0 | Approved | Command-line argument parsing for the `indii-raw` CLI binary. |
| `serde` | 1.x | MIT OR Apache-2.0 | Approved | Serialization framework for structured JSON CLI output and IPC communication. |
| `serde_json` | 1.x | MIT OR Apache-2.0 | Approved | JSON serializer for machine-readable inspection and progress reporting. |
| `sha2` | 0.10.x | MIT OR Apache-2.0 | Approved | Cryptographic SHA-256 verification of normalized CFA sample buffers to prove 100% lossless conversion. |
| `byteorder` | 1.5.x | MIT OR Unlicense | Approved | Endian-aware byte reading and writing for TIFF/DNG headers and IFD tables. |

---

## 3. Test Fixtures and Verification Assets

| Fixture Name | Camera Model | Raw Format Variant | Dimensions | Source / License | Expected Metadata Manifest |
|---|---|---|---|---|---|
| `sample.ARW` | Sony ILCE-7M3 (A7 III) | 14-bit Bayer CFA, Lossless/Uncompressed ARW | 6024 x 4024 | Open community raw sample repository (CC0 / Public Domain) | Make: `SONY`, Model: `ILCE-7M3`, CFA: RGGB, ActiveArea: `[0, 0, 4024, 6024]`, BaselineExposure: `+0.35 EV` |
| `synthetic_sony_a7m4.arw` | Sony ILCE-7M4 (A7 IV) | 14-bit Bayer CFA, Uncompressed (Compression = 1) | 512 x 512 | Synthetic generator (indii test suite, MIT) | Make: `SONY`, Model: `ILCE-7M4`, CFA: RGGB, BlackLevel: 512, WhiteLevel: 16383 |
| `synthetic_sony_a7m5_ljpeg.arw` | Sony ILCE-7M5 (A7 V) | 14-bit Bayer CFA, Lossless JPEG segments (Compression = 6) | 512 x 512 | Synthetic generator (indii test suite, MIT) | Make: `SONY`, Model: `ILCE-7M5`, CFA: RGGB, Lossless JPEG SOF3 CFA segments |
