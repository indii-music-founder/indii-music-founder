# Rights registration implementation status

## Current society implementation — 2026-10-19

The society completion work was published in `41b32e210` and merged through
[PR #421](https://github.com/indii-music-founder/indii-music-founder/pull/421).
The historical milestones below describe earlier stages and are superseded by
this section for PRO/MLC/SESAC engineering status.

- SESAC-addressed CWR preparation now supports factual REC metadata in pinned
  2.1/2.2 layouts. It is no longer an onboarding-only screen. No obsolete CWR 2.0
  flag columns are invented; receiver testing must resolve the inconsistency in
  the published SESAC rule.
- Registration Center supports owner onboarding requests, operator-approved
  receiver configuration, immediate revocation, exact-batch approval, explicit
  transmission, uncertain-transfer reconciliation, bounded receiver ACK retrieval,
  manual ACK import, and generation-pinned evidence downloads.
- Private SFTP profiles are bound to recipient, sender, version, owner-scoped
  Secret Manager credentials, and configuration revision. Profile changes require
  fresh batch approval. Public/private endpoint checks and exclusive creation
  protect the transfer boundary. No write is automatically replayed. Operators can
  record receiver-confirmed outcomes with audited evidence and renewed artist
  approval where needed.
- ACK reconciliation separates MusicMark routing receipt, intermediate RA,
  AS/AC acceptance, rejection, duplicate, and conflict. Raw statuses and provenance
  remain available. Canonical work revisions fence late replies; original export
  bytes and manifests recover immutable transaction identities. Receiver retrieval
  and user-imported evidence remain distinct. No CWR result claims an issued
  copyright registration.

The MLC’s published guide describes FTP. The implemented transport is SFTP;
production use requires the receiver to assign a compatible secure channel.
Plaintext FTP, an assumed registration API, and invented credentials are not
substitutes. Export/manual completion remains available while that is established.
No receiver onboarding, production transmission, or genuine acceptance test was
performed by this task. These operational checks will use real authorized users,
as requested. Hosted copyright and payment acceptance limitations below are
unchanged.

Verification of the merged result: 93 focused shared/UI structural tests passed.
The original completion unit also passed six local Firestore authorization tests.
Full local validation covered 9,966 passing assertions across four shards, plus
TypeScript and ESLint (zero errors, 234 existing warnings). The initial fourth
shard exited with Vitest `EnvironmentTeardownError: Closing rpc while
"onUserConsoleLog" was pending`, attributed to `RouterContext.test.tsx`; its two
isolated tests and an exact fourth-shard retry (2,643 tests) passed cleanly.
This runner retry is recorded separately from society acceptance evidence.
JEV `jev-1.13.0` reviewed merged source: status progression 0.86 Noul, evidence
truth 0.90, automatic resend risk 0.10; usage 6,794 input / 60 output tokens.
These are source-review judgments, not test or receiver-acceptance probabilities.
Raw results and the reviewed commit/fingerprint are in `SOCIETY_JEV_REVIEW.json`.

## Historical implementation milestones

This branch is reviewable implementation work, not release acceptance evidence.
No society deliveries, copyright payments, filings, deployments, or genuine
customer acceptance journeys were performed for this change.

## Implemented surfaces

- Versioned filing contracts, explicit legal metadata, manifest hashes, owner-scoped
  persistence, immutable filing snapshots, and separate user-reported evidence.
- Fixed-width CWR 2.1/2.2 export and CWR acknowledgment parsing/correlation, exact
  batch approval, and a gated SFTP delivery adapter requiring approved submitter
  configuration and receiver onboarding evidence.
- SoundExchange bulk serialization from operator-reviewed official template profiles.
- Dedicated browser worker and session broker packages, owner-bound single-use
  tickets, execution claims, control generations, bounded frames, network filtering,
  human control, and consent-based encrypted authentication-state storage.
- Registration Center preparation UI and legacy desktop safeguards against missing
  targets, unbound sessions, invented metadata, and unverified confirmation claims.

## Required work before enablement

Keep `RIGHTS_HOSTED_ENABLED`, `RIGHTS_PAYMENT_ENABLED`, and
`RIGHTS_CWR_DELIVERY_ENABLED` disabled. Operator configuration alone is not proof
that an integration works.

Hosted browser adapters currently expose limited verified preparation actions;
complete Standard, GRUW, and separate GRAM application journeys,
trusted official receipt capture, and durable provider outcome reconciliation
still require completion and genuine checks. Canonical identity linkage and per-track
compatibility projections are implemented in the current working changes. Session
expiry/worker-loss recovery now revokes control and retains capacity until shutdown
is confirmed; its cloud cancellation and deployment lifecycle need genuine
verification. Docker images have not been validated by a deployment.

SESAC export remains blocked pending its required recipient-specific record layout
and validation. MusicMark and MLC require receiver onboarding, approved submission
identity and credentials, real transmission testing, and official acknowledgment
reconciliation. Imported acknowledgments retain user-import provenance and do not
independently establish an official provider outcome. SoundExchange requires an
approved official template; delivery remains manual.

Remembered authentication requires reviewed cookie classification, KMS/GCS IAM,
retention lifecycle configuration, and revocation/expiry verification. Hosted payment
requires its own sensitive-data assessment and controls before enabling. Human
control does not eliminate credential or payment-data processing scope.

Local pure tests and legacy structural regressions verify code properties only.
They do not establish customer-path readiness or permission to deploy or transmit.

## Continued implementation evidence

- Pure recovery, canonical identity, pairing, and deposit-selection tests cover
  local contract behavior. Local emulator rules tests cover owner reads and
  denial of cross-account access and forged projection/evidence/session writes.
- Deposits now require explicit artist selection for the current portal picker;
  stale control/navigation and foreign work references are rejected.
- Projection documents preserve a single filing identity across group tracks.
  Legacy success records without authoritative filing evidence remain unverified.
- Session cleanup never retries filing or launch actions. Missing execution
  provenance retains capacity for operator reconciliation rather than assuming
  the browser was stopped.

JEV assessment: `jev-1.13.0`, read-only code/status review, 11,389 input and 242
output tokens. It classified copyright completion as both engineering and external
work (0.99 choice probability), catalog linkage as an engineering gap (0.70), and
whole-plan completion as unsupported (0.03 probability of completion). Recovery
classification was uncertain (0.51 confidence); source inspection, rather than
that classification, established the concrete recovery fixes. This was not a
live product judgment, benchmark agreement score, or external acceptance test.
No key material or renderer-side JEV calls were added.

Real portal inspection on 2026-10-18 confirmed the official entry redirects to
`https://eservice.eco.loc.gov/eService_enu/?SWECmd=Start`. The origin policy now
permits that exact host. Inspection stopped at genuine User Login; no credentials
were entered, applications created, deposits transmitted, or fees paid. Remembering
login also requires an explicitly reviewed `RIGHTS_AUTH_COOKIE_HOST`.

Subsequent genuine signed-in inspection confirmed Standard Application and GRUW
have distinct overview screens; both GRAM kinds enter through “Register Certain
Groups of Published Works.” The worker now verifies the actual overview after
navigation, rather than treating a successful click as a completed action. The
home page mentions deposit accounts as an informational link; sensitive-phase
checks now inspect active credential/certification/payment controls instead of
rejecting all pages containing those words.

Artist-visible browser dialogs are now relayed through the session contract and
answered with fenced human input. Notice/prompt messages and answers remain in
memory/WebSockets; they are not written to Firestore. No notices are automatically
accepted by the worker. Signed-in inspection stopped before “Start Registration”;
no new external claim was created or filed during inspection.

The artist confirmed that no original work is currently available for a genuine
filing check. No fictional work or blank claim was created as a substitute. This
limits real filing acceptance; it does not turn the limited field adapters into
complete automation. Full Standard/GRUW/GRAM field mapping, trusted official
receipt capture, and provider outcome reconciliation remain engineering work.

Additional bounded fixes pin exported CWR bytes to a storage generation, prevent
approval from resetting claimed/transmitted/uncertain transfers, and retain a
stable evidence ID and timestamp when a reported receipt save is retried.

## Local validation of this continuation

- 108 focused rights and legacy structural tests passed across 16 files.
- Five local Firestore emulator authorization tests passed. These use isolated
  structural fixtures, not customer acceptance evidence.
- Repository typechecking and dedicated broker/browser-worker builds passed.
- Scoped ESLint completed with zero errors and seven existing-style warnings.
- The stale Founder Readiness modal assertion now checks its actual official
  portal behavior with opener isolation; it does not claim live navigation.
- Firebase CLI reauthorization completed through the artist-supplied official
  flow. No deployment, society transmission, or copyright filing was performed.
- The complete local `npm run ci` run finished with 9,769 passing tests and
  one unrelated landing-page assertion failure at
  `packages/landing/src/pages/ArtistPassportPage.test.tsx:318`: it expects
  “Your report request could not be saved,” while the unchanged implementation
  returns “Report requests are unavailable. Please try again later.” No landing
  files were changed. The full repository gate is therefore not green.
- The remote task branch advanced to `5cbb08ff7` during validation through an
  external merge from main. This local continuation must be integrated with that
  remote update before it can be published without overwriting other work.

## Reload and persistence recovery continuation

The earlier branch integration was published as `a347a87b0`; its exact-SHA rights
CI passed. This continuation adds owner-authenticated, sanitized discovery of
reserved sessions and an explicit reconnect to the same claimed process. Session
secrets remain server-only. Expired, ending, unclaimed, and lost browsers cannot
be offered as reconnectable; refresh/end remain available without launching a Job.

Saved cases now restore their actual filing ID, revision, and manifest hash.
Historical filing revisions can be selected for confirmation reporting. Edits use
the loaded revision as their concurrency baseline, rather than silently using a
newer snapshot revision. Switching authenticated accounts remounts the workspace.

Downloaded user-reported confirmation reports carry a versioned envelope and can
be restored for the exact filing/hash. Their evidence ID and original timestamp
survive a persistence retry, so reporting never repeats an external application.
Reports cannot promote themselves to official evidence or registration status.

These recovery contracts have local structural tests. No original work is
available for a genuine filing journey, and no customer-path or official outcome
acceptance is claimed. Full portal field coverage and trusted provider receipt
reconciliation remain incomplete; hosted/payment/delivery switches stay disabled.

Validation of this recovery unit: 116 focused tests passed across 17 files;
repository typechecking and both dedicated worker builds passed. Full ESLint
completed with zero errors (235 repository warnings); scoped lint had zero errors
and three pre-existing `any` warnings. The complete local CI gauntlet finished
with 9,896 passing tests and the same unrelated landing-page wording assertion
failure at `ArtistPassportPage.test.tsx:318`. The repository-wide gate is not green.
No landing files were modified, and no live filing acceptance is claimed.

## PRO/MLC preparation and landing regression

The landing report-request test expected a write-failure message while its
structural environment has no configured database. It now asserts the exact
unavailable-service message and retains the assertions that no request was
falsely confirmed and the form can be restarted. Product failure handling was
not replaced by fabricated persistence or a success response.

Registration Center now includes a PRO/MLC export workspace: explicit sender
identity and file sequence; canonical composition selection/creation; stable,
owner-scoped composition codes with collision claims; writer/publisher roles and
relationships; separate ownership, collection and territory entry; saved exact
CWR downloads; checksum-bound export review; onboarding checklists; and imported
per-work ACK decisions labelled as user-imported evidence. The screen has no
transmit action. Share inputs use exact integer arithmetic, require explicit
values, and do not assume an artist's ownership or society affiliations.

MusicMark covers ASCAP/BMI/SOCAN. SESAC is separate and remains export-blocked
pending its required receiver-specific fields and validation. The MLC onboarding
requires a test file and approval before production credentials. Its published
guide describes FTP; the existing gated SFTP adapter must not be assumed to match
an assigned MLC channel without receiver confirmation. Public Search API access
is not registration access.

Official sources reviewed on 2026-10-18:
- https://www.musicmark.com/documents/MusicMark_getting_started.pdf
- https://www.themlc.com/hubfs/CWR%20User%20Guide_May%202024_FINAL.pdf
- https://www.themlc.com/faqs/categories/play-your-part

The artist requested exports/onboarding now, with real PRO/MLC acceptance tests
later when genuine users and approved receiver accounts are available. No
credentials were requested, transmissions attempted, or acceptance results
fabricated. Copyright Office automation is a planning assumption requested by
the artist; prior unverified acceptance gaps remain unverified.

JEV was used for read-only development review on this unit (`jev-1.13.0`). Its
first review selected preparation-only scope (1.00 choice probability), supported
correct receiver routing (0.96 Noul), and weakly prioritized UI state (0.30 choice
probability, 0.18 confidence). Independent source inspection then confirmed the
missing editable-preparation persistence. The fix pins full preparation JSON to
an owner-scoped GCS object generation and manifest checksum; saved exports can be
copied into the editor with exact share values and canonical composition links.
The copy requires a new file sequence and does not change the original batch.
Legacy exports without recoverable canonical links are not reconstructed by title
or recording ISRC. JEV's follow-up recovery support was 0.92 Noul; it continued to
select preparation-only scope. Results are retained in `SOCIETY_JEV_REVIEW.json`.

The two successful reviews used 36,461 input and 307 output tokens. These are
review judgments, not measured customer agreement or live acceptance evidence.
No model call was added to the registration runtime or renderer, and no key
material entered the diff. All 139 focused tests passed after the recovery fix,
including exact share-unit round trips and independent saved-copy boundaries.

Final local verification for this unit: all 139 focused tests passed across
19 files; the complete repository CI gauntlet passed with 9,904 passing tests.
This supersedes the earlier landing-page failure recorded above. Repository
TypeScript checks, full ESLint (zero errors, 235 existing warnings), both worker
builds, and five local authorization emulator tests passed. No production UI or
receiver acceptance claim is made from these structural/local checks.
