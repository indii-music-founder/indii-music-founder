# Neural Cortex: Semantic Visual Memory Core

## Overview
The Neural Cortex is a vector-based imagination system that keeps indii's visual storytelling coherent over
long story chains. Rather than relying on pixel references alone, it encodes the narrative intent and semantic
identity of characters, locations, and props so regenerated frames stay faithful to the story bible and prior
scenes.

## Objectives
- **Eliminate visual drift:** Maintain consistent physical traits, costumes, lighting, and spatial relationships
  for recurring subjects across long sequences.
- **Capture intent, not just appearance:** Preserve narrative roles, moods, and relationships so visuals reflect
  character arcs and scene beats instead of frozen keyframes.
- **Bridge agents and renderers:** Give Director/Creative Director agents a shared semantic memory that
  downstream image/video models can query for anchors, constraints, and style references.

## Core Concepts
- **Entity Profiles:** Canonical records for each character, location, and prop with attributes (visual
  descriptors, backstory, pose vocabularies), exemplar assets, and textual prompts distilled from the Show Bible.
- **Multimodal Embeddings:** Embeddings derived from text, reference images, sketches, and storyboard panels
  stored in a vector index. Each embedding is tagged with role, emotional tone, lighting context, camera
  treatment, and timepoint.
- **Narrative Anchors:** Time-aware constraints (e.g., "episode 3, scene 4" or "post-fall battle damage") that
  tie Entity Profiles to specific beats, costumes, and prop states.
- **Scene Graph Snapshots:** For each beat, a semantic graph tracks who is present, their relationships, relative
  placement, and key actions. Snapshots are serialized into prompts that accompany rendering requests.
- **Similarity & Drift Detection:** Retrieval compares planned shots against prior embeddings to flag drift
  (pose mismatch, color shifts, wardrobe errors) before generation. Agents can auto-correct prompts or request
  restorative inpainting.

## Data Flow
1. **Ingest:** The Show Bible, Character Anchors, and Director's Board storyboards populate Entity Profiles and
   seed embeddings.
2. **Contextualize:** When a Story Chain step starts, the Cortex retrieves relevant embeddings by entity, beat,
   and mood, assembling a scene graph snapshot.
3. **Synthesize Prompts:** The snapshot is converted into structured prompts (who/where/when/how-to-shoot) plus
   negative constraints drawn from drift detection.
4. **Generate & Validate:** Generated frames are embedded and re-indexed. Drift checks compare them against the
   expected snapshot; deviations trigger automated revisions or Director agent feedback.

## Interfaces
- **`getSceneContext(projectId, sceneId)`** → Returns Entity Profiles, relevant embeddings, and narrative anchors
  for the scene.
- **`buildRenderDirectives(snapshot)`** → Produces structured prompts and constraints for the rendering model,
  including camera directives and continuity notes.
- **`recordFrame(sceneId, metadata, assets)`** → Embeds outputs, updates drift scores, and links assets back to
  Entity Profiles.

## Integration Points
- **Generalist/Director Agents:** Use Cortex retrieval to ground their shot planning and enforce continuity rules
  from the Show Bible.
- **Infinite Reel & Daisy-Chains:** Each chained beat rehydrates the last snapshot, so transitions inherit
  identities and spatial layouts rather than re-deriving them from scratch.
- **Character Anchor & Product Showroom:** Cortex embeddings act as the unified identity layer for both character
  and product renders, enabling style transfer without losing semantic identity.

## Authenticity & Data Integrity
- **No mocked context:** All retrievals must operate on real Show Bible entries, production assets, and storyboard
  metadata. Test harnesses should rely on fully-specified fixtures that mirror production schemas rather than
  dummy placeholders.
- **Provenance-first writes:** Every embedding and snapshot stores source asset IDs, authorship, and timestamps so
  reviewers can confirm continuity decisions are grounded in real inputs.
- **Tunable trust gates:** Drift alerts should fail closed when required inputs are missing, preventing the system
  from hallucinating continuity based on incomplete or fabricated data.

 add-semantic-visual-memory-core2025-12-1702-24-52
## Data Contracts & Operational Hardening
- **Schema guardrails:** Formalize contracts for Entity Profiles, Scene Graph Snapshots, and Render Directives;
  version them and reject writes that violate required fields (roles, beat references, asset IDs, lighting tags,
  provenance, and approval state).
- **Minimum viable contracts:** Require first-class fields for provenance (asset/source IDs, approvals, author,
  timestamps), residency/region tags, revision hashes, and rendering intents; block requests missing any contract
  field instead of accepting partial payloads.
