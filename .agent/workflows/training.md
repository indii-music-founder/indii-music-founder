# /training Workflow

## Trigger
Use when the user types `/training` or explicitly requests to run the AI agent training pipeline or dataset generation.

## Purpose
Executes the dataset generation and/or the cloud AI fine-tuning jobs for the multi-agent hub-and-spoke system.

## Execution Steps

1. **Verify Datasets:** 
   Check the current row counts of `docs/agent-training/datasets/*.jsonl`. If datasets are missing or the user wants to generate new mock examples based on the `HARNESS_TRAINING_PLAN.md`, run:
   ```bash
   npx tsx scripts/generate-harness-datasets.ts
   ```

2. **Confirm Cloud Training (Cost Warning):**
   Before initiating any external API calls or fine-tuning jobs that incur token/training costs (e.g., using Vertex AI or OpenAI fine-tuning APIs), the agent **MUST explicitly pause** and ask the user:
   > "Are you ready to initiate the cloud training jobs? This will incur real API costs."

3. **Execute Training:**
   Once explicit approval is given, execute the designated cloud training scripts for the datasets (e.g., triggering the Genkit model updates or Vertex AI fine-tuning pipelines).

## Success Criteria
- Datasets are formatted strictly according to the gold JSONL requirements.
- Cost constraints are respected (user approval required for paid API execution).
- Walkthrough report generated containing the updated dataset row counts and the status of the cloud training job.
