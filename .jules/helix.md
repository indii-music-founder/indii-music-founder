## 2024-05-23 - [Genetic Defect: Self-Crossover in Small Populations]
**Learning:** When using Tournament Selection with a small population (e.g., < 10) and a high Tournament Size (e.g., 3), the probability of selecting the same agent as both `parent1` and `parent2` is extremely high. This leads to "Self-Crossover" (Asexual Reproduction), which dramatically reduces genetic diversity and effectively bypasses the benefits of crossover logic.
**Action:** In future engine iterations, enforce `parent1 !== parent2` during selection, or implement a "Sexual Selection" penalty for self-breeding. For now, tests must account for this behavior by using larger populations or explicitly testing for self-crossover resilience.

## 2024-05-24 - [The Empty Soul Mutation]
**Learning:** A mutation function (simulated or real LLM) can technically return a valid object structure (JSON) that is semantically "dead" (e.g., empty string System Prompt). If the engine does not inspect the content, these "Zombie Genes" infect the population, wasting generations.
**Action:** Implemented strict Guardrails in `EvolutionEngine.evolve` to reject offspring with empty or whitespace-only system prompts immediately, forcing a retry of the reproduction step. Survival of the fittest now requires basic semantic validity.
## 2024-05-19 - [Self-Crossover Defect]
**Learning:** In "Last Man Standing" scenarios (1 survivor), standard crossover logic failed because it required 2 distinct parents.
**Action:** Updated `EvolutionEngine` to allow `selectParent` to pick the same parent twice if diversity is low.

## 2026-01-12 - [Doomsday Switch Implementation]
**Learning:** The Evolution Engine lacked an internal generation cap, relying solely on the caller. This risks infinite loops if the orchestrator fails.
**Action:** Implemented strict `maxGenerations` check inside `EvolutionEngine.evolve` and verified with "Doomsday Switch" test.

## 2026-05-27 - [The Zombie Gene Prevention]
**Learning:** If an offspring inherits a fitness score (e.g., via buggy Crossover logic copying the parent object), the engine must strictly reset it to `undefined` upon birth. Failure to do so allows "Zombie Agents" to bypass the fitness function in the subsequent generation, surviving solely on inherited glory without validation.
**Action:** Added `HelixLifecycle.test.ts` to enforce `fitness: undefined` on all new offspring, acting as a mandatory "Birth Certificate" for the next cycle.
## 2026-01-15 - [The Bloat Check]
**Learning:** Without explicit length constraints, the mutation function could theoretically produce infinitely growing prompts (Runaway Mutation), potentially crashing the context window of the LLM.
**Action:** Implemented "The Bloat Check" in `EvolutionEngine` (cap at 100k chars) and verified it with `HelixSanity.test.ts`.
## 2024-05-22 - [Gene Loss Prevention]
**Learning:** Mutated agents can sometimes lose their "parameters" object (brain) if the mutation function (LLM) returns partial JSON. The original engine guardrail only checked for `systemPrompt`, allowing "Brainless" agents (undefined parameters) to crash the runtime later.
**Action:** Implemented a "Brainless" Check in `EvolutionEngine` to strictly validate that `parameters` exist and are an object before accepting an offspring. Added `HelixGeneLoss.test.ts` to verify this rejection.

## 2026-05-28 - [Mutation by Reference Defect]
**Learning:** In environments where Crossover returns a direct reference to a parent (Lazy Crossover), subsequent Mutation operations (if in-place) will corrupt the Elite survivors in the previous generation. This destroys the "Elitism" guarantee, causing the best agents to be overwritten by their own mutated offspring.
**Action:** Implemented a mandatory "Deep Clone" (via structuredClone) of the offspring immediately after Crossover in EvolutionEngine. This ensures that the new generation is physically distinct from the old one, preserving the integrity of Elite agents.
## 2026-06-01 - [Mutation by Reference]
**Learning:** If a Crossover function lazily returns a reference to a parent (instead of a new object), and the subsequent Mutation function modifies that object in-place, the original Parent (which might be an Elite preserved in the next generation) gets corrupted. This breaks Elitism and population stability.
**Action:** Implemented a "Reference Integrity Check" in `EvolutionEngine` that detects if an offspring is a reference to a parent and creates a deep copy (JSON clone) before allowing mutation. Verified with `HelixReferenceIntegrity.test.ts`.

## 2026-06-02 - [Mutation Safety & Retry Logic]
**Learning:** Flaky mutation functions (e.g., LLMs producing invalid JSON/syntax errors) can cause generation gaps if not handled. The `EvolutionEngine` effectively catches these errors and retries the mutation step, ensuring the population size is preserved with valid agents.
**Action:** Created `HelixMutationSafety.test.ts` to verify that invalid syntax errors trigger a retry loop, preventing "dead" slots in the next generation.

## 2026-06-03 - [Time Paradox: NaN Generations]
**Learning:** When input agents have malformed metadata (e.g., `generation: undefined`), the offspring calculation `Math.max(undefined, undefined)` resulted in `NaN` generations. These "Timeless Agents" effectively bypassed the "Doomsday Switch" (Max Generations check), potentially leading to infinite evolutionary loops.
**Action:** Implemented "Time Integrity Check" in `EvolutionEngine` to treat undefined generations as 0, ensuring the evolutionary clock always ticks forward. Verified with `HelixChronos.test.ts`.

## 2026-06-04 - [The Flaky Universe]
**Learning:** Testing "Selection Pressure" (Fitness Ranking) with standard random seeds is mathematically flaky. A test that passes 99% of the time because "Alpha is extremely likely to be picked" is a defect in the Verification Layer.
**Action:** Enforced Strict Determinism in `HelixMicroUniverse.test.ts` by mocking `Math.random` to 0.0, ensuring that "Survival of the Fittest" is a guarantee in the test environment, not a probability.