- **Invariants on ingest:** Enforce that embeddings reference canonical asset IDs and current Show Bible revisions;
  fail closed if version drift is detected between cached embeddings and the active bible entry.
- **Residency enforcement:** Reject reads/writes that cross prohibited regions; include residency in the contract
  signature and validate region affinity on every retrieval.
- **Checkpointed pipelines:** Stage Cortex writes (ingest → validate → index) with idempotent retries and
  observability to prevent partial updates from polluting continuity history.
- **Redundancy & fallbacks:** Mirror the vector index and metadata store across regions; if a shard is
  unreachable, retrieval fails closed with actionable errors rather than silently falling back to stale anchors.
- **Contract snapshots:** Publish JSON schemas with strict enums for roles, lighting, lenses, residency, and
  approval states; pair them with checksum-signed snapshots so downstream services can verify they are on the
  same contract version before accepting writes.
- **Write filters:** Disallow unapproved assets or speculative prompts from entering the index; require
  provenance, residency tags, and an approval signature before persisting embeddings or snapshots.
- **Contract compatibility gates:** Add preflight checks that compare client-submitted schema version hashes with
  the active Cortex contract; fail closed and emit migration guidance if clients drift.
- **Field-level acceptance:** Require hard validation on key fields per contract: Entity Profiles (id, role,
  appearance descriptors, residency, provenance, revision hash, approval), Scene Graph Snapshots (scene/beat ids,
  entity ids + roles, spatial relations, lighting/camera intents, residency, provenance), Render Directives
  (snapshot id, render intent, constraints, negative prompts, residency, budget tags), and Embedding Records
  (source asset ids, modality, model version, residency, checksum, approval).
- **Contract exemplars:** Ship reference payloads for each contract with signed provenance and residency values;
  tests must import these fixtures verbatim to prevent mocks from silently bypassing required fields.
- **Compatibility matrix:** Maintain a matrix of allowed client ↔ contract versions and migration steps; block
  requests that sit outside approved pairs and surface self-serve remediation.
- **Contract drift monitors:** Instrument alerts for unexpected schema fields, missing residency tags, or
  downgraded approvals; open incidents automatically when contract drift exceeds thresholds.


 main
## Verification & QA
- **Preflight asset checks:** Rendering requests must validate that referenced Show Bible entries, storyboard panels,
  and exemplar assets exist and are approved before Cortex retrieval begins; otherwise the request is rejected with a
  fail-closed error.
- **Integration tests with real schemas:** Automated tests should run against production-shaped fixtures (no dummy
  strings or placeholder IDs) to prove the Cortex reads/writes the same shapes it will receive in production.
- **Drift regression harness:** Add regression cases where assets are intentionally missing or altered; assert the
  trust gates block generation and surface provenance gaps instead of falling back to mocked continuity.
 add-semantic-visual-memory-core2025-12-1702-24-52
- **Budget validation:** Add load tests that assert p95/p99 latency stays within envelopes for hot vs. cold paths and
  that drift-alert precision/recall remains above agreed thresholds during high-concurrency runs.
- **Residency drills:** Simulate regional outages; confirm fail-closed retrieval, alerting, and that no cross-region
  leakage occurs when shards are unavailable.
- **Performance/residency harnesses:** Build repeatable suites that stress hot/cold retrieval, drift scans, and
  residency enforcement under concurrent workloads; emit budget deltas and fail the run on any breach.
- **Capacity envelopes:** Track QPS/throughput envelopes for retrieval, embedding writes, and drift scans; fail
  readiness if observed headroom drops below agreed thresholds or if back-pressure events exceed error budgets.
- **Latency enforcers:** Add gatekeeping middleware that terminates or shunts requests when per-stage budgets are
  exceeded; verify in tests that the enforcers fail closed instead of allowing degraded prompts to proceed.

## Performance, Capacity & Safety Budgets
- **Latency envelopes:** Target p95 end-to-end retrieval + prompt synthesis under 500 ms for hot-cache scenarios;
  for cold starts, budget 1.5 s with explicit logging of cache-warm paths. Alert when p99 exceeds budgets for more
  than 5 minutes.
- **Capacity planning:** Maintain SLOs for concurrent retrievals, embedding writes, and drift scans; publish capacity
  envelopes (sustained and burst) and auto-scale with pre-defined back-pressure that preserves continuity checks.
- **Perf operations:** Run daily/weekly perf sweeps that verify cache-warm ratios, index fan-out, and shard-level
  latencies; block promotions if perf deltas exceed error budgets.
- **Embedding hygiene:** Periodically re-embed assets when the Show Bible or renderer model versions change;
  maintain hash-based deduplication to avoid index bloat and drift from outdated weights.
