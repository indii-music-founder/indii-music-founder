# Canonical music persistence boundary

This is the first server-side persistence adapter for the portable music
contracts in `packages/shared/src/schemas/musicEntity.ts`,
`musicRelationship.ts`, and `musicEvent.ts`. The domain schemas remain the
source of truth; Firestore is only a scoped storage adapter. A bounded,
read-only catalog intelligence callable is connected to the Registration
Center; append operations remain server-internal and are not exposed as
client-callable writes.

## Storage layout

Each catalog is scoped beneath an existing account or organization:

```text
users/{uid}/musicCatalogEntities/{internalId}
users/{uid}/musicCatalogRelationships/{internalId}
users/{uid}/musicCatalogIdentifiers/{internalId}
users/{uid}/musicCatalogClaims/{internalId}
users/{uid}/musicCatalogEvents/{internalId}
organizations/{orgId}/musicCatalogEntities/{internalId}
organizations/{orgId}/musicCatalogRelationships/{internalId}
organizations/{orgId}/musicCatalogIdentifiers/{internalId}
organizations/{orgId}/musicCatalogClaims/{internalId}
organizations/{orgId}/musicCatalogEvents/{internalId}
```

ISRC, ISWC, UPC/EAN, IPI, ISNI, DPID, GRID, and platform identifiers belong in
the `identifiers` collection as values attached to an internal entity. They
are rejected as entity/document IDs. The adapter validates each write with the
shared Zod schema and uses Firestore create-only writes; it never overwrites an
existing assertion or silently changes provenance.

## Authority and access

The repository is server-only. Each append method requires the caller UID and
checks the destination scope: a user may write only to their own catalog; an
organization write is owner-only. Organization membership alone is
deliberately insufficient to append canonical assertions. These append
methods are not currently exposed through a callable. The Registration Center
uses a separate read-only callable that performs App Check, request
protection, entitlement admission, and owner-scope checks before returning a
bounded canonical snapshot. Any future write callable must retain the same
admission controls and define its role policy before additional writers are
allowed.

Firestore client reads and writes to both catalog paths are explicitly denied.
The Admin SDK bypasses rules, so backend call sites must retain the repository
authorization check. No client-side Firestore path or cross-department agent
is currently wired to this adapter.

## Truth and rights safeguards

The adapter stores the validated provenance state exactly as supplied. It
does not promote `DETECTED`, `INFERRED`, or `USER_DECLARED` to an authoritative
state; it does not infer ownership, entitlement, legal clearance, registration
authority, or execution permission. Claims are append-only assertions, not
proof of ownership. Corrections require a new assertion and a provenance trail
instead of replacing the prior record.

## Compatibility and rollback

This change adds a new opt-in subcollection layout and does not read, migrate,
rewrite, or delete legacy catalog/profile/release records. There is no
automatic backfill. Rollback is to stop calling the read-only projection; the
new records remain untouched and existing feature paths continue using their
current stores. Firestore rules already deny clients access to these paths,
including during rollback. A future migration must be separately versioned,
tested against real schemas, and preserve evidence/provenance.

## Readiness limit

This adapter and read projection are not a complete production rollout. No
client-facing write flow or automatic event transaction/delivery path exists.
The project must still specify and review write-callable contracts,
organization role policy, event transaction and delivery semantics, indexes,
data-retention policy, and any live-user migration gate. No production writes
are enabled by this change.

Jev is intentionally not part of this persistence path: schema validation,
scope authorization, identity assignment, and rights decisions are deterministic
and must not be delegated to a model. Jev remains appropriate only for bounded
semantic ranking or triage work elsewhere, with its result kept advisory and
human-reviewed.
