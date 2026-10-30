# ISSUE-1598: approved local MCP files — 2026-10-30

Status: PARTIAL. Local component/protocol evidence; desktop customer acceptance pending.

The PDF and audio metadata tools previously opened arbitrary supplied paths. They now request MCP roots from the desktop host for every read, canonicalize the target and roots, and reject targets outside that scope before extraction. Missing roots capability, invalid/nonlocal roots, missing paths and directory targets fail closed. Tool arguments cannot create grants.

The desktop host advertises roots support and supplies its existing AccessControlService system roots plus current session file/dialog grants. This preserves that service's existing scope, including the OS temporary directory; it is not a claim that all temporary files are private to this app. No new directory or root is granted by the tool. Canonicalization blocks stable symlink escapes, but does not establish immunity against concurrent filesystem replacement races.

Six focused checks passed. One uses real disposable filesystem objects for allowed files, external targets, symlink escape, explicit file roots, absent roots, unavailable/nonlocal roots and directory rejection. Five desktop service checks use actual SDK child-process stdio servers rather than mocked SDK clients/transports. Electron lifecycle/path and logging seams remain isolated; these checks are component evidence, not installed-app/user acceptance. The diagnostic child reports the actual roots exchange; it does not fabricate a provider or customer response. Local MCP compilation and main-process typecheck passed.

Remaining: finish repository checks and exact-SHA CI, then verify selected PDF/audio reads in the installed app and rejection outside its approved scope. Blender arbitrary code/socket authorization remains separately open under ISSUE-1598. No issue closure, deployment or customer acceptance is asserted.
