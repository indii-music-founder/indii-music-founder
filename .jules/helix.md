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
