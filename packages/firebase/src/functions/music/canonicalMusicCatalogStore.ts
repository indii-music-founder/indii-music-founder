import {
    CatalogIntelligenceInputSchema,
    CanonicalMusicEntitySchema,
    MusicDomainEventSchema,
    MusicIdentifierSchema,
    MusicRelationshipSchema,
    RightsClaimSchema,
    type CatalogIntelligenceInput,
    type CanonicalMusicEntity,
    type MusicDomainEvent,
    type MusicIdentifier,
    type MusicRelationship,
    type RightsClaim,
} from '@indii/shared';
import { FieldPath, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

/**
 * Server-only persistence boundary for canonical indii.music records.
 *
 * The store is not itself a callable. Its current review-only reader is
 * exposed through getCanonicalMusicCatalogIntelligence, which validates App
 * Check/request admission and passes the authenticated UID; this store then
 * independently enforces personal ownership or organization owner scope.
 * Client Firestore access remains denied by firestore.rules.
 *
 * Records are append-only here: a correction is a new canonical assertion
 * with its own provenance and identity, never an in-place provenance upgrade.
 * This store does not decide rights, registration authority, or legal status.
 */

function isSafeFirestorePathSegment(id: string): boolean {
    return id !== '.' && id !== '..' && !id.includes('/')
        && Array.from(id).every(character => {
            const codePoint = character.codePointAt(0) ?? 0;
            return codePoint >= 0x20 && codePoint !== 0x7f;
        });
}

const ScopeIdSchema = z.string().trim().min(1).max(128).refine(isSafeFirestorePathSegment);
const CallerUidSchema = ScopeIdSchema;

export const CanonicalMusicCatalogScopeSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('user'), id: ScopeIdSchema }).strict(),
    z.object({ kind: z.literal('organization'), id: ScopeIdSchema }).strict(),
]);
export type CanonicalMusicCatalogScope = z.infer<typeof CanonicalMusicCatalogScopeSchema>;

type CatalogCollection = 'entities' | 'relationships' | 'identifiers' | 'claims' | 'events';
type CatalogRecord = CanonicalMusicEntity | MusicRelationship | MusicIdentifier | RightsClaim | MusicDomainEvent;

const EXTERNAL_IDENTIFIER_PREFIX = /^(?:isrc|iswc|upc|ean|icpn|isni|ipi|dpid|grid|catalog(?:_number)?|platform_id|proprietary|spotify|apple(?:_music)?|youtube|tiktok|instagram):/i;
const EXTERNAL_IDENTIFIER_VALUE = /^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}|T-\d{3}\.\d{3}\.\d{3}-\d|\d{8,14})$/i;
const MAX_SERIALIZED_RECORD_BYTES = 900_000;
const MAX_CATALOG_ANALYSIS_RECORDS_PER_COLLECTION = 5_000;
const CATALOG_ANALYSIS_PAGE_SIZE = 10;
const MAX_CATALOG_ANALYSIS_BYTES = 4_000_000;

function invalidArgument(message: string): never {
    throw new HttpsError('invalid-argument', message);
}

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown, description: string): z.infer<S> {
    const result = schema.safeParse(value);
    if (!result.success) invalidArgument(`The canonical music ${description} is invalid.`);
    return result.data;
}

function assertInternalEntityReference(id: string): void {
    if (
        !isSafeFirestorePathSegment(id)
        || EXTERNAL_IDENTIFIER_PREFIX.test(id)
        || EXTERNAL_IDENTIFIER_VALUE.test(id)
    ) {
        invalidArgument('Canonical music entity references must be internal IDs, not external identifiers.');
    }
}

function assertBoundedJson(record: CatalogRecord): void {
    let serialized: string | undefined;
    try {
        serialized = JSON.stringify(record);
    } catch {
        invalidArgument('Canonical music records must be JSON-serializable.');
    }
    if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_RECORD_BYTES) {
        invalidArgument('Canonical music records exceed the supported document size.');
    }
}

function scopeCollectionPath(scope: CanonicalMusicCatalogScope, collection: CatalogCollection): string {
    const root = scope.kind === 'user' ? 'users' : 'organizations';
    const collectionName: Record<CatalogCollection, string> = {
        entities: 'musicCatalogEntities',
        relationships: 'musicCatalogRelationships',
        identifiers: 'musicCatalogIdentifiers',
        claims: 'musicCatalogClaims',
        events: 'musicCatalogEvents',
    };
    return `${root}/${scope.id}/${collectionName[collection]}`;
}

