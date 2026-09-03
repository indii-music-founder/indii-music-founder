# indii RAW Converter: Clean-Room Decision Record

**Project**: indii RAW Converter (indii.music)  
**Date**: 2026-09-03  
**Status**: Approved & Enforced  

---

## 1. Clean-Room Principles

The indii RAW Converter is an independently designed and implemented, local-first RAW photo conversion system. To ensure absolute legal defensibility and intellectual property integrity, the following mandatory clean-room boundaries are maintained:

1. **No Proprietary Code Reuse**:
   - Zero lines of code, headers, comments, or data structures from Adobe Systems Inc. (including Adobe DNG Converter, Adobe DNG SDK, Adobe Camera Raw, Photoshop, or Lightroom) are present in this repository.
   - No disassembly, decompilation, dynamic instrumentation, or binary extraction of any Adobe executables has occurred.
   - Proprietary metadata blocks (such as Adobe's private MakerNote encryption or `DNGPrivateData` tag 50740) are explicitly NOT replicated or reverse-engineered.

2. **Public Specifications as Sole Format Authorities**:
   - The output DNG format is constructed exclusively against the publicly published **Adobe Digital Negative (DNG) Specification** (Versions 1.4.0.0, 1.6.0.0, and 1.7.0.0), which Adobe has explicitly licensed to all developers under the Digital Negative (DNG) Specification Patent License.
   - The underlying container is constructed against the **TIFF 6.0 Specification** (Aldus Corporation, June 1992).
   - Lossless compression is constructed against **ITU-T Recommendation T.81 (1992)** / **ISO/IEC 10918-1:1994** (Lossless JPEG process, SOF3, selection values 1–7).
   - EXIF metadata conforms to the **JEITA/CIPA DC-008-2019 (Exif 2.32)** standard.

3. **Permissive Dependency Policy**:
   - All external code libraries incorporated into the conversion core are audited for licensing compatibility.
   - Only permissive open-source licenses (MIT, Apache 2.0, BSD-3-Clause, Unlicense) are permitted.
   - No copyleft licenses (GPL, AGPL, LGPL) or proprietary licensed libraries are permitted in the build or runtime dependency graph.

4. **Brand Independence**:
   - This software is branded and owned solely as `indii RAW Converter`.
   - It makes no claim of affiliation with, sponsorship by, or endorsement from Adobe Systems Inc., Sony Corporation, or any other camera manufacturer.

5. **Data Protection & Safety**:
   - Source RAW files are treated as read-only, immutable assets. The converter opens them with read-only file descriptors and under no circumstances overwrites, mutates, or deletes the input file.
   - Output writing is atomic (write to temporary file, sync to disk, atomic rename).
   - No telemetric data containing image pixels, user EXIF data, file names, or file hashes is transmitted off the local machine.
