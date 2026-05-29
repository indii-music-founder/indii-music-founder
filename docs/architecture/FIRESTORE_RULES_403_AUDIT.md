# Firestore Rules — Latent 403 Audit

> **Generated:** 2026-05-28 by the upgraded `/hunter` Phase 2.7 rules audit.
> **Scope:** client (`packages/renderer/src/services`) Firestore collection access vs
> `packages/firebase/firestore.rules`. The rules end with a default-deny catch-all
> (`match /{document=**} { allow read, write: if false; }`, line ~867), and Firestore
> does **not** cascade parent rules to subcollections — so any path without an explicit
> `match` (or a covering recursive `{allPaths=**}`) is a hard 403 for client code.

## Summary

34 raw candidates → **6 false positives**, **28 fixed** (16 owner-scoped subcollections + 12 top-level, all 2026-05-28), **1 security follow-up** (move `fraud_alerts` writes server-side).

| Bucket | Count | Action |
|---|---|---|
| False positive (already covered) | 6 | None |
| Fixed — owner-scoped subcollections under `users/{uid}` | 16 | Done |
| Fixed — top-level collections (see §C) | 12 | Done |
| Follow-up — security hardening | 1 | `fraud_alerts` → Cloud Function (Admin SDK) |

## A. False positives — no action

Covered by an existing recursive wildcard or explicit rule. Do **not** re-file these.

| Collection | Client path | Covered by |
|---|---|---|
| `events` | `distribution_audit/{releaseId}/events` | `match /distribution_audit/{releaseId}/{allPaths=**}` (line ~665) |
| `metadata_history` | `distribution_audit/{releaseId}/metadata_history` | same recursive wildcard |
| `requests` | `distribution_takedowns/{releaseId}/requests` | `match /distribution_takedowns/{releaseId}/{allPaths=**}` (line ~675) |
| `versions` | `legal_templates/{templateId}/versions` | `match /legal_templates/{templateId}/{allPaths=**}` (line ~748) |
| `vault` | `users/{userId}/vault` (list query) | `match /users/{userId}/vault/{category}` (line ~554) |
| `livingPlans` | `projects/{projectId}/livingPlans` | `match /projects/{projectId}/livingPlans/{planId}` (line ~711) |

## B. Fixed in this change — owner-scoped subcollections under `users/{userId}`

All 16 are a user's own data under `users/{uid}/…` with no rule, so every read/write 403'd.
Added with the file's established one-liner pattern — `allow read, write: if isOwner(userId);` —
inside the `match /users/{userId}` block (after `match /assets/{assetId}`).

| Collection | Path | Representative client call |
|---|---|---|
| `agent_audit` | `users/{uid}/agent_audit` | agent governance audit writes |
| `browserHistory` | `users/{uid}/browserHistory` | BrowserAgent history |
| `contacts` | `users/{uid}/contacts` | contacts service |
| `crisis_responses` | `users/{uid}/crisis_responses` | publicist crisis tooling |
| `email_pitches` | `users/{uid}/email_pitches` | publicist email pitches |
| `fanPurchases` | `users/{uid}/fanPurchases` | fan/CRM purchases |
| `fieldContacts` | `users/{uid}/fieldContacts` | field contacts |
| `fineTuningDataset` | `users/{uid}/fineTuningDataset` | training dataset capture |
| `licensingDeals` | `users/{uid}/licensingDeals` | licensing deals |
| `likeness` | `users/{uid}/likeness` | creator-protection likeness assets |
| `notifications` | `users/{uid}/notifications` | notifications |
| `pod_orders` | `users/{uid}/pod_orders` | print-on-demand orders |
| `press_releases` | `users/{uid}/press_releases` | publicist press releases |
| `publishingCatalog` | `users/{uid}/publishingCatalog` | publishing catalog |
| `tasks` | `users/{uid}/tasks` | proactive tasks |
| `web3Contracts` | `users/{uid}/web3Contracts` | web3 contracts |

> ⚠️ **Verify before merge:** run `firebase firestore:rules validate` (or `firebase deploy
> --only firestore:rules` against a staging project). The additions are syntactically
> identical to existing rules, but rules changes must be validated, not assumed.

## C. Resolved 2026-05-28 (was: needs scoping decision)

All 12 were resolved by reading each call site's actual document shape and applying the
matching access model. Rules added to `firestore.rules` just above the deny-all catch-all.

**Models applied:**
- **Owner-by-field `userId`:** `career_memory_archive`, `knowledge_history`, `google_search_history`, `sample_requests`, `sftp_ingestions`, `video_releases`.
- **Owner-by-field `requestedBy`:** `takedown_requests`.
- **Owner-by-path segment:** `mechanical_licenses/{uid}/licenses` (uid is the path).
- **Public-read / owner-write `ownerId`:** `marketplace_drops` (drop URLs are public).
- **Global read-only (server/Admin writes only):** `content_rules`, `sample_platforms`.
- **Security interim:** `fraud_alerts` — authed create-only, no client read.

