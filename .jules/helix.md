## 2026-01-20 - Helix: Diversity Measurement
**Learning:** High mutation rates (near 1.0) are critical for maintaining diversity in small populations (Micro-Universes) during testing. Without forced mutation, small gene pools collapse into clones rapidly, making diversity metrics effectively zero.
**Action:** When testing diversity or evolutionary drift in small populations (< 10 agents), always set `mutationRate: 1.0` in the test config to simulate accelerated evolution and guarantee unique phenotypes for assertions.
# HELIX'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2024-05-23 - [Fitness Validation]
**Learning:** Zero-fitness agents must be strictly culled from the breeding pool to prevent regression.
**Action:** Enforced strict filtering in `HelixFitnessValidator` test suite.
## 2024-05-23 - Helix Evolutionary Loop Verification
**Learning:** Verified the integrity of the Helix Evolutionary Loop. Specifically, confirmed that:
1. Selection Pressure works deterministically when random seed is controlled.
2. Mutation Safety (Retry on Failure) is robust, ensuring "Survival of the fittest, but death to the buggy".
3. Gene Loss Prevention mechanisms (Deep Cloning and Schema Validation) effectively block "Brainless" mutations and "Mutation by Reference" defects.

**Action:** Continue to enforce strict deterministic seeding in tests to ensure that selection pressure is actually selecting the fittest agents and not just relying on luck. Ensure all future evolutionary features have corresponding "Gene Loss" tests.

## 2026-06-15 - [JSON Safety Guardrails]
**Learning:** Mutations can produce valid JS objects (like Arrays or Circular References) that are invalid as Agent parameters (which must be strictly Objects and Serializable). Standard checks for truthiness or `typeof object` are insufficient.
**Action:** Implemented strict `Array.isArray()` checks and `JSON.stringify()` serialization tests in `EvolutionEngine` to prevent non-serializable or malformed agents from entering the persistent gene pool.

## 2026-10-12 - [Safety Filter Resilience]
**Learning:** LLM Providers (Gemini, OpenAI) often reject mutation requests with specific Safety Violations (Hate Speech, Dangerous Content) instead of generic 500 errors. The Evolutionary Engine treats these as transient failures and successfully retries to find a safe mutation path.
**Action:** Added `HelixSafetyFilter.test.ts` to explicitly simulate "Safety Violation" errors and verify that the engine retries breeding until a safe offspring is produced, rather than allowing the population to stagnate or crash.
## 2026-06-15 - [Persistence of Infinite Intelligence]
**Learning:** Agents attempting to achieve "God Mode" (Fitness = Infinity) are correctly ranked in-memory, but `JSON.stringify(Infinity)` yields `null`. This means "Superintelligent" agents are silently lobotomized (Fitness -> 0) upon database persistence, causing a catastrophic loss of the best genetic material.
**Action:** Implemented "The Icarus Check" to verify in-memory handling. For persistence, a custom serializer/transformer MUST be used to convert `Infinity` to a special string (e.g., "INF") or a safe maximum number before saving to JSON-based storage (Firestore).

## 2026-10-25 - [Population Explosion Control]
**Learning:** If 'eliteCount' exceeds 'populationSize', the selection phase can accidentally grow the population beyond limits, leading to memory bloat over generations.
**Action:** Enforced a hard cap in 'EvolutionEngine': effectiveEliteCount = Math.min(eliteCount, populationSize). Added 'HelixPopulationControl.test.ts' to verify strict adherence to population limits.

## 2026-10-27 - [Infinite Loop Protection]
**Learning:** If the breeding process (mutation/crossover) fails consistently (e.g. 100% failure rate due to API outage), the engine must not retry indefinitely.
**Action:** Verified that `EvolutionEngine` uses a `MAX_ATTEMPTS` safety break and returns a partial population (elites only) when breeding is exhausted. Added `HelixResilience.test.ts` case to lock this behavior.
