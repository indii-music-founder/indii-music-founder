# Intellectual Property & Asset Register

**Purpose:** Maintain a conservative, evidence-backed inventory of the assets
created, controlled, or used by indii. This is an operating register for the
founder, product team, counsel, and diligence—not a legal opinion, valuation,
or assertion that an asset is owned merely because it appears in a repository.

**Owner of the register:** Founder / delegated IP operations owner
**Review cadence:** update at each material release, new dataset/model/vendor,
brand asset launch, rights acquisition, or transaction diligence request.

## Rules of use

1. **Created is not automatically owned.** Record the author/source,
   assignment or licence, and evidence separately.
2. **Platform IP and user/artist IP are distinct.** Customer masters,
   compositions, lyrics, likenesses, artwork, metadata, and contracts remain
   customer-controlled unless a written agreement says otherwise.
3. **An AI-assisted output needs provenance, not assumptions.** Record the
   provider, model/tool, input-rights status, human direction/review, and any
   provider-returned provenance. Do not call AI output copyrightable,
   exclusively owned, watermark-protected, or registrable without the required
   evidence and counsel review.
4. **Keep secrets out of this register.** Reference a secret-manager record or
   agreement location; never place credentials, private keys, customer PII, or
   unredacted contracts here.
5. **Value is evidence-based.** Use a commercial/strategic rationale and
   verifiable evidence. Feature count, an internal estimate, or source code
   alone is not a valuation.

## Required record fields

Every material asset must have a stable ID and these fields:

| Field | Required content |
|---|---|
| Asset ID / class | Stable identifier and one class below |
| Description / location | What it is and the repository, storage, registry, or agreement reference |
| Rights posture | `owned`, `licensed`, `customer-controlled`, `open-source`, `unknown`, or `restricted` |
| Rights holder / contributor | Legal entity or source; do not infer from a Git name alone |
| Evidence | Assignment, licence, commit/tag, registration, hash, invoice, or signed agreement reference |
| Restrictions | Licence obligations, consent, territory, term, data-use, attribution, export, or approval limits |
| Value rationale | Revenue, defensibility, replacement cost, strategic dependency, or customer value; mark `unmeasured` when no evidence exists |
| Review state | `verified`, `needs founder evidence`, `needs counsel`, `not applicable`, or `retired` |
| Last reviewed | Date and accountable owner |

## Asset classes

| Class | Examples | Default posture until evidenced |
|---|---|---|
| Platform software | Source code, tests, architectures, workflows, build/release tooling | `owned` only when chain-of-title evidence supports it; dependencies remain `open-source`/`licensed` |
| Brand & creative | Names, logos, domain names, artwork, templates, marketing copy | `unknown` until trademark/domain/design source and assignment evidence are recorded |
| Product data & know-how | Schemas, non-public operational playbooks, pricing logic, prompts, internal specifications | `restricted`; preserve access controls and origin evidence |
| Model/configuration assets | Prompt libraries, evaluation fixtures, fine-tuning manifests, model routing/configuration | Platform-owned configuration is distinct from third-party model weights and provider services |
| Datasets & training material | Curated datasets, annotations, audio/video/image source material | `unknown` until source, permission, licence, retention, and permitted training/use are evidenced |
| Music & rights records | Masters, compositions, splits, ISRC/ISWC, DDEX packages, registrations | Normally `customer-controlled` or `licensed`; platform ownership requires explicit written transfer |
| Customer/user submissions | Uploaded media, personal data, contracts, likenesses | Never count as platform IP by default; handle under user terms, consent, privacy, and retention rules |
| Third-party/vendor assets | APIs, SDKs, fonts, stock media, open-source dependencies, cloud configurations | `licensed` or `open-source`; record the relevant terms and obligations |

## Initial register — platform and operating assets

These entries establish the starting inventory. `Verified` means the cited
artifact exists; it does **not** replace counsel's review of legal sufficiency.

