# R7 Training Plan

**Status:** Uplift in progress
**Goal:** Push all 20 agents to ≥60% expert density
**Baseline:** R6 deployed 2026-03-27 — fleet at 54.3% expert (1,608/2,964 examples)

---

## Why ≥60%?

R6 crossed the 50% threshold — expert examples now outnumber entry+intermediate combined.
R7 pushes to 60% to further sharpen domain reasoning and reduce hedging in complex multi-step scenarios. The agents at exactly 50.0% (6 agents) are sitting at the floor — they need the most work.

---

## Expert Gap Table (exact counts to reach 60%)

| Agent | Current Expert% | Expert N | Total | Examples Needed |
|-------|----------------|----------|-------|----------------|
| distribution | 50.0% | 82 | 164 | **+41** |
| finance | 50.3% | 82 | 163 | **+40** |
| marketing | 50.0% | 69 | 138 | **+35** |
| legal | 50.0% | 66 | 132 | **+34** |
| publishing | 50.0% | 68 | 136 | **+34** |
| social | 50.0% | 65 | 130 | **+33** |
| curriculum | 51.3% | 77 | 150 | **+33** |
| music | 50.7% | 70 | 138 | **+32** |
| publicist | 50.0% | 64 | 128 | **+32** |
| producer | 50.4% | 61 | 121 | **+29** |
| security | 50.5% | 55 | 109 | **+26** |
| brand | 54.7% | 81 | 148 | **+20** |
| road | 55.5% | 86 | 155 | **+18** |
| devops | 56.4% | 88 | 156 | **+14** |
| generalist | 59.1% | 97 | 164 | **+4** |
| screenwriter | 59.5% | 97 | 163 | **+2** |
| director | 59.8% | 98 | 164 | **+1** |
| merchandise | 59.8% | 98 | 164 | **+1** |
| licensing | 59.8% | 104 | 174 | **+1** |
| video | 59.9% | 100 | 167 | **+1** |
| **FLEET** | **54.3%** | **1,608** | **2,964** | **+431 total** |

---

## Session Order (biggest gaps first)

### Batch 1 — Floor Agents (+209 examples)
Priority: the 6 agents stuck at exactly 50.0% + finance

| Agent | Need | Session Quota | Notes |
|-------|------|--------------|-------|
| distribution | +41 | 2 sessions × 21 | DDEX, chain of title, ISRC collision, sub-publishing waterfall |
| finance | +40 | 2 sessions × 20 | 360 deals, touring tax nexus, label deal comparison, sync licensing |
| marketing | +35 | 2 sessions × 18 | Streaming analytics deep dive, DSP pitch, Meta Ads advanced |
| legal | +34 | 2 sessions × 17 | Contract redlines, publishing deal structure, work-for-hire edge cases |
| publishing | +34 | 2 sessions × 17 | Mechanical licensing, Harry Fox vs MLC, co-pub deal structure |
| social | +33 | 2 sessions × 17 | YouTube optimization, crisis moderation, community management |

### Batch 2 — Mid-Gap Agents (+153 examples)

| Agent | Need | Notes |
|-------|------|-------|
| curriculum | +33 | Adaptive learning, music business literacy, PRO registration training |
| music | +32 | Lyric analysis, instrumentation direction, sound design |
| publicist | +32 | Crisis PR, long-lead press strategy, international PR |
| producer | +29 | SAG-AFTRA compliance, multi-day shoot logistics, post-production |
| security | +26 | Supply chain security, secrets management, CI/CD hardening |

### Batch 3 — Close-to-Target Agents (+69 examples)

| Agent | Need | Notes |
|-------|------|-------|
| brand | +20 | Cross-era evolution, identity teardown, brand crisis |
| road | +18 | International visa, promoter contracts, settlement reconciliation |
| devops | +14 | Cost optimization, postmortem runbooks, Firestore query tuning |
| generalist | +4 | Multi-domain conflict resolution, context-aware escalation |
| screenwriter | +2 | Series bible, query letter format |
| director/merchandise/licensing/video | +1 each | Edge case scenarios |

---

## Naming Convention

**Scenario IDs:** `{agent}_r7_{type}_{NNN}` where type is `expert` for all R7 additions

Examples:
- `distribution_r7_expert_001`
- `finance_r7_expert_001`
- `marketing_r7_expert_001`

---

## R7 Submission Checklist

- [ ] All 20 agents at ≥60% expert density
- [ ] Run `npx tsx execution/training/export_ft_dataset.ts` → `./ft_export_r7/`
- [ ] `gcloud storage cp ft_export_r7/*.jsonl gs://indiios-training-data/ft_export/r7/`
- [ ] Submit 20 tuning jobs (`indii-{agent}-r7`)
- [ ] Base models: generalist → `gemini-2.5-pro`; finance/legal/distribution/marketing/publishing/licensing/music → `gemini-2.5-flash`; rest → `gemini-2.5-flash-lite`
- [ ] Wire endpoints into `fine-tuned-models.ts`
- [ ] CI green

---

## Training History

| Round | Date | Avg Examples | Expert% | Base Model | Status |
|-------|------|-------------|---------|------------|--------|
| R3 | 2026-03-20 | 20–60 | ~20% | gemini-2.5-flash-lite | ✅ Deployed |
| R4 | 2026-03-23 | 100 | ~25% | gemini-2.5-flash-lite | ✅ Deployed |
| R5 | 2026-03-25 | 100–118 | 35.8% | gemini-2.5-flash(-lite/-pro) | ✅ Deployed |
| R6 | 2026-03-27 | ~148 avg | 54.3% | gemini-2.5-flash(-lite/-pro) | ✅ Deployed |
| R7 | TBD | ~165 avg | ≥60% | gemini-2.5-flash(-lite/-pro) | ⏳ In progress |
