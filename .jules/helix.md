## 2026-01-19 - Schema Compliance (The Brainless Check)
**Learning:** Mutations in the wild can occasionally strip agents of critical structural properties (e.g., `parameters` becoming null), leading to "Brainless" agents that crash the execution engine.
**Action:** Always verify structural integrity (existence of `parameters`, `systemPrompt`) immediately after mutation. If invalid, reject the offspring and retry the breeding step.
## 2024-05-22 - Missing Brainless Check Test
**Learning:** The "Brainless Check" (verifying `offspring.parameters` is not null) was implemented in `EvolutionEngine.ts` but lacked a dedicated test case verifying this specific guardrail.
**Action:** Created `HelixBrainless.test.ts` to assert that the engine rejects agents with missing parameters and retries mutation.
