## 2026-01-20 - Helix: Diversity Measurement
**Learning:** High mutation rates (near 1.0) are critical for maintaining diversity in small populations (Micro-Universes) during testing. Without forced mutation, small gene pools collapse into clones rapidly, making diversity metrics effectively zero.
**Action:** When testing diversity or evolutionary drift in small populations (< 10 agents), always set `mutationRate: 1.0` in the test config to simulate accelerated evolution and guarantee unique phenotypes for assertions.
