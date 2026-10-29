# ISSUE-1599 — Agent file replacement access boundary

## Confirmed source gap and bounded change

Baseline `24a108f0b` allowed `agent:multi-replace-file-content` to read and
overwrite any file lexically inside `process.cwd()`, without consulting
`AccessControlService`. A workspace boundary alone is not a filesystem grant.
The same string-only check accepted symlinks that pointed outside the workspace.

The handler now requires both canonical workspace containment and the existing
access-control decision before reading or writing. It operates on the canonical
file path that passed those checks. Non-file targets are rejected. This does not
grant a new root or change the existing access-control allowlist.

Replacement chunks are validated before writing, empty targets are rejected,
and every requested target must occur exactly once. The extracted edit function
also preserves replacement strings literally: the old `String.replace` call
interpreted dollar-sign substitution tokens instead of the requested text.
Any chunk validation/matching failure returns no replacement for the caller to
write.

## Structural verification

```bash
npx vitest run packages/main/src/utils/agent-file-access.test.ts packages/main/src/handlers/agent_path_canonicalization.security.test.ts --maxWorkers=2
```

Eight tests pass. The new tests use actual temporary files/symlinks and explicit
local path predicates, plus literal strings for edit validation. They introduce
no mocked account, authenticated session, provider response or entitlement.
The pre-existing IPC test remains structural-only and retains its existing
test doubles; it is not proof of genuine desktop sender authorization.

Full root typecheck and lint also pass (lint retains existing warnings).

## Remaining acceptance and scope

This is one implementation slice of ISSUE-1599, not issue closure. Packaged
artifact/knowledge/registry paths, render input permissions and temporary-path
portability, and DAW authentication remain separate parts of that finding.

The existing workspace restriction remains; this change does not make files
outside that workspace editable even when independently granted. Actual
packaged-app file selection, denial and save acceptance remain unverified.
Use a genuine application session and an explicitly approved disposable file
for that verification. No production or user-owned file was edited by these
tests. Concurrent external filesystem mutation between checking and opening a
path is not covered by this change.
