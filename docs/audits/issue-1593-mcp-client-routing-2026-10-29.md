# ISSUE-1593: MCP client and callback routing — 2026-10-29

Status: PARTIAL; source and local policy evidence only.

## Source-confirmed failures and changes

`McpClientService` selected a hardcoded localhost emulator when `VITE_MCP_ENDPOINT` was absent, including in production. The frontend DSP wrapper called `draft_dsp_metadata`, while the server registers `draft_dsp_metadata_xml`. The server always advertised an HTTPS message callback, even under the local HTTP emulator, and omitted its external project/region prefix.

The client now resolves an explicit HTTPS endpoint or derives `https://us-central1-{activeFirebaseProject}.cloudfunctions.net/mcpEndpoint` from the same project configuration used to initialize Firebase. Only development permits a loopback HTTP endpoint/emulator fallback. Missing or invalid configuration fails visibly. URL credentials, endpoint query strings and fragments are rejected.

The configured endpoint also bounds authenticated transport requests: only its origin and exact SSE/message paths may receive the ID token. HTTP redirects are rejected rather than forwarding a bearer-bearing request to an unverified destination. This is a transport URL policy, not proof of token validity, server-side entitlement, session isolation or successful tool execution.

The callback builder uses HTTPS for deployed function/direct-service hosts, preserving `/mcpEndpoint` for Cloud Functions. Explicit emulator mode requires a loopback host and a valid `GCLOUD_PROJECT`, then emits the HTTP project/region/function message path. Invalid hosts return HTTP 400. The DSP wrapper keeps its public frontend key while calling the actual backend tool name.

## Validation and remaining acceptance

Twelve new pure URL-policy tests cover production/development defaults, explicit endpoints, missing/invalid project configuration, protocol/credential restrictions, same-gateway transport paths, foreign/sibling destinations, deployed callbacks, emulator prefixes and invalid hosts. Five unchanged legacy gateway tests provide structural-only rejection coverage. No auth/service/session mocks were added or expanded.

Actual owner-authenticated SSE/message exchange and DSP tool output still need verification after deployment. No account was created, actual plan observed, token minted or customer request sent during this local pass. Backend per-user admission/rate limiting and Blender/campaign findings remain pending. This branch does not include the separately published track-ownership repair.

## Authorization prerequisite

The existing Arcjet CLI session returned an expired-session/refresh failure. The official device flow was presented to the owner; no adjacent identity, environment token, alternate account or replacement credential was used. Arcjet-dependent gateway work is waiting for reauthorization. The Arcjet skill requires obtaining a real key before wiring protection; actual decision verification must use genuine authorized requests, never fabricated token/plan fixtures.
