# Skill: Direct Distribution Engine (Industrial V3)

**A proprietary, AI-first infrastructure designed to disrupt white-label incumbents (SonoSuite, LabelGrid, Eveara).**

## ✅ Implementation Status

| Phase | Name | Status | UI Component |
|-------|------|--------|--------------|
| 1 | Metal Layer | ✅ Complete | `PythonBridge`, `package_itmsp.py`, `ddex_generator.py` |
| 2 | Brain Layer | ✅ Complete | `QCPanel.tsx`, `qc_validator.py`, `content_id_csv_generator.py` |
| 3 | Authority Layer | ✅ Complete | `AuthorityPanel.tsx`, `isrc_manager.py` |
| 4 | Bank Layer | ✅ Complete | `BankPanel.tsx`, `tax_withholding_engine.py`, `waterfall_payout.py` |
| 5 | Keys (Merlin/MLC) | 🔲 Strategic | External partnerships required |

---

## 🏗️ Phase 1: Metal Layer (Direct Infrastructure Disruption)

* **Strategy**: bypass the "marketing shell" model by building direct delivery pipes.
* **Protocol**: DDEX ERN 4.3 (XML Standard).
* **Transmission**: IBM Aspera FASP (Port 33001) for stable high-volume ingestion.
* **Direct-to-DSP**: Use Transporter CLI for Apple Music `.itmsp` packaging, removing reliance on re-branded SaaS providers.

## 🧠 Phase 2: Brain Layer (AI Forensics & QC)

* **Metadata AI**: Automated enforcement of style guides (Apple/Spotify).
* **Audio Forensics**: `audio_forensics.py` detects upsampled low-bitrate fraud.
* **TIN Match Forensics**: Programmatic verification of Tax Identification Numbers to prevent "TIN Match Fail" status on DSP platforms.
* **UI**: `QCPanel.tsx` provides interactive metadata validation and YouTube Content ID CSV generation.

## 🛡️ Phase 3: Authority Layer (Issuer Status)

* **Identity**: Functioning as an **ISRC Manager** and **GS1 Prefix owner**.
* **Registry**: `isrc_manager.py` maintains the permanent "license plate" records for assets.
* **Exclusivity**: AI-driven Content ID filter to ensure sound recording exclusivity.
* **UI**: `AuthorityPanel.tsx` provides ISRC/UPC generation and DDEX XML output.

## 🏦 Phase 4: Bank Layer (Digital Compliance & Clearinghouse)

* **Digital Compliance Officer**: Automated W-8BEN/W-9 selection and ingestion flow.
* **TIN Logic**: Digital matching of TINs against residency records.
* **Certification Block**: Mandatory digital signature under penalties of perjury for tax treaty claims.
* **Waterfall Engine**: Advanced royalty splits (`Gross -> Indii Fee -> Recoup -> Splits`) via `waterfall_payout.py`.
* **UI**: `BankPanel.tsx` provides tax calculation simulation and withholding visualization.

## 🔑 Phase 5: Keys (Strategic Strategy)

* **Merlin Readiness**: Meeting "in-house delivery" requirements for premium commercial terms.
* **MLC Bridge**: BWARM standard alignment for mechanical royalty transparency.

## 🛠️ Execution Toolbox

| Script | Function | Category |
|--------|----------|----------|
| `ddex_generator.py` | Industrial XML generation | Metal |
| `audio_forensics.py` | Spectral fraud detection | Brain |
| `qc_validator.py` | DSP style guide enforcement | Brain |
| `content_id_csv_generator.py` | YouTube CID bulk metadata | Brain |
| `isrc_manager.py` | Release identity persistence | Authority |
| `tax_withholding_engine.py` | Digital tax officer (W-8/W-9/TIN) | Bank |
| `waterfall_payout.py` | Multi-party industrial settlement | Bank |

## 🖥️ UI Components

All panels are accessible via the **Distribution Dashboard** (`/distribution`):
* **Distributors Tab**: Platform connection management
* **Bank Layer Tab**: Tax compliance simulation
* **Authority Tab**: ISRC/UPC/DDEX generation
* **Brain (QC) Tab**: Metadata validation & Content ID
* **Active Releases Tab**: Delivery tracking

## 🔌 Electron Integration

All Python scripts are executed via `PythonBridge` in the Electron main process:
* IPC handlers in `electron/handlers/distribution.ts`
* Preload bridge in `electron/preload.ts`
* Type definitions in `src/types/electron.d.ts`
