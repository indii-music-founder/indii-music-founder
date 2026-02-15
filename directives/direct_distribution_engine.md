# Directive: Industrial Direct Distribution Engine (V3 Disruption)

## 🎯 Primary Goal

Disrupt white-label aggregators (SonoSuite, LabelGrid) by providing a proprietary, Strictly AI infrastructure that qualifies for direct DSP certification and Merlin membership.

## 📋 Standard Operating Procedures (Phases 1-5)

### Phase 1: Direct Pipes (Metal)

1. **DDEX Execution**: Trigger `ddex_generator.py`.
2. **Transporter Packaging**: For Apple Music, package media and XML into `.itmsp` bundles.
3. **High-Speed Delivery**: Use Aspera `ascp` for YouTube/DSPs via Port 33001.
4. **Semaphore Verification**: Post `delivery.complete` only after binary verification.

### Phase 2: AI Forensics (Brain)

1. **Metadata QC**: Apply `style_guide_apple.json`. Reject keywords: "Chill", "Sleep", "Lofi".
2. **Audio Forensics**: Run `audio_forensics.py`.
    * **HARD GATE**: Reject any file with a spectral cutoff (upsampled fraud).
3. **Visual Scans**: Vision check artwork for URLs/QR codes.

### Phase 3: Authority Layer (Identity)

1. **Issue Persistent IDs**: Assign ISRC and UPC via `isrc_manager.py`.
2. **Certification**: Ensure ISRC is never reused for different recordings.

### Phase 4: Compliance & Waterfall (Bank)

1. **Digital Tax Wizard**:
    * **Decision Tree**: US Person (W-9) | Int'l Individual (W-8BEN) | Int'l Entity (W-8BEN-E).
    * **TIN Match**: Verify TIN format. If invalid, trigger **TIN MATCH FAIL** and set payout to **HELD**.
2. **Certification Block**: Collect mandatory "Signature under penalties of perjury."
3. **Withholding Calculation**: Run `tax_withholding_engine.py`. Default to **30%** if uncertified.
4. **Waterfall Settlement**: Execute `waterfall_payout.py` (Fee -> Recoup -> Splits).

### Phase 5: Strategic Licensing (Keys)

1. **In-House Proof**: Maintain delivery logs to prove independent infrastructure for Merlin auditing.

## 🛑 Industrial Failure Conditions

- **TIN Match Fail**: Invalid tax ID format. STOP payouts.
* **Spectral Cutoff**: Suspected audio fraud. STOP delivery.
* **Metadata SEO Keyword**: "Lofi/Chill" detected. REJECT and notify.
* **Uncertified ID**: Missing perjury signature. LOCK 30% of funds.
