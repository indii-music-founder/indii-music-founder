# Firestore ten-foot analysis (temporary)

Target: `projects/indii-music-founder/databases/(default)`; Standard edition,
Firestore Native, `nam5`.

## taxFormRequests

- Backend creation: `requestTaxFormUpload` writes a 64-character random token,
  artist/collaborator identifiers, an expiry timestamp, and consumption state
  through the Admin SDK.
- Backend submission: `submitTaxForm` reads and consumes that token in a
  transaction through the Admin SDK, then stores the uploaded form.
- Public web client: submits token and file bytes to the `submitTaxForm` HTTP
  function; it performs no direct Firestore read, query, or write.
- Required client access: none.
- Existing rule conflict: the earlier backend-only block denies every client
  operation, while a later duplicate block permits an unauthenticated
  limit-one read for 64-character document IDs. Firestore combines matching
  allow expressions with OR, so the later block weakens the intended boundary.
- Repair: keep the backend-only block, remove the duplicate public-read block,
  and add emulator coverage for unauthenticated get, list, create, update, and
  delete denial.

## Targeted red-team result

- Public list exploit: closed by removing the only public allow expression.
- Unauthorized CRUD: all client operations resolve to explicit false.
- Update/schema/ownership bypass: not applicable to clients because direct
  creates and updates are denied; validation is enforced in the backend.
- Business path: remains available through `submitTaxForm`, whose Admin SDK
  access bypasses client rules and whose tests cover validation/consumption.

## users/{uid}/proSubmissionDrafts

- Client create: `register_work_with_pro` stores a manual-submission draft with
  title, bounded writer/publisher metadata, society, fixed status, and server
  timestamps.
- Existing rule coverage: none; the nested catch-all denies the create, so the
  tool can never return its advertised successful draft ID in production.
- Required access: verified owner create/read only. There is no edit/delete UI.
- Repair: add an owner-scoped, strict-key validator with bounded title,
  society, writer count, optional publisher map, immutable fixed status, and
  request-time timestamps. Keep update/delete closed.

## users/{uid}/agent_queue and graphExecutions

- The agent batch queue advertises restart persistence but all reads/writes
  target an unruled `agent_queue` subcollection and are silently retried then
  discarded after permission denial.
- The graph orchestrator creates and updates `graphExecutions`, while its UI
  listener silently ignores the same missing-rule error. Complex agent jobs
  therefore cannot persist or resume in production.
- Repair: owner-only access with strict top-level schemas, bounded task/node
  maps, immutable execution identity on update, and timestamp/type checks.
