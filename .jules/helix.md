## 2024-05-23 - [Genetic Defect: Self-Crossover in Small Populations]
**Learning:** When using Tournament Selection with a small population (e.g., < 10) and a high Tournament Size (e.g., 3), the probability of selecting the same agent as both `parent1` and `parent2` is extremely high. This leads to "Self-Crossover" (Asexual Reproduction), which dramatically reduces genetic diversity and effectively bypasses the benefits of crossover logic.
**Action:** In future engine iterations, enforce `parent1 !== parent2` during selection, or implement a "Sexual Selection" penalty for self-breeding. For now, tests must account for this behavior by using larger populations or explicitly testing for self-crossover resilience.

## 2024-05-24 - [The Empty Soul Mutation]
**Learning:** A mutation function (simulated or real LLM) can technically return a valid object structure (JSON) that is semantically "dead" (e.g., empty string System Prompt). If the engine does not inspect the content, these "Zombie Genes" infect the population, wasting generations.
**Action:** Implemented strict Guardrails in `EvolutionEngine.evolve` to reject offspring with empty or whitespace-only system prompts immediately, forcing a retry of the reproduction step. Survival of the fittest now requires basic semantic validity.
