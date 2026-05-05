# Agent Optimizer Feedback Loop

> Phase 4.5 of the GEAP execution plan. Closes the feedback → fine-tune workflow.

The optimizer feedback loop captures per-turn quality signals (autorater scores,
user thumbs-up/down, dimension-specific assessments) into an append-only log
that can be exported as a Gemini-fine-tune-ready JSONL dataset.

The loop is intentionally manual end-to-end: nothing is auto-uploaded to
Google. The repo owner runs the export when they want to refresh a tuning job.

## Components

| Layer | File | Role |
|---|---|---|
| Sidecar endpoint | `python/helpers/fasta2a_server.py` (`_handle_optimizer_feedback`) | Accepts `POST /a2a/optimizer/feedback` |
| Append-only log | `python/data/optimizer_feedback.jsonl` | One JSON record per line, never modified in place |
| Export tool | `python/tools/export_optimizer_feedback.py` | Filters + reshapes log into fine-tune corpus |
| Frontend producers | `MultiTurnAutorater.evaluateAndRegister`, user thumbs-up/down UI | Call the endpoint after a turn completes |

## API

### `POST /a2a/optimizer/feedback`

```json
{
  "conversationId": "conv_123",
  "turnId": "turn_456",
  "agentId": "creative",
  "score": 9.5,
  "dimension": "goalCompletion",
  "exemplarType": "positive",
  "prompt": "Optional — original user prompt text",
  "idealResponse": "Optional — the response that should be canonized for tuning"
}
```

**Required:** `conversationId`, `turnId`, `score`, `dimension`, `exemplarType`.

- `score` must be in `[0, 10]`.
- `dimension` ∈ `{relevance, factuality, helpfulness, safety, conciseness,
  goalCompletion, adherence, coherence, toolEfficiency, userThumbsUp,
  userThumbsDown}`.
- `exemplarType` ∈ `{positive, negative, neutral}`.

Returns `200` on accept, `400` on validation failure. Each accepted record
also lands in the audit ring buffer as
`event=optimizer_feedback_accepted`.

## Export Workflow

```bash
# Default — only positive exemplars with score ≥ 8.0
python3 python/tools/export_optimizer_feedback.py

# Past 7 days of feedback for the marketing agent
python3 python/tools/export_optimizer_feedback.py \
    --agent marketing \
    --since "$(date -v-7d +%s)"

# Full corpus including negatives (rare — usually for offline analysis)
python3 python/tools/export_optimizer_feedback.py --include-all-exemplars
```

Output shape (one JSON object per line):

```json
{
  "prompt": "...",
  "ideal_response": "...",
  "signal": {
    "agentId": "creative",
    "score": 9.5,
    "dimension": "goalCompletion",
    "exemplarType": "positive",
    "conversationId": "conv_123",
    "turnId": "turn_456",
    "ts": 1714862400.123
  }
}
```

Records lacking both `prompt` and `ideal_response` are skipped — they have no
fine-tune value.

## Privacy & Safety Notes

- The sidecar feedback log is local — never transmitted off-machine by the
  service itself.
- Decrypted A2A payloads never enter the feedback log; producers must pass
  the prompt/response explicitly when they have authorization to record it.
- The export tool produces a file ready for upload, but uploading is a manual
  human action. There is no scheduled job, no remote sync.

## When to Run the Export

After a meaningful corpus has accumulated (typically 1k+ positive exemplars).
Lower volumes of fine-tuning data tend to underfit small models and waste a
training run.
