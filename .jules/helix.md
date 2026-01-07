## 2025-05-23 - [Genetic Algo: Determinism in Testing]
**Learning:** Genetic Algorithms are inherently stochastic, which causes flaky unit tests if mutation rates are < 1.0. A mutation set to 50% might be skipped by the RNG, causing mocks to be ignored and tests to fail unexpectedly.
**Action:** Always force `mutationRate: 1.0` and strict `seed` control (if possible) in unit tests to ensure `mutate()` is called on every offspring when verifying mutation logic.