- **Resource isolation:** Reserve per-project quotas for embedding generation and drift scans to prevent noisy
  tenants from starving continuity checks.
- **Safety constraints:** Block renders if trust gates, residency checks, or provenance validations fail; never
  substitute synthetic/mocked data to satisfy continuity.

## Operational Runbook
- **Health checks:** Instrument liveness/readiness probes for the vector index, metadata DB, embedding workers, and
  cache layers; surface per-shard health plus contract-version parity to block traffic on mismatches.
- **Health check procedures:** Run synthetic queries against golden fixtures every 5 minutes; alert on p95 > 2x
  baseline, contract hash mismatches, or residency violations. Expose `/healthz` (liveness) and `/readyz`
  (contract + residency parity) endpoints with clear remediation steps per failure code.
- **Back-pressure & throttling:** Apply prioritized queues that keep drift scans and provenance checks ahead of
  non-critical writes; shed load by rejecting low-priority requests before continuity controls degrade.
- **Back-pressure playbook:** Trigger automatic queue depth caps and rate limits when drift scan latency or queue
  depth breaches envelopes; prioritize continuity-critical reads/writes, drain queues in priority order, and
  confirm catch-up before restoring full throughput.
- **Degraded modes:** Offer read-only retrieval with heightened drift alerting when writes are throttled; forbid
  new embeddings when contract/version parity is unknown or residency cannot be verified.
- **Degraded-mode steps:** Switch to read-only, pin the last good contract snapshot, force cache revalidation, and
  notify Director agents that manual overrides are required until parity is restored.
- **Cache warming paths:** Pre-warm beat-local caches on story start and during queue wait times; script warmers to
  run post-deploy and after shard failover to avoid cold-start drift spikes.
- **Failover:** Document steps for shard/region failover, including re-pointing clients, validating residency, and
  replaying missed writes from durable queues with checksum verification.
- **Failover checklist:** Quarantine the failing shard, validate the standby shard's contract hash and residency
  ACLs, replay write-ahead logs with checksum verification, then run a drift scan validation before reopening
  writes.
- **Recovery:** Provide runbooks for rebuilding the index from contract-signed snapshots, clearing polluted
  embeddings after drift spikes, and rolling back to previous schema versions with scoped kill switches.
- **Recovery sequencing:** (1) Freeze writes, (2) restore the last signed snapshot, (3) re-embed flagged entities
  with provenance review, (4) run regression drift scans, and (5) lift freezes only after budgets are green for 2
  consecutive runs.
- **Drift triage:** Standardize actions when drift deltas spike (pause generation, lock affected entities, trigger
  provenance review) and define SLA timers for human override/approval before resuming.
- **Incident handling:** Define severity levels, on-call rotations, escalation ladders, and communication templates;
  log every fail-closed block with root-cause metadata to accelerate triage.
- **Change audit trail:** Require change tickets that link to contract hashes, migration steps, and canary metrics;
  archive health/back-pressure dashboards with rollout timestamps for postmortems.
- **Change management:** Require change windows with feature flags, shadow runs, and canary stages; capture metrics
  (latency, drift F1, fail-closed counts, residency errors) to decide promotion or rollback.

## Chaos & Resilience Drills
- **Failure injection:** Regularly inject index/metadata shard outages, cache evictions, and contract-version
  mismatches; verify traffic routes through back-pressure paths and fail-closed gates.
- **Cold-path drills:** Force cold-start retrieval and embedding refreshes to validate latency budgets and cache-warm
  runbooks.
- **Residency tests:** Block regional storage mid-flow to ensure no cross-region leakage or silent fallback occurs;
  confirm alerts and automated halts trigger.
- **Perf & capacity game days:** Stress sustained QPS and burst scenarios to validate capacity envelopes, back-pressure
  thresholds, and incident communications.
- **Contract-drift drills:** Introduce incompatible client payloads and residency downgrades to verify compatibility
  gates, alerting, and automatic quarantining of non-conformant writes.

## Performance & Capacity Operations
- **Budget enforcement:** Attach per-stage budgets (retrieval, prompt synthesis, drift scan, write) to observability
  dashboards with automated SLO burn alerts; block promotions when burn exceeds 5% in a release window.
- **Capacity envelopes:** Publish per-region envelopes for retrieval QPS, embedding writes, drift scans, and contract
  validation throughput; feed envelopes into autoscaling and back-pressure policies.
- **Perf sampling:** Continuously sample p95/p99 for hot vs. cold paths and compare against golden fixtures; add
  alerts on cache hit ratio drops, index fan-out spikes, or shard skew.