export type CanonicalMusicCatalogRecordKind = CatalogCollection;

export interface CanonicalMusicCatalogStore {
    readCatalogIntelligenceInput(callerUid: string, scope: CanonicalMusicCatalogScope): Promise<CatalogIntelligenceInput>;
    appendEntity(callerUid: string, scope: CanonicalMusicCatalogScope, input: unknown): Promise<CanonicalMusicEntity>;
    appendRelationship(callerUid: string, scope: CanonicalMusicCatalogScope, input: unknown): Promise<MusicRelationship>;
    appendIdentifier(callerUid: string, scope: CanonicalMusicCatalogScope, input: unknown): Promise<MusicIdentifier>;
    appendClaim(callerUid: string, scope: CanonicalMusicCatalogScope, input: unknown): Promise<RightsClaim>;
    appendEvent(callerUid: string, scope: CanonicalMusicCatalogScope, input: unknown): Promise<MusicDomainEvent>;
}

async function assertOwnerScope(
    firestore: Firestore,
    callerUid: string,
    scopeInput: CanonicalMusicCatalogScope,
    operation: 'read' | 'write',
): Promise<CanonicalMusicCatalogScope> {
    const uid = CallerUidSchema.safeParse(callerUid);
    if (!uid.success) throw new HttpsError('unauthenticated', 'An authenticated user is required.');
    const scope = parse(CanonicalMusicCatalogScopeSchema, scopeInput, 'scope');

    if (scope.kind === 'user') {
        if (scope.id !== uid.data) {
            throw new HttpsError('permission-denied', `Users may ${operation} only their own canonical music catalog.`);
        }
        return scope;
    }

    const organization = await firestore.collection('organizations').doc(scope.id).get();
    if (!organization.exists) throw new HttpsError('not-found', 'Organization not found.');
    const ownerId = organization.data()?.ownerId;
    if (ownerId !== uid.data) {
        // Membership is not sufficient authority to append canonical assertions.
        throw new HttpsError('permission-denied', `Only the organization owner may ${operation} its canonical music catalog.`);
    }
    return scope;
}

interface CatalogReadBudget {
    bytesRead: number;
    truncated: boolean;
}

async function readCatalogCollection<S extends z.ZodTypeAny>(
    firestore: Firestore,
    scope: CanonicalMusicCatalogScope,
    collection: 'entities' | 'identifiers' | 'relationships',
    schema: S,
    getRecordId: (record: z.infer<S>) => string,
    budget: CatalogReadBudget,
): Promise<z.infer<S>[]> {
    const records: z.infer<S>[] = [];
    let cursor: string | undefined;

    if (budget.truncated || budget.bytesRead >= MAX_CATALOG_ANALYSIS_BYTES) {
        budget.truncated = true;
        return records;
    }

    while (records.length < MAX_CATALOG_ANALYSIS_RECORDS_PER_COLLECTION) {
        let query = firestore.collection(scopeCollectionPath(scope, collection))
            .orderBy(FieldPath.documentId())
            .limit(CATALOG_ANALYSIS_PAGE_SIZE);
        if (cursor !== undefined) query = query.startAfter(cursor);

        const page = await query.get();
        if (page.empty) break;

        for (const document of page.docs) {
            const parsed = schema.safeParse(document.data());
            if (!parsed.success || getRecordId(parsed.data) !== document.id) {
                throw new HttpsError('data-loss', 'A stored canonical music record failed validation.');
            }
            try {
                assertInternalEntityReference(document.id);
                if ('entityId' in parsed.data) assertInternalEntityReference(parsed.data.entityId);
                if ('fromEntityId' in parsed.data) {
                    assertInternalEntityReference(parsed.data.fromEntityId);
                    assertInternalEntityReference(parsed.data.toEntityId);
                }
            } catch {
                throw new HttpsError('data-loss', 'A stored canonical music record failed validation.');
            }

            const serialized = JSON.stringify(parsed.data);
            const recordBytes = Buffer.byteLength(serialized, 'utf8');
            if (budget.bytesRead + recordBytes > MAX_CATALOG_ANALYSIS_BYTES) {
                budget.truncated = true;
                return records;
            }

            budget.bytesRead += recordBytes;
            records.push(parsed.data);
            if (records.length >= MAX_CATALOG_ANALYSIS_RECORDS_PER_COLLECTION) {
                budget.truncated = true;
                return records;
            }
        }

        if (page.size < CATALOG_ANALYSIS_PAGE_SIZE) break;
        cursor = page.docs[page.docs.length - 1]?.id;
        if (cursor === undefined) break;
    }

    return records;
}

