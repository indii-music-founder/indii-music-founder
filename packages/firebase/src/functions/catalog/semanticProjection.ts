import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
    derivePreclearance,
    SemanticCatalogNodeSchema,
    toCatalogJsonLd,
    CatalogJsonLdSchema,
    type SemanticCatalogNode,
    type CatalogJsonLd,
} from '@indii/shared';

/**
 * Semantic catalog projection + public JSON-LD endpoint (P5; plan §4).
 *
 * Projection: `users/{uid}/catalog_graph/{entityId}` (server-written, owner
 * readable) is regenerated from the catalog + admin ledger; nodes whose owner
 * set `visibility != 'private'` are mirrored to `public_catalog/{entityId}`.
 * Endpoint: unauthenticated GET serves ONLY the public projection as JSON-LD —
 * private catalog data is unreachable by construction.
 */

function getDb() {
    return admin.firestore();
}

export interface ProjectionInput {
    entityId: string;
    ownerId: string;
    kind: 'track' | 'release' | 'writer' | 'master_owner';
    displayName: string;
    isrc?: string;
    iswc?: string;
    upc?: string;
    bpm?: number;
    key?: string;
    moodTags: string[];
    instrumentalAvailable: boolean;
    stemsAvailable: boolean;
    recordingShareBasisUnits: number[];
    publishingShareBasisUnits: number[];
    recordingHolders: string[];
    publishingHolders: string[];
    signedCollaboratorIds: ReadonlySet<string>;
    syncContactEndpoint?: string | null;
    territoryRestrictions: string[];
    relations: SemanticCatalogNode['relations'];
    visibility: 'private' | 'link' | 'public';
    ledgerReceiptId?: string;
    generatedAtIso?: string;
}

/** Deterministic semantic node: preclearance computed, never asserted. */
export function buildSemanticNode(input: ProjectionInput): SemanticCatalogNode {
    const preclearance = derivePreclearance({
        recordingShareBasisUnits: input.recordingShareBasisUnits,
        publishingShareBasisUnits: input.publishingShareBasisUnits,
        signedCollaboratorIds: input.signedCollaboratorIds,
        recordingHolders: input.recordingHolders,
        publishingHolders: input.publishingHolders,
    });
    const node: SemanticCatalogNode = {
        entityId: input.entityId,
        ownerId: input.ownerId,
        schemaVersion: 'semantic-catalog-node.v1',
        kind: input.kind,
        displayName: input.displayName,
        moodTags: input.moodTags,
        instrumentalAvailable: input.instrumentalAvailable,
        stemsAvailable: input.stemsAvailable,
        master100PercentPrecleared: preclearance.master100PercentPrecleared,
        publishing100PercentPrecleared: preclearance.publishing100PercentPrecleared,
        syncContactEndpoint: input.syncContactEndpoint ?? null,
        territoryRestrictions: input.territoryRestrictions,
        relations: input.relations,
        visibility: input.visibility,
        generatedAt: input.generatedAtIso ?? new Date().toISOString(),
    };
    if (input.isrc) node.isrc = input.isrc;
    if (input.iswc) node.iswc = input.iswc;
    if (input.upc) node.upc = input.upc;
    if (typeof input.bpm === 'number') node.bpm = input.bpm;
    if (input.key) node.key = input.key;
    if (input.ledgerReceiptId) {
        node.relations = [
            ...node.relations,
            { subject: input.entityId, predicate: 'master_owned_by' as const, object: input.ledgerReceiptId },
        ];
    }
    return node;
}

/** Public mirror is written ONLY for opted-in nodes (link/public). */
export async function projectSemanticNode(userId: string, node: SemanticCatalogNode): Promise<{ mirrored: boolean }> {
    const db = getDb();
    await db.collection('users').doc(userId).collection('catalog_graph').doc(node.entityId).set(node);
    if (node.visibility === 'private') {
        await db.collection('public_catalog').doc(node.entityId).delete().catch(() => undefined);
        return { mirrored: false };
    }
    await db.collection('public_catalog').doc(node.entityId).set({
        entityId: node.entityId,
        ownerId: node.ownerId,
        kind: node.kind,
        displayName: node.displayName,
        isrc: node.isrc ?? null,
        iswc: node.iswc ?? null,
        upc: node.upc ?? null,
        bpm: node.bpm ?? null,
        key: node.key ?? null,
        moodTags: node.moodTags,
        instrumentalAvailable: node.instrumentalAvailable,
        stemsAvailable: node.stemsAvailable,
        master100PercentPrecleared: node.master100PercentPrecleared,
        publishing100PercentPrecleared: node.publishing100PercentPrecleared,
        syncContactEndpoint: node.syncContactEndpoint,
        territoryRestrictions: node.territoryRestrictions,
        relations: node.relations,
        generatedAt: node.generatedAt,
    });
    return { mirrored: true };
}