**Follow-ups (assignable):**
1. 🚨 `fraud_alerts`: clients should not write fraud alerts directly. Move `FraudDetectionService.persistAlert` to a Cloud Function (Admin SDK), then set `allow create: if false`.
2. Confirm `marketplace_drops` should be **publicly** readable (rule is `allow read: if true`). If purchase/view requires auth, change to `if isAuthenticated()`.
3. Add Firestore rules emulator tests for all new collections before relying on them in prod.

Original call-site evidence is preserved in the table below for reference.

| Collection | Client call site | Likely model | Open question / recommendation |
|---|---|---|---|
| `career_memory_archive` | [ReleaseHarnessAdapters.ts:182](packages/renderer/src/services/release-harness/ReleaseHarnessAdapters.ts#L182) | Per-user archive | Does each doc carry `userId`? If so, top-level owner-by-field rule, or move to `users/{uid}/career_memory_archive`. |
| `content_rules` | [FraudDetectionService.ts:105](packages/renderer/src/services/security/FraudDetectionService.ts#L105) | Global config (read-only) | Read by all clients; written server-side. Recommend `allow read: if isAuthenticated(); allow write: if false;`. |
| `fraud_alerts` | [FraudDetectionService.ts:235](packages/renderer/src/services/security/FraudDetectionService.ts#L235) | **Sensitive / server-only** | Client `addDoc` of fraud alerts is a smell. Should writes move to a Cloud Function (admin SDK)? Recommend server-only (`if false`) + relocate the write. **Security review.** |
| `google_search_history` | [KnowledgeTools.ts:93](packages/renderer/src/services/agent/tools/KnowledgeTools.ts#L93) | Per-user history | Stored top-level but is per-user. Scope by `userId` field, or move under `users/{uid}/`. |
| `knowledge_history` | [KnowledgeTools.ts:41](packages/renderer/src/services/agent/tools/KnowledgeTools.ts#L41) | Per-user history | Same as above. |
| `marketplace_drops` | [AutonomousTools.ts:44](packages/renderer/src/services/agent/tools/AutonomousTools.ts#L44) | Public read / owner write | Likely public-readable drops. Recommend `allow read: if isAuthenticated(); allow create/update/delete: if request.auth.uid == resource.data.sellerId` (confirm field name). |
| `sample_platforms` | [SamplePlatforms.ts:86](packages/renderer/src/services/knowledge/SamplePlatforms.ts#L86) | Global catalog (read-only) | `getDocs` read of a reference catalog. Recommend `allow read: if isAuthenticated(); allow write: if false;`. |
| `sample_requests` | [MerchandiseService.ts:172](packages/renderer/src/services/merchandise/MerchandiseService.ts#L172) | Per-user or shared workflow | Confirm ownership field; owner-by-field scope. |
| `sftp_ingestions` | [DistributionTools.ts:661](packages/renderer/src/services/agent/tools/DistributionTools.ts#L661) | **Likely server-only** | SFTP ingestion is a backend process. Should the client write here at all? Verify; likely restrict to server/admin. |
| `takedown_requests` | [DistributionTools.ts:801](packages/renderer/src/services/agent/tools/DistributionTools.ts#L801) | Per-user | Distinct from `distribution_takedowns` and `takedownCases` — consider **consolidating** with one of those instead of a new rule. |
| `video_releases` | [DistributionTools.ts:531](packages/renderer/src/services/agent/tools/DistributionTools.ts#L531) | Per-user releases | Distinct from `videoJobs`/`generated_videos`. Scope by owner field (`userId`/`artistId`). |
| `mechanical_licenses` (+ `/licenses` subcol) | [MechanicalRoyaltyService.ts:166](packages/renderer/src/services/publishing/MechanicalRoyaltyService.ts#L166) (`COLLECTION='mechanical_licenses'`, line 55) | Per-user | Path is `mechanical_licenses/{uid}/licenses/{id}`. If `{uid}` is the auth uid, add `match /mechanical_licenses/{uid}/{document=**} { allow read, write: if isOwner(uid); }`. Confirm the `{uid}` is the authed user. |

## How to action a Section C item

1. Open the client call site; confirm the document shape and ownership field.
2. Decide the access model (global-read config / owner-by-field / server-only / consolidate).
3. Add the rule to `packages/firebase/firestore.rules` (mirror an existing rule of the same model).
4. Add/extend a rules test and run `firebase firestore:rules validate`.
5. Tick it off here.

## Method note (for re-runs)

The corrected audit lives in `.agent/skills/hunter/SKILL.md` Phase 2.7. It normalizes
`match /col/{param}` → `col` and extracts every collection token (top-level + subcollection),
which the previous version got wrong (it compared bare `users` against `users/{userId}` and
mangled `collection(db,'a',id,'b')` calls, producing false 403s). Re-run after rules changes.
