---
name: auto_qa
description: Evidence-driven visual QA for indii using an approved browser capability that is actually available in the current host. Use after UI changes, for responsive or interaction checks, or when the user asks for screenshots, DOM evidence, console inspection, or a real signed-in UI walkthrough. Do not use as a substitute for unit tests, and never claim live-user proof from mocks or injected authentication.
---

# Auto QA

Verify the visible product surface without inventing state. The output is an environment-bound QA report, not a general claim that production works.

## Preconditions

1. Read `.agent/REAL_USER_AUTHENTICITY.md` before any live-user, end-to-end, production, demo-readiness, or release-acceptance claim.
2. Confirm the exact URL, build type, account/session, plan or entitlement state, and feature path.
3. Use an approved browser capability exposed by the current host. Do not hard-code one provider.
4. If official authentication is missing or expired, stop and present the official sign-in flow.
5. Do not use seeded product data, injected auth, fabricated responses, artificial entitlements, or a mocked build as real-user evidence.

## Select the proof level

| Level | Allowed evidence | Honest claim |
| --- | --- | --- |
| Structural | Component/unit tests or static render | The UI contract renders structurally. |
| Simulated | Explicit mock/emulator path | The simulated path behaves as asserted. |
| Local-real | Local build with genuine signed-in account and real persisted data | The exercised local path worked for that account and build. |
| Production-real | Production build, genuine account, real provider path | The exercised production path worked at the recorded time. |

Never promote one level into another.

## Workflow

1. Start or locate the intended environment and record its URL.
2. Inspect the DOM before clicking. Prefer stable roles, labels, test IDs, and visible text.
3. Exercise only the task's bounded path. Avoid paid, destructive, publishing, or irreversible controls unless explicitly authorized.
4. Inspect relevant console and network failures when the browser capability exposes them.
5. Capture screenshots at the state that proves the acceptance criterion; do not collect ornamental screenshots.
6. Re-check the DOM after each material action rather than relying on timing sleeps.
7. Clean up only resources created by this QA run. Never delete user data to reset the environment.

## Failure behavior

- Retry a flaky interaction at most twice after re-reading the DOM and environment state.
- If the required feature state is absent, report it as unavailable rather than injecting it.
- If the action would incur material cost or write externally, stop before the action and name the authority required.
- If browser tooling is unavailable, fall back to structural tests and label the evidence boundary.

## Report

```markdown
# Visual QA
- Environment/build:
- Authentication/account class:
- Evidence level:
- Path exercised:
- Passed:
- Failed or unavailable:
- Console/network evidence:
- Screenshots/DOM evidence:
- Actions intentionally not taken:
- Final verdict: PASS | PARTIAL | FAIL
```
