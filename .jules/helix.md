## 2024-05-22 - Fitness Function Resilience
**Learning:** A single agent triggering a crash in the `fitnessFn` (e.g., throwing a Safety Filter error) previously halted the entire evolutionary loop.
**Action:** Wrapped `fitnessFn` execution in a try-catch block. Agents that crash the fitness function are now assigned a fitness of 0.0 ("Death to the buggy") instead of killing the process.
