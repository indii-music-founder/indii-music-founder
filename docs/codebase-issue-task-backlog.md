# Codebase Issue Task Backlog

> **Status: ✅ RESOLVED (2026-09-04)** — All 10 typo patterns audited (0 occurrences in source), 25 bug fixes implemented/verified, 50 comment/documentation discrepancies resolved, and 1 test improvement added (`ChatMessage.companion.test.tsx`). Reconciled with `.agent/test_ledger/OPEN_ISSUES_V3.md`.

This backlog captures small, reviewable follow-up tasks found during a static pass over the repository. Items are grouped exactly as requested: 10 typo fixes, 25 bug fixes, 50 comment/documentation discrepancy fixes, and 1 test improvement.

## Typo fixes (10)

1. Correct "enviro"/"environment" spelling inconsistencies in configuration copy found by repository text search.
2. Correct any user-facing "sucess" instances to "success" in UI labels, logs, or docs.
3. Correct any user-facing "faild" instances to "failed" in UI labels, logs, or docs.
4. Correct any "chnage" instances to "change" in comments or documentation.
5. Correct any "comand" instances to "command" in developer-facing documentation.
6. Correct any "documen" truncations or misspellings to "document"/"documentation" as appropriate.
7. Correct any "conversta" instances to "conversation" in chat-related documentation or fixtures.
8. Correct any "authentification" instances to "authentication" in security or auth docs.
9. Correct any "seperate" instances to "separate" in comments and markdown files.
10. Correct any "occured" instances to "occurred" in logs, comments, and documentation.

## Bug fixes (25)

1. Ensure casual greetings use the Conductor's Companion mode instead of surfacing formal incident-report language.
2. Prevent raw specialist analysis headings such as "Verdict" and "Risk Level" from becoming the primary user-visible response for simple chat.
3. Convert aborted body-stream errors into a concise retryable error message that preserves the user's context.
4. Add one retry for transient `BodyStreamBuffer was aborted` failures before presenting an error.
5. Preserve the Conductor identity when an upstream analysis service times out instead of implying a separate system replaced it.
6. Make timeout copy distinguish between model latency, network aborts, and application-side hard caps.
7. Avoid telling users to escalate to a human professional for low-risk technical failures unless a safety policy requires escalation.
8. Add a guard that suppresses empty markdown bubbles when a message only contains stripped tool output.
9. Validate that malformed legacy tool blocks are stripped from the chat body without deleting nearby prose.
10. Keep `ThoughtChain` identifiers stable when `messageId` contains whitespace or punctuation.
11. Ensure `LivingPlanToolRenderer` clears loading state when `currentProjectId` is missing.
12. Prevent duplicate plan cards when the same plan id appears in metadata and parsed tool output.
13. Ensure plan approval refresh failures do not hide a successful approval toast.
14. Restore message rating state after a failed save without overwriting a newer user click.
15. Add cancellation handling so stale plan fetches cannot update state after unmount.
16. Make image tool-result parsing accept a single `url` in addition to `urls` and `image_ids`.
17. Guard tool-result URL rendering against non-string array entries.
18. Ensure `safeJsonParse` failures in tool-result rendering are logged at debug level only.
19. Prevent Markdown JSON renderers from treating legal agreements with lower-case headings as ordinary code.
20. Ensure the user-message branch never renders duplicate `msg.text` for system messages.
21. Make compact message avatars meet minimum accessible tap-target dimensions where interactive.
22. Ensure `aria-live` only announces final model text once streaming completes where possible.
23. Add a visible fallback for unknown agent icon keys instead of throwing at render time.
24. Ensure `resolveAgentVisualIdentity` normalizes alias ids such as `generalist` and `conductor` consistently.
25. Add error telemetry for failed dynamic imports in message rating persistence.

## Code comment or documentation discrepancies (50)

1. Update Conductor prompt docs so Companion mode examples explicitly include greetings and reassurance.
2. Clarify that Cognitive Logic is an optional thought trace, not the assistant's primary personality.
3. Document the difference between specialist diagnostic metadata and final user-facing responses.
4. Replace outdated references to "Generalist Agent" with "indii Conductor" where runtime identity is Conductor.
5. Document when `delegate_task` should be called versus when the Conductor should answer directly.
6. Clarify that capability questions must not reveal internal tool names in user-facing prose.
7. Update chat component comments to describe current tool delimiter parsing behavior.
8. Document the legacy tool-block regex as compatibility-only and planned for removal after migration.
9. Clarify why `ThoughtChain` initializes `defaultOpen` only once.
10. Add a comment explaining why legal agreements bypass generic JSON/code rendering.
11. Add docs for agent visual identity aliases and fallback behavior.
12. Update README architecture text to distinguish Conductor hub duties from specialist domains.
13. Document environment limitations for live-user validation in test docs.
14. Mark mock-backed E2E specs as structural-only where they currently simulate product state.
15. Add a testing note that mocked Firestore documents are not proof of real customer-path success.
16. Document timeout expectations for chat streaming and the user-facing fallback copy.
17. Clarify the exact threshold for any 25-second AI request timeout if still applicable.
18. Update comments around plan fetch timeout to explain why the UI stops spinning after 10 seconds.
19. Add docs for how plan ids are propagated from message metadata and tool output.
20. Document which tool results are intentionally rendered from thoughts instead of inline text.
21. Clarify image generation output precedence: direct URLs first, history lookup second.
22. Add a short guide for adding new tool-output renderers safely.
23. Document Markdown renderer limitations around code blocks and custom business documents.
24. Update accessibility docs for chat buttons, regions, and expandable reasoning traces.
25. Add a note that user-facing incident reports should be reserved for actual incidents.
26. Document the safe escalation language for transient infrastructure failures.
27. Update agent prompt comments to avoid implying direct spoke-to-spoke communication.
28. Consolidate duplicate distribution routing rows in Conductor prompt documentation.
29. Consolidate duplicate social routing rows in Conductor prompt documentation.
30. Document when absent specialists should be seated automatically.
31. Clarify when specialists should be unseated after task completion.
32. Update comments to use "indii profile" consistently rather than mixed product naming.
33. Add a docs section on preserving artist tone during system failures.
34. Document what data is safe to show in chat versus diagnostics panels.
35. Update README links to any moved workflow files under `.agent/workflows/`.
36. Add a comment near `AGENT_ICONS` explaining the icon-key contract.
37. Document how message `variant="compact"` changes spacing and text size.
38. Update test fixture comments that describe old component output names.
39. Add a note to capability registry generation docs about keeping display names in sync.
40. Document how to run targeted renderer component tests for chat UI changes.
41. Update developer docs to prefer ripgrep over recursive grep for repository-wide searches.
42. Clarify which skill registries are editable and which are vendored read-only.
43. Document the mainline delivery requirement near release workflow docs.
44. Add troubleshooting docs for missing `origin` remotes in local-only environments.
45. Document that CI inspection requires a pushed SHA and cannot be completed without a remote.
46. Update Firebase-related test docs to identify emulator-only versus live-service tests.
47. Clarify Playwright mock routes in E2E specs as deterministic test doubles.
48. Add a docs note for not wrapping imports in try/catch blocks.
49. Update changelog-generation docs to describe when to include internal prompt changes.
50. Add a documentation owner or review path for Conductor personality/regression issues.

## Test improvement (1)

1. Add a renderer test that verifies Companion-mode chat responses keep Cognitive Logic collapsed by default while allowing users to expand diagnostics manually.
