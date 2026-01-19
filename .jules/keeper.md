# Keeper's Journal

## 2024-05-24 - Initial Setup
**Learning:** Keeper journal initialized.
**Action:** Proceed with memory integrity audits.

## 2024-05-24 - BaseAgent Context Slicing
**Learning:** The `BaseAgent` was using a naive character slice (`MAX_HISTORY_CHARS = 32000`) for context truncation. This approach risks cutting off valid JSON or formatting, and doesn't respect the semantic value of messages (e.g., preserving the first message).
**Action:** Replaced naive slicing with `ContextManager.truncateContext` which uses token estimation and prioritization (System > Anchor > Recent > Middle). Verified with `Keeper_ContextIntegrity.test.ts`.
