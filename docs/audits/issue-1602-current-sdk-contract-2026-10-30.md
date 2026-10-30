# ISSUE-1602: current SDK/API contract — 2026-10-30

Status: OPEN. Source reconciliation, not live deployment proof.

The finding cites packages/firebase/src/api/routes.ts, which is absent at baseline df36f74b6. The current router is packages/firebase/src/functions/api/router.ts. It exports getProfile and health, re-exported by src/index.ts. Its source states that track CRUD, distribution REST and analytics routes were deliberately removed under ISSUE-1442. Both hosting targets have SPA catch-all rewrites; neither config maps /api or /v1 to those functions. The catalog has its own exported catalogSemanticApi in functions/catalog/semanticProjection.ts. A URL-prefix substitution alone would retain missing endpoints and wrong envelopes.

| SDK methods | Current SDK request | Current tracked server contract |
| --- | --- | --- |
| getTrack, listTracks, createTrack, updateTrack, deleteTrack | /api/tracks and /api/tracks/:id | No matching exported CRUD handlers in current router |
| getDistribution, listDistributions, createDistribution, submitDistribution | /api/distributions and child paths | No matching exported distribution REST handlers in current router |
| getEvents, getEventsByType | /api/analytics/events | No matching exported event-query handler in current router |
| getCatalogEntity, getArtistCatalogFeed | /api/catalog/v1 with query parameters | catalogSemanticApi function, GET entityId or artistId feed; raw top-level JSON-LD |
| getProfile | /api/account/profile | getProfile function, GET Firebase ID token; success/data/meta envelope |
| updateProfile | PATCH /api/account/profile | No matching update handler in current router |

The SDK universally decodes data.data. That is compatible with getProfile's success envelope once routing is correct, but loses the catalog's top-level JSON-LD entity/feed. The SDK calls its credential apiKey, while the tracked profile endpoint requires a Firebase ID token and a verified server entitlement. Treating an arbitrary API key as a supported credential would be misleading. Catalog is public and uses anonymous request protection; it should not receive a private bearer token just because the SDK has one. Exact endpoint origin and redirect policy must be checked before sending credentials.

## Required resolution

Reconcile the SDK's promised public surface with the prior route-pruning decision. Either restore the intended supported server endpoints with owner-scoped operations and genuine contract acceptance, or obtain an explicit product decision to revise the SDK surface with a documented migration. Do not silently remove methods, fake successful responses, weaken authentication or recreate retired routes based only on the stale ledger path. Preserve the existing finding and all acceptance requirements until that decision is implemented.

Source-only evidence cannot prove what is deployed. Genuine endpoint/account verification awaits authorized credentials; no Firebase login workaround, seeded account or mocked service establishes acceptance. SDK mocked-fetch tests currently assume the old paths/envelopes and cannot settle the deployed contract. No SDK code changed and no ISSUE-1602 closure is asserted.
