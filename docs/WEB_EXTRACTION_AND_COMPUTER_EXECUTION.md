# Web Extraction and Computer Execution

**Status:** Current implementation contract (2026-09)

## Public web extraction

Agent web research uses one tool: `web_extract(url)`. It fetches a public HTTP(S) page in a hidden, sandboxed Electron window with a dedicated in-memory session. Requests are serialized, and cookies, storage, and cache are cleared before and after each request. The tool returns only the final URL, title, bounded page text, and fetch time. It does not return screenshots, click, type, submit forms, or retain page state between requests.

The main process validates the IPC sender and URL. The extraction service checks public DNS/IP safety for the initial URL and every HTTP(S) request, denies permissions, downloads, socket schemes, credential-bearing requests, and new windows, limits redirects and duration, and destroys the window and clears storage/cache on completion or failure. Web renderer callers fail clearly when the desktop bridge is unavailable. DNS is validated before Chromium requests each host, but Electron does not pin the validated address to Chromium's subsequent connection; DNS rebinding therefore remains a residual SSRF risk and this tool must not be treated as a hard network-isolation boundary.

Do not use this capability for signed-in dashboards, account actions, messages, purchases, release delivery, legal filings, or other consequential actions. For these, prepare information and hand off to the user for visible, authenticated completion.

## Computer execution

Computer Execution is a separate, supervised visible-desktop capability. Read-only observation and input-control operations have different risk levels. Input tools must be explicitly approval-gated and bound to a short-lived main-process authorization. The driver must stop before a consequential final action and return control to the user. Current implementation and known enforcement gaps live in `packages/main/src/services/ComputerExecutionService.ts`, `packages/main/src/handlers/computer.ts`, and the computer tool/driver files. Do not infer safety from an agent prompt or this design description alone; main-process checks are authoritative.

## Retired surfaces

- `browser_navigate`, `browser_action`, `browser_snapshot`, and `browser_tool` are retired. Do not restore them as aliases.
- The Gemini browser-control loop and its music-portal automations are retired. Registration adapters save prepared data and direct the user to complete the official portal; they do not claim submission or confirmation.
- `execute_code` and the Python sandbox sidecar are retired. Deterministic repository-owned scripts are not a general-purpose sandbox.
- `spin_up_qa_sandbox` is not an available runtime capability unless separately deployed and verified.

## Source of truth

Runtime contracts: `packages/main/src/services/WebExtractionService.ts`, `packages/main/src/handlers/agent.ts`, `packages/main/src/preload.ts`, `packages/renderer/src/services/agent/tools/WebResearchTools.ts`, and `packages/renderer/src/services/agent/ToolRiskRegistry.ts`. The 2026-08 case study is a historical audit snapshot, not a current implementation guide.
