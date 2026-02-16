# Gap Analysis - Gold Standard Distributor Features

## Executive Summary
This document analyzes the current state of the platform against the "Gold Standard" feature set required for a modern music distributor. It flags gaps as **Critical** (required for certification) or **Competitive** (market leader features).

## 1. Identity & Coding Infrastructure (The "Must-Haves")

### ISRC (International Standard Recording Code)
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** System must assign unique 12-character alphanumeric code to every track.
*   **Current State:** The system assumes ISRC is provided by the user or an external adapter (DistroKid/Symphonic). No internal generation logic exists.
*   **Plan:** Implement `IdentifierService` to generate ISRCs using a configurable Registrant Code (e.g., `US-XXX-24-00001`).

### UPC/EAN (Universal Product Code)
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** System must generate 12/13-digit barcode for release containers (Album/EP/Single).
*   **Current State:** Similar to ISRC, UPC is treated as an input or external dependency.
*   **Plan:** Implement `IdentifierService` to generate UPCs (GTIN-12) with valid checksums (Luhn algorithm).

### ISWC (International Standard Musical Work Code)
*   **Status:** 🟡 **Partial / Competitive**
*   **Requirement:** Allow users to input ISWC to link recording to composition.
*   **Current State:** `GoldenMetadata` has an optional `iswc` field. `ERNMapper` maps it (needs verification).
*   **Plan:** Verify strict mapping in ERN.

## 2. Metadata & Ingestion Standards (DDEX)

### DDEX ERN 4.3 Support
*   **Status:** 🟢 **Implemented**
*   **Requirement:** Backend must map database fields to DDEX ERN 4.3 schema.
*   **Current State:** `ERNMapper.ts` and `types/ern.ts` explicitly reference ERN 4.3 and support AI flagging.
*   **Plan:** Verify "Mandatory Metadata Fields" coverage.

### Mandatory Metadata Fields
*   **Status:** 🟡 **Partial**
*   **Requirement:** Capture Contributors, P-Line/C-Line, Explicit Ratings, Lyrics.
*   **Current State:**
    *   **Contributors:** Mapped in `ERNMapper`, but roles might need expansion (currently assumes simple roles).
    *   **P/C Line:** Exists in `ExtendedGoldenMetadata`.
    *   **Explicit:** Exists (`parentalWarningType`).
    *   **Lyrics:** Field exists in `GoldenMetadata` (`lyrics?: string`), but `ERNMapper` does **not** appear to map it to a `<Resource>` or `<Details>` element in the XML output.
*   **Plan:** Update `ERNMapper` to include Lyrics in the ERN message.

## 3. Asset Management & Quality Control

### Audio Specs (WAV/FLAC Validation)
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** Validate lossless WAV/FLAC (16/24-bit, 44.1kHz+).
*   **Current State:** `DeliveryService` copies files but does not appear to perform deep technical validation (sample rate/bit depth checks) beyond file extension.
*   **Plan:** Need a validation step (likely needing `ffmpeg` or `music-metadata` in Cloud Functions) to reject bad files. *Note: For this task, I will implement a logical stub/check structure.*

### Artwork Specs
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** Validate 3000x3000px, RGB, JPG/PNG.
*   **Current State:** `DDEXReleaseRecord` has `coverArtWidth`/`Height` fields, but no active validation logic found in `services`.
*   **Plan:** Add validation logic in `DeliveryService` or `MetadataService`.

## 4. Financial Engine (Royalties & Splits)

### Split Pay
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** Designate percentages to other users and route payments.
*   **Current State:** `FinanceService` is a skeleton with simulated earnings. `RoyaltySplit` exists in Metadata types, but no *logic* executes the split of incoming revenue.
*   **Plan:** Implement `RoyaltyService` to ingest a "Earnings Report" and generate "Payout Records" based on splits.

### Recoupment
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** Allow recouping expenses before splits.
*   **Current State:** No logic found.
*   **Plan:** Add `RecoupmentService` or logic within `RoyaltyService`.

## 5. Fraud Detection & Security

### Automated Content Recognition (ACR)
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** Integrate Audible Magic (or similar) to fingerprint audio.
*   **Current State:** No integration exists.
*   **Plan:** Create `FraudDetectionService` with an interface for ACR.

### Artificial Streaming Detection
*   **Status:** 🔴 **Critical Gap**
*   **Requirement:** Flag looping playlists, sudden spikes.
*   **Current State:** No logic exists.
*   **Plan:** Implement heuristic algorithms in `FraudDetectionService`.

## 6. Advanced Features (Competitive)
*   **Pre-Saves:** 🔴 Missing.
*   **Delivery Speed:** 🟡 Architecture supports async jobs (Inngest), but performance unverified.
*   **Analytics:** 🟡 Dashboard exists but uses simulated data.

---

## Action Plan
1.  **Identity:** Build `IdentifierService` (ISRC/UPC).
2.  **Metadata:** Fix `ERNMapper` for Lyrics.
3.  **Finance:** Build `RoyaltyService` (Splits/Recoupment).
4.  **Security:** Build `FraudDetectionService` (Stubs + Heuristics).
5.  **Verify:** Run `verify-gold-standard.ts`.
