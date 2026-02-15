## 2024-05-23 - Chat Overlay Status Patterns

**Learning:** The Chat Overlay uses a non-blocking "Status Bar" in the footer to indicate processing (`isAgentProcessing`), which remains active during streaming. This differs from "Blocking Loader" patterns.
**Action:** When testing transitions, assert that the status indicator remains visible alongside streaming content until the final completion state (`isAgentProcessing: false`).