- **Cold-start mitigation:** Precompute embeddings for next-up beats during queue waits; keep per-project warm pools
  validated against contract hashes to avoid drift from stale caches.
- **Cache integrity:** Include residency and contract version in cache keys, and invalidate caches on contract
  migration or Show Bible revision bumps.

## QA & Test Harnesses
- **Golden fixtures:** Maintain contract-signed golden payloads for Entity Profiles, Scene Graph Snapshots, Render
  Directives, and Embedding Records; tests must load these fixtures and reject modified/mocked variants.
- **Contract conformance tests:** Run suites that fuzz missing/extra fields, invalid residency tags, downgraded
  approvals, and incompatible client versions; assert fail-closed responses with actionable errors.
- **Operational drills in CI:** Automate health-check probes, back-pressure triggers, degraded-mode activation, and
  recovery sequences in staging to validate runbook steps are executable and observable.
- **Budget guards:** Add CI jobs that enforce latency/capacity SLOs under controlled load using golden fixtures;
  block merges when p95/p99 or drift F1 falls outside envelopes.

## Rollout & Change Management
- **Shadowing & canaries:** Ship Cortex changes behind feature flags; start with shadow reads/writes, then limited
  canaries per project/region with automated rollback thresholds on latency, drift F1, and fail-closed counts.
- **Change windows:** Schedule deployments in approved windows with rollback owners and preflight contract/version
  parity checks.
- **Telemetry-led staging:** Promote only after stage/QA environments meet budget SLOs with performance/residency
  harnesses; log all toggles and overrides for auditability.
- **Rollback playbook:** Preserve snapshot IDs for embeddings, scene graphs, and contract versions; define the order
  of toggling kill switches, draining queues, and restoring prior snapshots.

 main

## Implementation Notes
- Start with existing RAG/semantic retrieval infrastructure; extend schemas to store multimodal embeddings keyed
  by entity and beat.
- Favor transformer-based vision-language models that support both text and image embeddings for cross-modal
  retrieval.
- Store provenance metadata (asset IDs, storyboard frame references, artist notes) to enable explainability and
  human override when drift checks fire.
 add-semantic-visual-memory-core2025-12-1702-24-52
- Add a freshness policy: expire or down-rank embeddings when a character, costume, or prop state changes in the
  Show Bible to avoid reusing stale visual guidance.
- Keep a compact "beat-local" cache of embeddings and scene graphs for the active sequence to reduce lookup
  latency during rapid iterations, while periodically reconciling with the canonical index.
- Instrument the Cortex with evaluation hooks: per-beat drift deltas, precision/recall of drift alerts, and
  rendering retries required per sequence; surface these metrics to Director/QA dashboards.
- Provide a human-in-the-loop override path where Directors can pin or veto embeddings for a scene, creating
  locked continuity anchors that are respected by both retrieval and drift correction passes.
- Ensure data residency/configuration toggles exist for projects with restricted assets, defaulting to
  fail-closed retrieval if required shards or storage buckets are unreachable.
- Add an operational runbook: playbooks for cache-warm paths, shard failover, contract migrations, and how to roll
  back embeddings if drift deltas spike post-release.

## Improvement Plan
- **Production benchmarks:** Track latency envelopes, drift-alert precision/recall, retry rates, cache hit ratios,
  and residency compliance; publish weekly summaries and gate releases on meeting targets.
- **Cold-start mitigation:** Pre-warm embeddings and scene graphs for the next two beats during render queues;
  persist warm caches between retries to avoid recomputing context after failures.
- **Embedding hygiene:** Automate re-embedding when Show Bible revisions, model weights, or asset approvals change;
  include checksum validation and rollback if drift scores worsen.
- **Latency budgets:** Enforce per-call budgets at the API layer (e.g., 250 ms retrieval, 150 ms prompt synthesis,
  100 ms drift scan); surface budget overruns to observability and block release promotion until resolved.
- **Human overrides:** Add an override dashboard for Directors to approve/pin embeddings, annotate drift alerts, and
  escalate to provenance review; overrides are logged, versioned, and expire after the beat unless renewed.
- **Progressive rollout:** Ship Cortex changes behind kill switches and per-project feature flags; enable telemetry
  (latency, drift deltas, alert F1, fail-closed counts) and expand rollout only after meeting SLOs.
- **Readiness gates:** Block promotion until contract compatibility checks, residency drills, and benchmark suites
  pass; require a rollback plan with snapshot IDs for embeddings and scene graphs before enabling new features.
- **Performance/capacity operations:** Maintain perf dashboards with stage/production comparables, validate
  back-pressure thresholds, and tune autoscaling based on error budget consumption.

 main
