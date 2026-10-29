# ISSUE-1599: local render input access — 2026-10-29

Status: PARTIAL; this addresses the render-input and temporary-directory findings.

## Confirmed gap and repair

The `video:render` IPC handler checked output access, extension and parent scope, but forwarded every input source unchecked. Both direct FFmpeg jobs and composed jobs consume those sources. Preview compilation could also emit local image/audio/video references without checking their grants.

A shared input helper now resolves local paths/file URLs through `realpathSync`, checks the canonical path against the existing file-grant service, requires a regular file, and returns a copied project containing canonical file URLs. The handler validates every clip before invoking a render or preview. Invalid file URLs, NUL bytes, missing files and unsupported protocols fail closed. HTTP(S), blob and data sources retain their existing behavior; this change does not claim remote fetch/redirect or content validation.

The composed executor creates its working directory beneath `os.tmpdir()` and retains its existing `finally` cleanup. No broader grants, roots, token mechanisms, or security-policy bypasses were added. Existing session grants and app allowlisted roots remain the authority; this is not a new per-render approval dialog.

## Verification boundary

Five new tests use real temporary files/symlinks with a pure explicit-grant predicate. They cover denial in video/audio/image slots, canonicalization without mutation, symlink target denial, malformed/missing/non-file sources, and preserved web/embedded sources. The existing three coordinator and seventeen handler tests also pass, providing structural regression coverage only. Two legacy output-policy tests previously sent no project to a mocked-success renderer; they now supply a minimal empty project input and are explicitly labelled structural-only. Their service/auth mocks were not expanded. No new service/auth/customer-state mocks were added.

Local rendering with a genuine signed-in customer, an installed Windows/macOS build, and a real media export/reload have not been exercised. Canonicalization reduces path alias/symlink confusion, but does not eliminate an external filesystem mutation race between checking and executor reads. Source-file content and transitive references inside media containers are outside this proof.

The earlier multi-replacement boundary is already merged. Packaged artifact/knowledge/registry paths and unauthenticated DAW synchronization remain unresolved; this issue is not closed.

## Local validation results

All four unit shards passed after correcting the two invalid legacy test inputs: 2,881 + 2,290 + 3,030 + 2,975 = **11,176 passing tests**. The initial `npm run ci` returned failure for those two tests; its other gates and shards passed, and the affected shard was rerun successfully after the correction. The full pre-commit gates then passed. Scoped ESLint passed, and full lint finished with zero errors and 237 existing warnings. These are local structural/policy checks, not customer or production acceptance.
