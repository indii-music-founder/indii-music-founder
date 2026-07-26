# Real-User Authenticity Standard

This policy is mandatory for every agent and every workflow that evaluates,
demonstrates, or makes a claim about the product's user experience.

## The hard rule

A user-facing capability is proven only through the real application, a genuine
account, the account's real persisted state, and the real service path that a
customer uses.

Agents must never use any of the following in live-user, browser, end-to-end,
release-acceptance, demo-readiness, or production-validation work:

- Network or API mocks, route interception, stubbed service responses, fabricated
  success payloads, or fake generated assets.
- Seeded or preloaded product data that did not enter through the visible user
  workflow during the current account journey.
- Bypassed, injected, pre-authenticated, impersonated, or simulated
  authentication state.
- Artificial subscription, quota, entitlement, usage, organization, plan, or
  tier mutation.
- Hidden database, local-storage, API, console, or source-code manipulation that
  places the product into a state the user did not reach through the UI.

For free-user validation, create a genuinely new free account and discover the
real limits presented to that account. Never convert an account to “free” by
changing state behind the UI.

## Credential and environment rule

Use `https://indii.music/` for production real-user validation unless the user
explicitly requests another deployed environment. A local build is not
production evidence.

If a genuine signup or sign-in requires an email link, OTP, CAPTCHA, credential,
or authorization that the agent does not have, stop at that point and request
the official user authorization flow. Never replace missing credentials with a
fixture, token injection, alternate identity, or adjacent authentication
mechanism.

## Evidence and verdicts

A `PASS` requires evidence from the real UI and, where relevant, a reload,
sign-out/sign-in, or downstream reuse that proves the state persisted normally.
Capture the visible result and record the exact account tier and environment.

If the real path cannot be completed, the honest verdict is `BLOCKED`,
`UNAVAILABLE`, or `FAIL` with the observed reason. A simulated success is always
a failure of the testing process.

## Existing automated tests

The repository contains legacy unit, component, and browser suites that use
test doubles or simulated state. They may remain as isolated structural
regression checks until separately migrated, but:

- Agents must not run or cite a mock-backed suite as real-user, end-to-end,
  release, production, or free-tier evidence.
- Agents must not add or expand mocks for a user journey, external service,
  authentication path, persisted customer state, or plan/entitlement behavior.
- When an agent touches a mock-backed user-path test, it must either migrate the
  path to genuine integration or clearly classify the remaining test as
  structural-only and leave the real-user claim unverified.
- Deterministic unit tests may use literal inputs for pure logic, but those
  inputs must not impersonate a customer, external service, authenticated
  session, persisted product history, or paid/free entitlement.

CI may continue to execute legacy structural suites during migration. A green
legacy suite does not override a failed or unverified real-user path.

## Reporting language

Every agent report that discusses user-facing validation must state:

1. The real environment used.
2. Whether the account was genuinely created through the UI.
3. The actual plan shown by the product.
4. Whether any part of the path remains blocked or unverified.

Never use “real user,” “end-to-end,” “production verified,” “free-tier verified,”
or equivalent language when any part of the claimed path used simulation.
