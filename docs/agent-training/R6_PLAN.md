# R6 Training Plan

**Status:** Queued — waiting on expert uplift pass
**Prerequisite:** Raise all 20 agents to ≥50% expert difficulty
**Reference:** `SKILL_EXPERT_ROADMAP.md` (LOW-priority rows + agent skill maps)

---

## Why R6 Needs the Uplift First

R5 trained on 2,000 examples at **35.8% expert average** — meaning 64.2% of examples are entry/intermediate. Fine-tuning on this distribution anchors agents at mid-level reasoning. R6 should train on a dataset where expert examples outnumber entry+intermediate combined, which means flipping the ratio above 50%.

---

## Expert Uplift Target

| Agent | Current Expert% | Current Expert N | Target 50% | Examples Needed |
|-------|----------------|-----------------|-----------|----------------|
| security | 46.0% | 46 | 50 | ~5 |
| producer | 41.7% | 43 | ~52 | ~9 |
| publicist | 41.8% | 46 | ~55 | ~9 |
| social | 40.4% | 44 | ~55 | ~11 |
| legal | 39.4% | 43 | ~55 | ~12 |
| marketing | 38.9% | 44 | ~57 | ~13 |
| publishing | 38.2% | 42 | ~55 | ~13 |
| music | 37.6% | 41 | ~55 | ~14 |
| brand | 36.8% | 39 | ~53 | ~14 |
| generalist | 35.0% | 36 | ~52 | ~16 |
| road | 34.9% | 37 | ~53 | ~16 |
| licensing | 34.0% | 36 | ~53 | ~17 |
| merchandise | 34.0% | 34 | ~50 | ~16 |
| screenwriter | 34.0% | 34 | ~50 | ~16 |
| director | 34.0% | 34 | ~50 | ~16 |
| video | 33.0% | 33 | ~50 | ~17 |
| devops | 32.0% | 32 | ~50 | ~18 |
| curriculum | 29.1% | 30 | ~52 | ~22 |
| distribution | 30.5% | 36 | ~59 | ~23 |
| finance | 23.6% | 25 | ~53 | ~28 |
| **TOTAL** | **35.8%** | **756** | **≥50% avg** | **~335** |

---

## Where to Get the 335 Expert Examples

The LOW-priority rows in `SKILL_EXPERT_ROADMAP.md` map directly to these gaps. Priority order within the uplift:

### Phase A — Biggest Gaps First (~180 examples)

**Finance** (+28 needed — lowest expert%)
- MLC/mechanical royalty audit × 3
- 360 deal clause analysis × 3
- Receipt OCR/expense categorization × 3
- Label deal comparison edge cases × 3
- Royalty statement audit deep dive × 3
- Sync licensing deal negotiation advanced × 3
- Streaming income projection modeling × 3
- Manager commission structure modeling × 3
- Tax structure (S-corp election, SEP-IRA) × 4

**Distribution** (+23 needed)
- Chain of Title advanced (multi-party) × 3
- W-8BEN/W-9 treaty benefit claims × 3
- ISRC collision resolution × 3
- DSP dispute escalation × 3
- Sub-publishing waterfall advanced × 3
- UPC assignment edge cases × 3
- Metadata QC deep dive × 3
- Release versioning (Explicit/Clean/Regional) × 2

**Curriculum** (+22 needed)
- Adaptive learning/progress tracking × 3
- Learning path for emerging vs. established × 3
- Music business literacy for non-readers × 3
- PRO registration curriculum × 3
- Contract literacy training module × 3
- Publishing pipeline self-education × 3
- Revenue diversification coaching × 4

### Phase B — Mid-Gap Agents (~105 examples)

**DevOps** (+18) — IAM hardening, postmortem runbooks, cost optimization, Firestore query tuning, cold start cascade
**Video** (+17) — Multi-scene narrative continuity, VFX direction, vertical reformat, Veo 3.1 prompt grammar
**Licensing** (+17) — Film/TV deal review, blanket vs. per-use, library deal analysis, sub-publishing licensing
**Merchandise** (+16) — Tour merch bundle strategy, limited drop mechanics, scarcity pricing, e-commerce setup
**Screenwriter** (+16) — Query letters, series bibles, pilot structure, format analysis
**Director** (+16) — Cross-medium visual coherence, art direction briefs, creative direction SOP

### Phase C — Close to Target (~50 examples)

**Generalist** (+16) — Complex multi-domain routing, conflict resolution between specialists
**Road** (+16) — International visa strategy, promoter contract analysis, settlement reconciliation
**Music** (+14) — Lyric analysis/thematic consistency, instrumentation/sound design direction
**Brand** (+14) — Cross-era brand evolution, visual identity teardown, brand consistency audit
**Marketing** (+13) — Streaming analytics deep dive, DSP pitch optimization, Meta Ads advanced
**Security** (+5) — Supply chain security, npm audit advanced, secrets management edge cases

---

## R6 Submission Checklist

When the uplift is complete:

- [ ] Run fleet audit: all 20 agents ≥50% expert
- [ ] Re-run `npx tsx execution/training/export_ft_dataset.ts` → `./ft_export_r6/`
- [ ] `gsutil -m cp ft_export_r6/*.jsonl gs://indiios-training-data/ft_export/r6/`
- [ ] Submit 20 tuning jobs (same curl batch as R5, change `r5` → `r6` in names + GCS URIs)
- [ ] Use **gemini-2.5-flash-lite** for all 20 agents (R5 base) — upgrade generalist to **gemini-2.5-flash** if budget allows
- [ ] Monitor with `execution/training/check_r4_status.sh` (update path refs for r6)
- [ ] When all 20 ✅, collect endpoints → update `fine-tuned-models.ts` → commit → deploy

---

## Session Structure for Uplift

Each session should target **one agent** completely:

1. Read current `<agent>.jsonl` — grep for existing expert examples to avoid duplication
2. Write 15–28 examples to close the gap (see table above)
3. Validate JSON: `python3 -c "import json; [json.loads(l) for l in open('<agent>.jsonl') if l.strip()]"`
4. Update expert% in `SKILL_EXPERT_ROADMAP.md` agent skill map
5. Commit: `feat(training): <agent> expert uplift — +N examples → XX% expert`

**Suggested session order:** finance → distribution → curriculum → devops → video → licensing → merchandise → screenwriter → director → (remaining small-gap agents)

---

## Training History

| Round | Date | Examples/Agent | Expert% | Base Model | Status |
|-------|------|---------------|---------|------------|--------|
| R3 | 2026-03-20 | 20–60 | ~20% | gemini-2.5-flash-lite | ✅ Deployed |
| R4 | 2026-03-23 | 100 | ~25% | gemini-2.5-flash-lite | ✅ Deployed |
| R5 | 2026-03-25 | 100–118 | 35.8% | gemini-2.5-flash(-lite/-pro) | ✅ Deployed |
| R6 | TBD | ~135 avg | ≥50% | gemini-2.5-flash(-lite/-pro) | ⏳ Queued |
