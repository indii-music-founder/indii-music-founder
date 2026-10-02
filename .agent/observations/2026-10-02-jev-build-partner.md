# Jev build partner — catalog visibility

Two live `jev-latest` API requests used the existing authorized local environment credential; no credential was printed or persisted. No renderer-side Jev call or new secret was added.

The first judged the current roadmap evidence at `2785e9c5b` and selected the owner catalog visibility UI (Choice confidence 0.95). This agreed with the documented missing UI and delivered server callable. The all-complete Noul was 0.02. Usage: 2,212 input and 71 output tokens.

The second reviewed the actual component, parser, server checks and keyed owner mount for three specific failure conditions: client rights authorization, optimistic public status, and cross-owner action leakage. Nouls were respectively 0.04, 0.11, and 0.10. Usage: 2,828 input and 65 output tokens. These agree with source inspection; they are advisory judgments, not calibrated test verdicts.

Registration Center now offers Catalog visibility, including when the legacy track catalog is empty. It subscribes to up to 51 owner-readable locked master records, displays at most 50 with an explicit partial-view message, validates owner/hash/receipt/visibility fields, and exposes publish-confirmation and private-revocation actions through `setCatalogVisibility`. The backend remains the authority for receipt binding and preclearance. Status is read from server-owned records; failed reads clear actionable records. Owner changes remount the panel.

Evidence class: live external model on repository text plus structural validation. No production account, plan, publication, revocation, or customer journey was exercised. Genuine owner reload/public retrieval acceptance and the other roadmap gates remain open. ISSUE-1452 is partial.

Raw questions, answers, request IDs and token usage are in the adjacent `2026-10-02-jev-build-selection.json` and `2026-10-02-jev-visibility-review.json` files. Total usage: 5,040 input and 136 output tokens.
