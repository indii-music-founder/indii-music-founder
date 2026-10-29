# ISSUE-1598 — Local MCP remote-request path validation

## Observed source behavior and implementation

Baseline `24a108f0b` interpolates GitHub owner/repository and Sentry organization/
project arguments into authenticated API URLs. Tool descriptions declare string
inputs, but the runtime previously coerced arbitrary values and accepted path,
query and fragment syntax. PR numbers were also coerced without integer bounds.

The two tools now validate bounded opaque ASCII path segments, reject dot
traversal/separators/encoding/query/fragment syntax, and require a positive safe
integer PR number. URL builders own the provider origin, endpoint and query.
Invalid inputs produce an MCP InvalidParams error before credential lookup or
fetch. These are path-security constraints, not a claim that every syntactically
valid namespace exists or is authorized by the provider.

Authenticated fetches reject redirects rather than changing their target
implicitly. A moved repository needs a deliberately corrected canonical input.
A failed GitHub comment fetch now returns an error, rather than a successful
empty comment list that could hide an authorization or provider failure.

## Local verification

```bash
npm run build -w @indii/mcp-server-local
npx vitest run --project mcp-server-local
```

The package compiles and all 18 package tests pass, including four new pure URL
contract tests. They cover both GitHub endpoint paths, the Sentry query, malicious
segments, missing/non-string inputs, and invalid PR numbers. No new network,
provider-response, account or authentication mocks were introduced. No GitHub
or Sentry account request was executed through these tools for this verification.
The existing MCP Vitest project already includes this package.

## Remaining scope and acceptance

This is a bounded slice of the recorded ISSUE-1598, not issue closure. The
Blender bridge's unauthenticated Python execution and the local PDF/audio read
permission boundaries remain separate unresolved parts of that finding.

Provider success/failure and moved-target behavior still need genuine authorized
integration acceptance. Missing or expired credentials require the provider's
official authorization flow; do not borrow a CLI token, change identities or
inject credentials to produce that evidence. This change neither configures
credentials nor proves that the desktop caller has a valid provider connection.
