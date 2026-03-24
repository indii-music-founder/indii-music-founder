---
description: Agent training data generation, fine-tuning, and deployment workflow
---

# Agent Training Workflow

// turbo-all

## Overview

This workflow manages the full lifecycle of agent training data: generation, validation, export to Vertex AI format, fine-tuning submission, and deployment to production.

## Prerequisites

- gcloud CLI authenticated (`gcloud auth login`)
- Project: `indiios-v-1-1` (Project Number: `223837784072`)
- GCS bucket: `gs://indiios-training-data/`
- Training datasets at `docs/agent-training/datasets/*.jsonl`

---

## Phase 1: Check Dataset Status

1. Run the fleet audit to see current example counts and expert difficulty:

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

1. Target: 100+ examples per agent, 50%+ expert difficulty.

---

## Phase 2: Generate Training Examples

Write examples to `docs/agent-training/datasets/<agent_id>.jsonl` following the schema in `docs/agent-training/datasets/SCHEMA.md`.

Each example needs: `agent_id`, `scenario_id` (unique), `scenario`, `category`, `quality_tier`, `source`, `difficulty`, `input`, `expected`.

Categories: `routing`, `tool_use`, `refusal`, `edge_case`, `adversarial`, `few_shot`

---

## Phase 3: Export to Vertex AI Format

1. Run the export script (creates 80/20 train/eval split):

```bash
npx tsx execution/training/export_ft_dataset.ts --agent=all --output=./ft_export_r4 --split
```

1. Verify export:

```bash
wc -l ft_export_r4/*.jsonl | tail -5
```

---

## Phase 4: Upload to GCS

```bash
gsutil -m cp ft_export_r4/*.jsonl gs://indiios-training-data/r4/
```

---

## Phase 5: Submit Fine-Tuning Jobs

Submit all 20 agents via Vertex AI REST API:

```bash
# Single agent example:
curl -s -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/223837784072/locations/us-central1/tuningJobs" \
  -d '{
    "baseModel": "gemini-2.5-flash-lite",
    "supervisedTuningSpec": {
      "trainingDatasetUri": "gs://indiios-training-data/r4/<agent_id>_train.jsonl",
      "validationDatasetUri": "gs://indiios-training-data/r4/<agent_id>_eval.jsonl",
      "hyperParameters": {
        "epochCount": 3,
        "learningRateMultiplier": 1.0,
        "adapterSize": "ADAPTER_SIZE_FOUR"
      }
    },
    "tunedModelDisplayName": "indii-<agent_id>-v1-r4"
  }'
```

Batch launcher script: `/tmp/launch_r4_tuning.sh`

---

## Phase 6: Monitor Job Status

```bash
bash execution/training/check_r4_status.sh
```

Jobs typically take 2-6 hours. The script shows ✅/🔄/⏳/❌ per agent and prints endpoint IDs for completed jobs.

---

## Phase 7: Deploy New Endpoints

1. When all jobs show ✅, collect the new endpoint IDs from the status script.

2. Update `src/services/agent/fine-tuned-models.ts` — replace R3 endpoint IDs with R4 ones.

3. Ensure `.env` has:

```
VITE_USE_FINE_TUNED_AGENTS=true
```

1. Deploy:

```bash
npm run deploy
```

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/agent-training/MASTER_TRAINING_PLAN.md` | Master strategy and status |
| `docs/agent-training/datasets/*.jsonl` | 20 training datasets (100 each) |
| `docs/agent-training/datasets/SCHEMA.md` | Example format specification |
| `execution/training/export_ft_dataset.ts` | Export conversion script |
| `execution/training/check_r4_status.sh` | R4 job monitoring script |
| `src/services/agent/fine-tuned-models.ts` | Live endpoint registry |
| `docs/agent-training/SCORECARD.md` | Quality rubric |

## Training History

| Round | Date | Examples/Agent | Base Model | Status |
|-------|------|---------------|------------|--------|
| R3 | 2026-03-20 | 20-60 | gemini-2.5-flash-lite | ✅ Deployed |
| R4 | 2026-03-23 | 100 (80 train / 20 eval) | gemini-2.5-flash-lite | 🔄 Training |
