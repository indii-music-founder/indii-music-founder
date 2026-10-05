# Blender desktop MCP resource delivery

## Evidence and scope

Eight open production reports (#356–363) describe missing Blender discovery or
documentation. Current source registers the four Blender tools in the local MCP
server, agent bindings, capability registry and Creative/Video prompts. Production
web UI exposes Video Studio → 3D Blender but says “Blender Not Detected” and asks
the user to install it. The web service cannot establish host installation from
an unavailable desktop/MCP connection; that UI is not installation proof.

This host already runs Blender 5.2.2 LTS. The installed native studio is version
1.80.1 and lacks the 3D Blender tab. Its expected Resources/mcp-server-local and
Resources/mcp-server-harness directories are both absent. The packaging config
did not collect either server. Desktop startup looks for those exact paths, and
its child-server launch previously depended on a system `node` executable.

The native app restored the existing wiil account normally after startup; no
authentication or user state was injected. It showed wiil@indii.music and email
verification. Native Plan & Usage reported auth/network-request-failed, so its
plan could not be verified there. The separate genuine production web journey
used the existing Founding Member seat ii account (lifetime), not a new account.
No new Blender render was initiated in either product during this investigation.

## Repair

- Build both MCP servers into self-contained CommonJS resource packages before
  every electron-builder package operation, including direct release commands.
- Preserve PDF workers/fonts, FFprobe binaries and installed native optional
  dependencies as runtime packages; bundle ordinary JavaScript dependencies.
- Preserve all Blender Python scripts beside the bundled executor at the exact
  dist/python path it resolves, including the five templates and audio baker.
- Collect both resource packages at the existing desktop discovery paths.
- Launch server children with process.execPath and ELECTRON_RUN_AS_NODE=1, using
  the app's embedded runtime rather than requiring a user-installed Node.js.
- Verify isolated packages with real MCP child processes and tool responses in
  local CI, mainline CI and release CI. AfterPack also verifies the actual app's
  collected resources before signing/publishing. No mocks or product fixtures
  are used by this package check.
- Correct Video agent instructions that named nonexistent templates
  neon_grid_horizon/frequency_spectrum_bars and unsupported run_script. Guidance
  now uses IDs returned by the actual server and the supported live commands.

## Actual verification

Both resource packages were copied outside the checkout into a temporary
directory and launched through the installed studio executable in Node mode.
The runtime reported Node 24.18.0. The local server returned all four Blender
tools and actual status: installed=true, Blender 5.2.2, Metal, liveConnected=false.
The harness server returned its catalog. A separate real-process package check
verified status, template listing and the required Python files. This establishes
package/protocol behavior; it does not establish customer render acceptance.

Jev source review used 4,819 input and 77 output tokens. It returned advisory
probabilities .80 for a runtime dependency gap, .20 for a Python path gap, .65
for a false customer claim and .38 for an omitted packaged resource. Those broad
judgments are not a pass/fail gate. The actual isolated embedded-runtime probe
supports the narrower launch/status claim; the exact-resource AfterPack guard
checks omission; this record explicitly leaves customer rendering unverified.
Other platforms, signed distributable installation and release acceptance still
require their own evidence. No customer data or credentials were sent to Jev;
no dollar cost was returned.

Final local gates passed: monorepo typecheck, lint with zero errors and 217
existing warnings, and full CI with 9,353 passing tests. The isolated desktop MCP
package check passed in that full run. Legacy test suites are structural-only,
not customer render acceptance. Exact published SHA and remote CI are still
pending. The initial lint/CI catalog gate failed because the newly added npm
verification command changed the generated catalog. It was regenerated and its
validator passed. The known-invalid first CI process was deliberately terminated
(exit 143); the corrected full run completed with exit zero.

The installed desktop remains the older release. A signed updated distribution,
genuine app discovery/render/playback, live-addon connection, production web-to-
desktop handoff, native account network error and fresh/free-user acceptance
remain unverified. The eight reports are not closed by structural checks. The
full two-week completion goal remains open.
