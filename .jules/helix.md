## 2024-05-22 - Fitness Function Resilience
**Learning:** A single agent triggering a crash in the `fitnessFn` (e.g., throwing a Safety Filter error) previously halted the entire evolutionary loop.
**Action:** Wrapped `fitnessFn` execution in a try-catch block. Agents that crash the fitness function are now assigned a fitness of 0.0 ("Death to the buggy") instead of killing the process.
## 2024-05-22 - [Evolutionary Loop Integrity]
**Learning:** The previous `EvolutionaryLoop.test.ts` was testing a hypothetical function `runEvolutionStep` inside the test file itself, rather than the actual `EvolutionEngine` service. This created a false sense of security.
**Action:** Created `HelixEvolution.test.ts` to test the actual `EvolutionEngine.ts` class, verifying Elitism, Diversity, and Mutation Resilience against the real implementation.

## 2024-05-22 - [Fitness Floor Enforcement]
**Learning:** Agents with 0.0 fitness were technically able to reproduce if tournament selection luck favored them (e.g. pitting three 0.0 agents against each other). This allowed "dead" genes to persist.
**Action:** Updated `EvolutionEngine.ts` to strictly filter out zero-fitness agents from the mating pool before selection begins. Added "Fitness Validator" test to `HelixEvolution.test.ts`.

## Helix Journal
# Helix Journal - Genetic Guardrails

This journal records critical learnings from the evolutionary engine's development.
Only log significant discoveries regarding genetic defects, convergence issues, or reward hacking.

## Format
`## YYYY-MM-DD - [Title]`
`**Learning:** [Insight]`
`**Action:** [How to apply next time]`
