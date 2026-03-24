---
description: Agent training data generation, fine-tuning, and deployment workflow
---

# Agent Training Workflow

// turbo-all

## Overview

This workflow manages the full lifecycle of agent training data: generation, validation, fine-tuning on Vertex AI, and deployment to production.

## Prerequisites

- Access to Vertex AI (`gcloud auth` configured)
- Node.js 22+ for export script
- Training datasets at `docs/agent-training/datasets/*.jsonl`

---

## Phase 1: Generate Training Data

1. Check current dataset status:

```bash
python3 -c "
import json, os, glob
dir = 'docs/agent-training/datasets'
for f in sorted(glob.glob(os.path.join(dir, '*.jsonl'))):
    name = os.path.splitext(os.path.basename(f))[0]
    with open(f) as fh: lines = [l.strip() for l in fh if l.strip()]
    expert = sum(1 for l in lines if json.loads(l).get('difficulty') == 'expert')
    pct = expert/len(lines)*100 if lines else 0
    ok = '✅' if len(lines) >= 100 else '❌'
    print(f'{name:<16} {len(lines):>4} examples  {pct:>5.1f}% expert  {ok}')
"
```

1. Use the `/training` workflow to generate examples for any agent needing more data.

2. Target: 100+ examples per agent, 50%+ expert difficulty.

---

## Phase 2: Validate & Export

1. Validate all datasets (no duplicates, correct agent IDs):

```bash
python3 -c "
import json, os, glob
dir = 'docs/agent-training/datasets'
errors = []
for f in sorted(glob.glob(os.path.join(dir, '*.jsonl'))):
    name = os.path.splitext(os.path.basename(f))[0]
    with open(f) as fh: lines = [l.strip() for l in fh if l.strip()]
    ids = set()
    for l in lines:
        obj = json.loads(l)
        sid = obj.get('scenario_id','')
        if sid in ids: errors.append(f'{name}: DUPLICATE {sid}')
        ids.add(sid)
        if obj.get('agent_id') != name: errors.append(f'{name}: wrong agent_id in {sid}')
    if len(lines) < 100: errors.append(f'{name}: only {len(lines)} examples')
if errors:
    for e in errors: print(f'❌ {e}')
else:
    print('✅ All 20 datasets valid')
"
```

1. Export to Vertex AI format:

```bash
npx ts-node execution/training/export_ft_dataset.ts --all --output=vertex_ai_datasets/
```

---

## Phase 3: Fine-Tune on Vertex AI

1. Upload exported datasets to GCS:

```bash
gsutil -m cp vertex_ai_datasets/*.jsonl gs://indiios-training-data/r4/
```

1. Create tuning jobs (per agent):

```bash
# Use Vertex AI Console or gcloud:
gcloud ai models create-tuning-job \
  --region=us-central1 \
  --base-model=gemini-2.5-flash-lite \
  --training-data=gs://indiios-training-data/r4/<agent_id>.jsonl \
  --tuned-model-display-name=<agent_id>-r4
```

1. Wait for jobs to complete (2-8 hours per job).

2. List completed models:

```bash
gcloud ai models list --region=us-central1 --filter="displayName~r4"
```

---

## Phase 4: Deploy to Production

1. Update `src/services/agent/fine-tuned-models.ts` with new R4 endpoint IDs.

2. Set feature flag:

```
VITE_USE_FINE_TUNED_AGENTS=true
```

1. Build and deploy:

```bash
npm run deploy
```

1. Verify with live stress test:

```bash
# Use /live_test_creative_director workflow or manual testing
```

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/agent-training/MASTER_TRAINING_PLAN.md` | Master strategy and status |
| `docs/agent-training/datasets/*.jsonl` | 20 training datasets (100 each) |
| `docs/agent-training/datasets/SCHEMA.md` | Example format specification |
| `execution/training/export_ft_dataset.ts` | Export conversion script |
| `src/services/agent/fine-tuned-models.ts` | Live endpoint registry |
| `docs/agent-training/SCORECARD.md` | Quality rubric |
