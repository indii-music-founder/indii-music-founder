## 2026-01-19 - Schema Compliance (The Brainless Check)
**Learning:** Mutations in the wild can occasionally strip agents of critical structural properties (e.g., `parameters` becoming null), leading to "Brainless" agents that crash the execution engine.
**Action:** Always verify structural integrity (existence of `parameters`, `systemPrompt`) immediately after mutation. If invalid, reject the offspring and retry the breeding step.
## HELIX'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2024-05-23 - [Mutation Rate & Clonal Stagnation]
**Learning:** Default mutation rates (e.g., 0.5) combined with conservative crossover (cloning parent traits) can lead to rapid clonal stagnation where diversity drops below 100%. In small populations, this looks like "Inbreeding" even if parents are distinct.
**Action:** When testing for diversity, explicitly force `mutationRate: 1.0` or ensure crossover introduces variation. For production, monitor the "Unique Prompt Ratio" as a key health metric.
## 2024-05-22 - Missing Brainless Check Test
**Learning:** The "Brainless Check" (verifying `offspring.parameters` is not null) was implemented in `EvolutionEngine.ts` but lacked a dedicated test case verifying this specific guardrail.
**Action:** Created `HelixBrainless.test.ts` to assert that the engine rejects agents with missing parameters and retries mutation.