function createOnly<T extends CatalogRecord>(
    firestore: Firestore,
    scope: CanonicalMusicCatalogScope,
    collection: CatalogCollection,
    recordId: string,
    record: T,
): Promise<T> {
    assertInternalEntityReference(recordId);
    if ('fromEntityId' in record) {
        assertInternalEntityReference(record.fromEntityId);
        assertInternalEntityReference(record.toEntityId);
    }
    if ('entityId' in record) assertInternalEntityReference(record.entityId);
    if ('targetEntityId' in record) {
        assertInternalEntityReference(record.targetEntityId);
        if (record.claimantEntityId) assertInternalEntityReference(record.claimantEntityId);
    }
    if ('subject' in record) {
        assertInternalEntityReference(record.subject.entityId);
        for (const related of record.relatedEntities) assertInternalEntityReference(related.entityId);
    }
    assertBoundedJson(record);
    // DocumentReference.create fails if the canonical identity already exists;
    // callers cannot silently replace facts or their provenance.
    return firestore.collection(scopeCollectionPath(scope, collection)).doc(recordId)
        .create(record as FirebaseFirestore.DocumentData)
        .then(() => record);
}

export function createCanonicalMusicCatalogStore(
    firestore: Firestore = getFirestore(),
): CanonicalMusicCatalogStore {
    return {
        async readCatalogIntelligenceInput(callerUid, scope) {
            const authorizedScope = await assertOwnerScope(firestore, callerUid, scope, 'read');
            const budget: CatalogReadBudget = { bytesRead: 0, truncated: false };
            const entities = await readCatalogCollection(
                firestore,
                authorizedScope,
                'entities',
                CanonicalMusicEntitySchema,
                record => record.id,
                budget,
            );
            const identifiers = await readCatalogCollection(
                firestore,
                authorizedScope,
                'identifiers',
                MusicIdentifierSchema,
                record => record.id,
                budget,
            );
            const relationships = await readCatalogCollection(
                firestore,
                authorizedScope,
                'relationships',
                MusicRelationshipSchema,
                record => record.id,
                budget,
            );

            return CatalogIntelligenceInputSchema.parse({
                snapshot: {
                    catalogId: `canonical:${authorizedScope.kind}:${authorizedScope.id}`,
                    // Legacy tracks are not migrated into this store, so even
                    // a fully-read subcollection cannot prove catalog completeness.
                    completeness: budget.truncated ? 'PARTIAL' : 'UNKNOWN',
                },
                entities,
                identifiers,
                relationships,
                evaluatedAt: new Date().toISOString(),
            });
        },
        async appendEntity(callerUid, scope, input) {
            const authorizedScope = await assertOwnerScope(firestore, callerUid, scope, 'write');
            const record = parse(CanonicalMusicEntitySchema, input, 'entity');
            return createOnly(firestore, authorizedScope, 'entities', record.id, record);
        },
        async appendRelationship(callerUid, scope, input) {
            const authorizedScope = await assertOwnerScope(firestore, callerUid, scope, 'write');
            const record = parse(MusicRelationshipSchema, input, 'relationship');
            return createOnly(firestore, authorizedScope, 'relationships', record.id, record);
        },
        async appendIdentifier(callerUid, scope, input) {
            const authorizedScope = await assertOwnerScope(firestore, callerUid, scope, 'write');
            const record = parse(MusicIdentifierSchema, input, 'identifier');
            return createOnly(firestore, authorizedScope, 'identifiers', record.id, record);
        },
        async appendClaim(callerUid, scope, input) {
            const authorizedScope = await assertOwnerScope(firestore, callerUid, scope, 'write');
            const record = parse(RightsClaimSchema, input, 'rights claim');
            return createOnly(firestore, authorizedScope, 'claims', record.id, record);
        },
        async appendEvent(callerUid, scope, input) {
            const authorizedScope = await assertOwnerScope(firestore, callerUid, scope, 'write');
            const record = parse(MusicDomainEventSchema, input, 'event');
            return createOnly(firestore, authorizedScope, 'events', record.eventId, record);
        },
    };
}
