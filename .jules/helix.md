## 2024-05-22 - Missing Brainless Check Test
**Learning:** The "Brainless Check" (verifying `offspring.parameters` is not null) was implemented in `EvolutionEngine.ts` but lacked a dedicated test case verifying this specific guardrail.
**Action:** Created `HelixBrainless.test.ts` to assert that the engine rejects agents with missing parameters and retries mutation.