| Asset ID | Asset / location | Rights posture & evidence | Value rationale / review state |
|---|---|---|---|
| IP-PLATFORM-001 | indii source code, tests, technical documentation, and workflows in this repository | `owned` claim documented in [IP assignment](IP_ASSIGNMENT.md) and [AI authorship disclosure](../AI_AUTHORSHIP_DISCLOSURE.md); third-party dependencies require separate licence review | Core product and replacement-cost asset. **Needs founder evidence:** retain executed founder/contributor assignment and current dependency licence report. |
| IP-PLATFORM-002 | Canonical audio ingestion, DSP/Gemini analysis, DDEX packaging, and provenance implementation | Platform software; current technical evidence includes source, tests, and release/issue records. It does **not** establish ownership of any artist audio processed by it. | Strategic workflow asset. **Verified technically / needs counsel evidence** for any patent/trade-secret strategy. |
| IP-PLATFORM-003 | Immutable delivery-asset provenance: owner-scoped content-addressed audio and cover-art objects, byte/hash/format inspection, private desktop staging, Creative Studio provider/model capture, and DDEX package-resource binding | Platform software. Evidence: `MasterAudioService`, `CanonicalCoverArtService`, `SubmitReleaseModal`, Electron staging services, `ingestion_build.py`, and their focused renderer/main/Python/Storage-emulator tests. The record distinguishes provider/model evidence captured at creation from `not_recorded`; it does not infer a provider version or title from bytes. Customer masters and cover art remain customer-controlled unless a written transfer says otherwise. | Reduces release-integrity and manual-reconciliation risk; supports a defensible workflow/replacement-cost narrative, not an asserted patent or independent valuation. **Verified technically / needs chain-of-title and trade-secret review.** |
| IP-PLATFORM-004 | indii Conductor© & Autonomous Multi-Agent Orchestration Engine | Platform software & orchestration architecture. Evidence: `AgentGraphService.ts`, `BigBrainEngine.ts`, `WebSocketControlPlane.ts`, `ToolPoolAssembler.ts`, and `directives/secure_ai_os_architecture.md`. Single secure router governing 21+ domain specialist departments with dynamic tool pooling, session namespace isolation, and deterministic execution graphs. | Core architectural moat preventing agent hallucination and runaway token spend. **Verified technically / needs patent and trade-secret review.** |
| IP-BRAND-001 | `indii`/`indii.music` names, logos, visual system, domains, and brand files under `docs/assets/` | `unknown` until domain registrar record, design source/assignment, and trademark search/filing evidence are linked | Brand and go-to-market asset. **Needs founder evidence.** |
| IP-BRAND-002 | `Connected Intelligence©` / `Connected Intelligence™` | Proprietary mark for cross-agent shared knowledge, contextual propagation, and multi-tier memory architecture. Documented across `.agent-os/product/mission.md`, `SuperpowerTools.ts`, and marketing surfaces. | Core positioning and market-differentiation trademark. **Needs trademark filing (Classes 009, 041).** |
| IP-BRAND-003 | `The Freedom Principle©` / `The Freedom Principle™` | Proprietary commercial mark for indii's 0% royalty cut model, sovereign data control, and local-first architecture. Featured in `.agent-os/product/mission.md` and landing hero. | Core ethical and commercial moat. **Needs trademark filing.** |
| IP-BRAND-004 | `Sonic DNA©` / `Sonic DNA™` | Proprietary mark for acoustic feature extraction, Essentia.js/YAMNet ONNX multi-dimensional timbre profiling, and audio fingerprinting. | Technology identifier for audio intelligence. **Needs trademark filing.** |
| IP-BRAND-005 | `Brand Guard©` / `Brand Guard™` | Proprietary mark for automated multi-modal computer-vision safety gating, brand-kit compliance, and write-only ad publishing fail-closed governance. | Commercial safety mark for autonomous marketing. **Needs trademark filing.** |
| IP-BRAND-006 | `indii Conductor©` / `indii Conductor™` | Proprietary mark for the central hub-and-spoke generalist orchestrator routing work to 21+ specialist departments. | Primary AI orchestration product brand. **Needs trademark filing.** |
| IP-BRAND-007 | `Project White Glove©` / `Project White Glove™` | Proprietary service mark for automated legacy catalog onboarding, multi-DSP statement normalization, and assisted release ingestion. | High-tier founder service mark. **Needs service-mark filing (Class 035/042).** |
| IP-BRAND-008 | `Format Foundry©` / `Format Foundry™` | Proprietary mark for multi-aspect responsive video (Remotion) and asset generation engine. | Production tooling mark. **Needs trademark filing.** |
| IP-BRAND-009 | `Digital Handshake©` / `Digital Handshake™` | Proprietary mark for real-time collaborative split sheet consensus, cryptographic rights verification, and automated contract generation. | Legal fintech mark. **Needs trademark filing (Class 036/042).** |
| IP-PROCESS-001 | Industrial Direct Distribution Engine & Upsampled Audio Fraud Gate | Proprietary technical process. Evidence: `directives/direct_distribution_engine.md`, `ingestion_generator.py`, `audio_forensics.py`, `.itmsp` Transporter bundler, Aspera `ascp` port 33001 pipe, and spectral cutoff analysis rejecting upsampled lossy-to-lossless fraud before DSP ingestion. Qualifies for direct DSP certification and Merlin membership bypass. | High-value patent candidate / trade secret. Displaces white-label aggregators (SonoSuite, LabelGrid). **Verified technically / needs patent filing review.** |
| IP-PROCESS-002 | Connected Intelligence© Context Propagation & Compaction Protocol | Proprietary technical process. Evidence: `directives/secure_ai_os_architecture.md`, `A2AClient`, `AgentCard`, and `BigBrainEngine.ts`. Multi-tier memory hierarchy (working ring buffer ➔ 7-day JSONL ➔ vector embeddings index ➔ cold archive) with entity graph compaction and cross-department constraint propagation without artist re-briefing. | Novel multi-agent context synchronization method. High-value utility patent candidate. **Verified technically / needs patent counsel review.** |
| IP-PROCESS-003 | Autonomous Marketing Swarm Governance & Fail-Closed Guardrails | Proprietary operational & security process. Evidence: `directives/autonomous_marketing_swarm.md`, `BrandVisionQC.ts`, `facebookAdsExecutor.ts`. Failsafe multi-modal vision check before ad spend, write-only Meta Marketing API integration preventing account bans, and 1-tick hardware-like halt kill switch. | High-defensibility trade secret and operating standard. **Verified technically / protected as trade secret.** |
| IP-PROCESS-004 | 3-Tier Automated Waterfall Settlement & Statutory Tax Lockdown | Proprietary financial engineering process. Evidence: `directives/direct_distribution_engine.md`, `tax_withholding_engine.py`, `waterfall_payout.py`, and `RevenueService.ts`. Deterministic settlement waterfall (fee-first ➔ recoupment-second ➔ split-sheet-third) combined with automated W-9 / W-8BEN / W-8BEN-E TIN validation and mandatory 30% withholding freeze on unverified identities. | Automated fintech compliance moat. **Verified technically / needs counsel review.** |
| IP-PROCESS-005 | Local-First Sovereign Vault & Ephemeral Remote Pairing Architecture | Proprietary security process. Evidence: `directives/secure_ai_os_architecture.md`, Electron `keytar` OS keychain integration, and local-first zero-cloud WebSocket mobile remote pairing via ephemeral QR-encoded 6-digit memory passcodes. | Eliminates cloud leak vector for unreleased masters. High-defensibility security moat. **Verified technically / protected as trade secret.** |
| IP-MODEL-001 | Agent prompts, routing, evaluations, and non-public operational configurations | `restricted`; platform configuration is distinct from third-party model weights. Provider terms and training/source permissions must be linked per material model/data source. | Potential operating know-how. **Needs provenance and access-control review.** |
| IP-DATA-001 | Internal training/evaluation datasets and annotations | `unknown` until every source is classified with permissions, applicable licence, allowed purpose, retention, and removal path | May be valuable only if lawful, documented, and transferable. **Needs founder/counsel review.** |
| IP-MUSIC-001 | Artist masters, compositions, cover art, DDEX payloads, registrations, and royalty records | `customer-controlled` or `licensed` by default. DDEX/ISRC/ISWC records demonstrate administration/provenance, not ownership. | Supports platform service value; never include in platform IP valuation without rights-specific evidence. **Needs per-release rights record.** |

