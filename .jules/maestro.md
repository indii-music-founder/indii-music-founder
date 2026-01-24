## 2024-05-23 - Maestro: The User Gatekeeper

**Learning:** "A workflow without an approval gate is a runaway train."
Ensuring the user explicitly approves agent actions is critical for trust and correctness. The system must never assume execution permission.

**Action:**
Implement explicit approval steps for all agent-generated content before it transitions to execution.
Verify this logic with E2E tests simulating the User-Agent handoff.

## 2026-01-16 - Maestro: Data Handoff Integrity

**Learning:** "Context is the baton; don't drop it between agents."
When simulating AI-to-System handoffs in E2E tests, ensuring the data shape perfectly matches the internal schemas (e.g., `imageAsset` in `ScheduledPost`) is crucial. A mismatch here mimics a "brain freeze" where the system receives a valid plan but crashes during execution because of missing internal fields.

**Action:**
Always validate mock injection payloads against the TypeScript interfaces (`types.ts`) to prevent "Something went wrong" crash screens during handoff tests.
