# Mega Stress Test Plan v13.0 (Blender MCP 3D Pipeline & Authoritative Asset Lifecycle)

This test protocol verifies the robustness of the Blender Model Context Protocol (MCP) tool integration, native process lifecycle management, render cancellation and timeout safety, print-resolution DPI tagging, distribution metadata pre-flight checks, and server-authoritative workflow execution rules.

## Section 1: Blender MCP Tool Registry & Process Lifecycle (GitHub #356–#363)
Routine 131. **Blender MCP Tool Registry Discovery & Web Fallback (GitHub #356, #357, #362, #363):** In the Video Studio, navigate to the 3D Blender render panel. In web-only mode (`VITE_RENDERER_ONLY=true`), verify the UI accurately explains that the web studio cannot inspect local Blender installations and directs the artist to the native desktop app, rather than falsely declaring Blender is uninstalled. In desktop Electron mode, verify that `blender_render_video` is registered and indexed with its full parameter schema.
Routine 132. **Input Validation Boundary & Error Propagation (GitHub #358, #359, #361):** Trigger a Blender render request via MCP with missing, empty, or unreadable audio input path. Verify the tool rejects the call immediately with an explicit error (`audioPath must point to a readable file`), ensuring no dangling process is spawned and no partial output artifact is retained on disk.
Routine 133. **Native Render Progress, Heartbeat & Timeout Reset (GitHub #357, #358):** Start a valid Blender procedural 3D render. Verify that real frame progress notifications from the Python runner are forwarded across IPC to the renderer UI without simulated or fabricated timer percentages. Verify that ongoing progress events dynamically reset the client timeout, honoring long renders up to the two-hour bounded deadline.
Routine 134. **Cancellation Handling & Child Process Teardown (GitHub #360, #361):** While a Blender render is in flight, click "Cancel Render" or close the owning window. Verify that the cancellation signal propagates through IPC, aborts the active MCP request, issues a SIGTERM/SIGKILL with a bounded grace period to the underlying Blender child process (verified via PID check), and purges any incomplete output file.

## Section 2: Print Quality & Creative Asset Integrity (GitHub #352, #355)
Routine 135. **Print-Ready 3000x3000px 300 DPI Density Injection (GitHub #355):** Open Creative Studio, generate or import an asset, and select the Print-Ready Upscale tool. Verify the image is rendered to exactly 3000x3000px and the output PNG contains valid 300 DPI physical pixel density metadata tags (`pHYs` chunk). Verify download dialog export preserves the density tags without async GPU memory stalls.
Routine 136. **Resolution Map Normalization & Aspect Preservation (GitHub #352):** In Creative Studio generation prompt settings, test various resolution input formats (`3000`, `3000px`, `3000x3000`, `3k`, `4k`). Verify that the normalizer maps 3k+ requests to the 4k tier rather than falling back to 1k, maintaining strict square aspect ratio and color gamut.

## Section 3: Legal & Distribution Pre-Flight Compliance (GitHub #353, #354)
Routine 137. **Metadata Pre-Flight Validation Engine (GitHub #353):** In Distribution Studio, navigate to the QC Panel. Input a release with an invalid 11-digit UPC and a malformed ISRC. Verify that pre-flight validation highlights the exact format violations, validates GTIN check-digits for UPCs, prevents release submission on strict errors, and allows saving non-blocking draft warnings.
Routine 138. **Automated Split Sheet & Copyright Registration Generation (GitHub #354):** In Legal Dashboard, open the Split Sheet Generator. Enter collaborator shares totaling 95% and attempt to export; verify the form blocks submission until shares reach exactly 100%. Adjust to 100% and generate the PDF; verify the signature blocks and PRO affiliation details are populated. Open Copyright Registration Modal and verify Form PA / SR package assembly.

## Section 4: Server-Authoritative State & Ingestion Gates (ISSUE-1450–1452)
Routine 139. **Claims Inbox Canonical Intake & Bounded Visibility (ISSUE-1450):** In Legal Dashboard, open the Claims Inbox tab. Verify that missing intake source displays an explicit "No verified claims" or unavailable status rather than falsely asserting an unencumbered catalog. Submit an owner-declared claim via `declareCanonicalRightsClaim`; verify atomic transaction commit with `claim.received` event and owner-scoped read restrictions.
Routine 140. **Workflow Execution Rules & Idempotency Lock (ISSUE-1451, ISSUE-1452):** Trigger an agent orchestration workflow. Verify that execution records are created via authenticated backend callables under App Check enforcement. Verify client writes are rejected by Firestore security rules (`permission-denied` on client writes to `workflow_executions`), and server transactionally claims steps without duplicate worker dispatch.

## Pass/Fail Criteria
| Result | Definition |
|--------|------------|
| ✅ PASS | All tool registrations discoverable, native process exits cleanly on cancel, 300 DPI tags present, validation rules enforce constraints, and backend writes remain server-authoritative. |
| ⚠️ PARTIAL | Routine succeeds but requires manual refresh or emits non-critical console warnings. |
| ❌ FAIL | Process leaks after cancellation, false completion toast on empty file, unhandled exception in IPC, or security rule violation. |

## Execution Notes
- Routines 131–134 require Desktop Electron environment with native Blender 5.x LTS installed for live process tests, and web browser for fallback verification.
- Routines 135–138 can be executed via browser subagent or Playwright E2E suites.
- Routines 139–140 require Firebase emulator or authenticated staging environment.
