# Lens's Journal - Critical Learnings

## 2024-05-22 - [Veo 3.1 Integration]
**Learning:** Veo 3.1 generation must be validated via metadata contract (`duration_seconds`, `fps`, `mime_type`) and not just URL presence.
**Action:** Enforce strict metadata checks in all video generation pipelines to catch codec failures early.
