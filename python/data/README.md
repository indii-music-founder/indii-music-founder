# `python/data/`

Runtime data store for the Python sidecar. Files here are not committed.

| File | Producer | Consumer |
|---|---|---|
| `optimizer_feedback.jsonl` | sidecar `POST /a2a/optimizer/feedback` | `python/tools/export_optimizer_feedback.py` |
| `finetune_export_<epoch>.jsonl` | the export tool above | manual upload to Gemini fine-tune (out of scope) |