## Founder actions — highest leverage evidence

- [ ] Store the executed founder IP assignment and any contributor/contractor
  assignments in the controlled legal evidence location; link the redacted
  reference here. **Founder packet:** entity legal name, execution date,
  signatory, scope (past and future work), governing law, and storage
  reference—never the unredacted document in the repository.
- [ ] Export and retain a current dependency licence report; flag copyleft,
  source-available, commercial-use, attribution, and notice obligations for
  counsel review. **Founder packet:** report date, commit SHA, package manager
  lockfile(s), reviewer, exceptions, and remediation owner.
- [ ] Record domain registrar ownership, renewal owner, and recovery contact
  for every material indii domain. **Founder packet:** registrar, registrant
  entity, account-recovery process, MFA owner, renewal date, DNS operator, and
  a redacted ownership export/screenshot reference.
- [ ] Complete a trademark strategy review for the product/company marks and
  record the search/filing/registration reference and territories. **Founder
  packet:** exact mark, goods/services classes, jurisdictions, search date,
  counsel decision, application/registration number if any, and known conflicts.
- [ ] Classify every non-public training/evaluation dataset before it is used
  for model tuning, retrieval, or external sharing. **Founder packet:** source,
  contributor/contract authority, licence/consent, allowed use, retention,
  deletion route, access owner, and whether the dataset can transfer to a buyer.
- [ ] For each commercial release, preserve the separate master and composition
  chain-of-title, split approvals, sample-clearance evidence, registrations,
  and recipient delivery acknowledgement. **Founder packet:** release/recording
  identity, work identity, rights holder, territory/term, evidence reference,
  exceptions, and responsible operator. See the DDEX evidence bundle in
  [the founder release checklist](../RELEASE_CHECKLIST.md#direct-ddex-delivery-activation-issue-784-added-2026-07-20).

## Change protocol for engineering work

When a work loop creates or materially changes an asset, add or update its
record before declaring the issue complete:

1. Identify whether the output is platform IP, customer-controlled content,
   licensed third-party material, or unknown.
2. Attach a non-secret evidence reference and integrity reference (commit/tag,
   immutable storage generation, SHA-256, agreement ID, or registry entry).
3. State restrictions and what the product must **not** claim.
4. State a cautious value rationale or `unmeasured`.
5. Add a founder checklist item when the next required action needs a human
   account holder, counsel, counterparty, payment, signature, or registration.

## Diligence and valuation use

Use this register with the [valuation thesis](../data-room/00_VALUATION_THESIS.md),
[legal/compliance materials](../data-room/10_LEGAL_COMPLIANCE.md), and [chain-of-title
materials](IP_ASSIGNMENT.md). A valuation must separate:

- transferable platform IP;
- licensed or vendor-dependent capability;
- customer-controlled catalog/rights;
- unverified or non-transferable data; and
- external commercial acceptance/revenue evidence.

No row is a claim of a transaction price, legal title, copyright registration,
or trademark registration without the linked source evidence.
