# ISSUE-1603: Boardroom report recovery — 2026-10-29

Status: PARTIAL. Source repair and structural checks; genuine deployed acceptance remains outstanding.

The owner supplied the incident transcript linked in GitHub #563. Shared execution instructions ordered bug reporting regardless of role, while DevOps did not have report_bug permission. BaseAgent fed the denial back into its loop, and delegation adapters returned successful completion even when the child response contained an error. These source facts explain the observed authorization repetition; they do not independently identify the provider-unavailable or later rate-limit cause, nor prove when the regression first shipped.

The repair keeps bug intake with the existing authorized Conductor, qualifies shared instructions by current permissions, stops execution on a terminal denial, and carries failed outcomes through direct, graph and A2A adapters. Transport projects only the bounded response fields, rather than copying tool arguments or asset data. Permission lists, security guards and iteration limits are unchanged. Error prose cannot become successful graph output. No issue receipt is fabricated.

Seven new pure outcome-contract tests use literal agent results without provider, authentication or customer mocks. The existing mocked security suite is structural-only; its denial assertion now requires one model invocation, one blocked call and the terminal failure classification. Existing prompt and A2A suites provide additional structural coverage. Local npm run ci passed all four shards (11,210 passed tests; existing skips retained). Its initial typecheck preceded the last transport projection and prompt refinements; a final full typecheck and focused 78-test run passed after those refinements. Full lint passed with zero errors and 237 existing warnings; scoped lint passed. Existing A2A suites plus the pure contract suite passed 9 tests with 2 existing skips. No check proves a live user journey.

## Personality investigation

The owner remembers changing Conductor and perhaps another persona, possibly enabling self-learning for all. No saved values were confirmed and no preferences were changed. High Brevity requests terse replies; high Formality requests institutional language. Apply to all saves the same values to eight personas. These mechanisms can explain similar or drier voices, but not report_bug authorization failures.

The Adaptive AI switch reads and writes indii_persona_autonomous_evolution in PersonaFadersSection.tsx. Source search found no runtime consumer of that key or automatic fader writer; manual Save and Apply to all are the observed save callers. The switch alone is not evidence of personality evolution. Memory extraction is a separate feature. The production app loaded visually, but semantic inspection timed out, so the owner's actual slider and switch values remain unverified. Keep ISSUE-1354's production proof requirement.

## Remaining acceptance

Publish and verify exact-commit CI, then release under the owner's normal workflow. In the genuine signed-in app, request one authorized report and inspect its durable receipt, verify one denied capability does not repeat, and check Boardroom conversation continuity. Read actual persona values through the real UI before attributing tone to them. Provider and Arcjet request evidence must be examined separately; this patch does not claim to resolve every unavailable-service or rate-limit response.
