# ISSUE-1599: packaged artifact storage and capability catalog — 2026-10-29

Status: PARTIAL; local filesystem/build evidence only.

## Confirmed gaps and repair

Artifact IPC used `process.cwd()/artifacts`, which can be an unrelated or read-only install directory in packaged builds. Registry IPC likewise read the checkout-relative `agents/capability_registry.json`, and electron-builder did not collect that file. Its source catalog also carries absolute build-machine root/agent paths.

Packaged artifact operations now use the Electron user-data directory. Development keeps its workspace directory for compatibility; old source artifacts are not silently moved into the installed app. The store accepts flat filenames, validates before directory creation, rejects symlinked artifact directories/entries and non-files, and replaces writes using an exclusive temporary file plus rename. Listing includes regular Markdown files only. IPC options are schema-validated and cannot override the returned stored path.

The registry read path selects bundled resources in packaged mode. The existing build hook projects the source catalog into a portable generated file, preserving all capability metadata while replacing root/agent paths with relative catalog identifiers. These identifiers are metadata, not proof that every referenced agent implementation is bundled or executable. electron-builder collects the generated catalog; the after-pack hook checks its presence, JSON and portable path form before the existing MCP package verification.

No additional filesystem grant or external account access is introduced. The artifact directory is app/OS-user storage; this repair does not claim separate cloud-account isolation. As with other pathname checks, an external process concurrently replacing filesystem objects can still create races; these tests do not prove resistance to an adversarial filesystem writer or crash/power-loss durability.

## Validation and remaining acceptance

Six tests use actual temporary files and symlinks for path selection, write/overwrite/reopen/list, absent storage, traversal rejection, file symlink rejection and directory symlink rejection. Nine unchanged legacy handler tests provide structural-only regression coverage. Two Node tests project the actual source catalog, compare every capability, prove its source root is absent from the output, and reject malformed catalogs. No auth/service/customer-state mocks were added.

The Linux packaging CI must exercise the actual collection/after-pack hook. Installed Windows/macOS behavior, a genuine customer UI export/reopen journey, actual plan, and persistent customer acceptance remain unverified. No account was created or provider action performed during this pass.

Knowledge updates are still pending: the source Python script mutates agent instruction files and invokes Git, while the handler/service target checkout or bundled paths. There is no established consumer for a writable packaged knowledge overlay. That script was not executed or presented as working. DAW socket authentication is also unresolved. The separately published render-input repair is not included in this branch; the earlier file-replacement repair is already on main. This is not a full ISSUE-1599 closure.

## Authorized package gate follow-up

The default branch Build workflow previously compiled without running electron-builder. Local unsigned packaging stopped at production preflight because this checkout lacked required configuration/credentials; no placeholders, alternate credentials or preflight bypass were used. On October 29 the owner explicitly approved the prepared CI package-check approach.

The Linux build now runs `npx electron-builder --dir --linux --publish never` after its existing credential-backed application build. This exercises actual resource collection and the after-pack verification with the current CI environment. No keys are retrieved locally, and no installer publication or deployment is enabled by this step. The result must be inspected at the follow-up commit SHA; approval or workflow configuration alone is not package evidence.