// ── Public JSON-LD endpoint ─────────────────────────────────────────────────

type SimpleResponse = {
    setHeader: (name: string, value: string) => unknown;
    status: (code: number) => { json: (body: unknown) => unknown };
};

export const catalogSemanticApi = onRequest(
    { region: 'us-central1', memory: '512MiB', timeoutSeconds: 30 },
    async (request, response: SimpleResponse) => {
        if (request.method !== 'GET') {
            response.status(405).json({ error: 'GET only' });
            return;
        }
        const entityId = typeof request.query['entityId'] === 'string' ? request.query['entityId'].trim() : '';
        const ownerId = typeof request.query['artistId'] === 'string' ? request.query['artistId'].trim() : '';
        const hasEntityId = typeof request.query['entityId'] === 'string' && request.query['entityId'].trim().length > 0;
        const requestedLimit = Number(request.query['limit'] ?? 20);
        const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, Math.floor(requestedLimit))) : 20;
        const rawCursor = typeof request.query['cursor'] === 'string' ? request.query['cursor'].trim() : '';

        if (hasEntityId && (typeof request.query['artistId'] === 'string' || typeof request.query['cursor'] === 'string')) {
            response.status(400).json({ error: 'Use either entityId or artistId feed parameters, not both.' });
            return;
        }
        if (entityId) {
            if (entityId.length > 160) {
                response.status(400).json({ error: 'entityId must be at most 160 characters.' });
                return;
            }
            const snapshot = await getDb().collection('public_catalog').doc(entityId).get();
            if (!snapshot.exists) {
                response.setHeader('Cache-Control', 'public, max-age=60');
                response.status(404).json({ error: 'No public catalog entity with this id.' });
                return;
            }
            const jsonLd = publicProjectionToJsonLd(entityId, snapshot.data() ?? {});
            response.setHeader('Content-Type', 'application/ld+json');
            response.setHeader('Cache-Control', 'public, max-age=300');
            response.status(200).json(jsonLd);
            return;
        }

        if (!ownerId || ownerId.length > 128 || (rawCursor && rawCursor.length > 160)) {
            response.status(400).json({ error: 'artistId is required for a public catalog feed; cursor must be a document id.' });
            return;
        }
        if (!/^[A-Za-z0-9_-]+$/.test(ownerId) || (rawCursor && !/^[A-Za-z0-9_-]+$/.test(rawCursor))) {
            response.status(400).json({ error: 'artistId and cursor must use document-id characters only.' });
            return;
        }
        let query = getDb().collection('public_catalog')
            .where('ownerId', '==', ownerId)
            .orderBy('__name__')
            .limit(limit + 1);
        if (rawCursor) query = query.startAfter(rawCursor);
        const page = await query.get();
        const documents = page.docs.slice(0, limit);
        const graph: CatalogJsonLd[] = documents.map(document => publicProjectionToJsonLd(document.id, document.data()));
        const hasMore = page.docs.length > limit;
        response.setHeader('Content-Type', 'application/ld+json');
        response.setHeader('Cache-Control', 'public, max-age=60');
        response.status(200).json({
            '@context': 'https://schema.org',
            '@graph': graph,
            hasMore,
            nextCursor: hasMore ? documents[documents.length - 1]?.id ?? null : null,
        });
    },
);

function publicProjectionToJsonLd(entityId: string, data: Record<string, unknown>): CatalogJsonLd {
    const candidate = {
        entityId: String(data['entityId'] ?? entityId),
        ownerId: String(data['ownerId'] ?? ''),
        schemaVersion: 'semantic-catalog-node.v1' as const,
        kind: data['kind'],
        displayName: data['displayName'],
        moodTags: data['moodTags'],
        instrumentalAvailable: data['instrumentalAvailable'],
        stemsAvailable: data['stemsAvailable'],
        master100PercentPrecleared: data['master100PercentPrecleared'],
        publishing100PercentPrecleared: data['publishing100PercentPrecleared'],
        syncContactEndpoint: data['syncContactEndpoint'] ?? null,
        territoryRestrictions: data['territoryRestrictions'],
        relations: data['relations'],
        visibility: 'public' as const,
        generatedAt: data['generatedAt'],
        ...(typeof data['isrc'] === 'string' && data['isrc'] ? { isrc: data['isrc'] } : {}),
        ...(typeof data['iswc'] === 'string' && data['iswc'] ? { iswc: data['iswc'] } : {}),
        ...(typeof data['upc'] === 'string' && data['upc'] ? { upc: data['upc'] } : {}),
        ...(typeof data['bpm'] === 'number' ? { bpm: data['bpm'] } : {}),
        ...(typeof data['key'] === 'string' && data['key'] ? { key: data['key'] } : {}),
    };
    const node = SemanticCatalogNodeSchema.parse(candidate);
    return CatalogJsonLdSchema.parse(toCatalogJsonLd(node));
}
