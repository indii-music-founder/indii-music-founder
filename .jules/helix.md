## 2024-05-19 - [Self-Crossover Defect]
**Learning:** In "Last Man Standing" scenarios (1 survivor), standard crossover logic failed because it required 2 distinct parents.
**Action:** Updated `EvolutionEngine` to allow `selectParent` to pick the same parent twice if diversity is low.

## 2026-01-12 - [Doomsday Switch Implementation]
**Learning:** The Evolution Engine lacked an internal generation cap, relying solely on the caller. This risks infinite loops if the orchestrator fails.
**Action:** Implemented strict `maxGenerations` check inside `EvolutionEngine.evolve` and verified with "Doomsday Switch" test.
