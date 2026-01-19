## 2026-01-14 - Video Generation Tool ignored duration
**Learning:** The `VideoTools.generate_video` tool accepted a `duration` argument in its schema but failed to pass it to the underlying `VideoGeneration.generateVideo` service. This meant users (or the AI) specifying a duration would silently get the default duration.
**Action:** When auditing tools that wrap service calls, explicitely verify that *every* argument in the tool signature is actually passed to the service function. Added a unit test to enforce this parameter passing.
