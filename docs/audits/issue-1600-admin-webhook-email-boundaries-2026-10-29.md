# ISSUE-1600 — Admin webhook and direct-email boundaries

## Confirmed source gaps and changes

Baseline `24a108f0b` compares the admin webhook secret with plain string
inequality and inserts an unescaped subject into the outbound HTML heading.
The Gmail raw-message path also accepts recipient control characters because
its only address check is the presence of `@`; those characters can introduce
additional raw headers.

The webhook middleware now compares SHA-256 digests with Node's native
`timingSafeEqual`, preserving its existing fail-closed missing-configuration
and unauthorized responses. Both digest buffers have the same fixed size;
this is not a claim that the entire HTTP request has constant execution time.

Subject and body text share a single HTML-escaping function. Plain subject
values remain unchanged for provider headers and audit data. Controlled body
line breaks are added only after escaping. Recipient inputs containing control
characters or comma/semicolon list separators are rejected before dispatch.
This is an injection boundary, not a complete RFC email-address validator.

## Local verification

```bash
npx vitest run packages/admin-dashboard/adminSecurity.test.ts packages/admin-dashboard/server.test.ts --maxWorkers=2
npx tsc -b packages/admin-dashboard
```

All 43 focused tests pass: six new pure string/byte tests and the 37 existing
server tests. New tests do not mock accounts, authenticated sessions, email
providers or persisted customer data. Existing server SDK/auth/provider test
doubles are unchanged and remain structural-only. No email or webhook was sent
to a live provider, and no production secret was inspected or rotated.

## Remaining scope and acceptance

This is a partial implementation of ISSUE-1600. Verified-email enforcement in
admin authentication and the real delivery/Nexus collection/query contracts
remain separate unresolved parts of the original finding. Do not infer that
the full admin authorization boundary is accepted from these changes.

After an authorized deployment, genuine authorized webhook and direct-email
verification still need the actual environment/account, bounded approved
recipient, visible result and provider receipt. Local structural tests do not
establish genuine authentication, message delivery, or issue closure.
