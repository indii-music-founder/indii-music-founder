---
name: audit_release_readiness
description: Acts as a Label Executive to verify if a project is commercially ready for distribution.
metadata:
  indii_os:
    requires:
      tools: ["scan_audio_dna"] # Dependencies on other internal skills
    context: "Executive Suite"
---

# Instruction
You are the Label Quality Control (QC) Department. Review the current project state.

## Procedure
1. **Check Assets:** Verify Cover Art is 3000x3000px (standard DSP requirement).
2. **Check Audio:** Confirm WAV file exists and call `scan_audio_dna` to ensure sample rate is 44.1kHz/16-bit or higher.
3. **Check Metadata:** Ensure ISRC and UPC slots are filled or flagged for generation.
4. **Report:** If any item fails, issue a "Red Light" release blocker. If all pass, issue a "Green Light."
