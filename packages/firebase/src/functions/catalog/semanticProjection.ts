import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
    derivePreclearance,
    toCatalogJsonLd,
    type SemanticCatalogNode,
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
        const entityId = String(request.query['entityId'] ?? '').trim();
        if (!entityId || entityId.length > 160) {
            response.status(400).json({ error: 'entityId query parameter is required.' });
            return;
        }
        const snapshot = await getDb().collection('public_catalog').doc(entityId).get();
        if (!snapshot.exists) {
            response.setHeader('Cache-Control', 'public, max-age=60');
            response.status(404).json({ error: 'No public catalog entity with this id.' });
            return;
        }
        const data = snapshot.data() ?? {};
        const node = {
            entityId: String(data['entityId'] ?? entityId),
            ownerId: String(data['ownerId'] ?? ''),
            schemaVersion: 'semantic-catalog-node.v1' as const,
            kind: (data['kind'] ?? 'track') as SemanticCatalogNode['kind'],
            displayName: String(data['displayName'] ?? 'untitled'),
            moodTags: Array.isArray(data['moodTags']) ? data['moodTags'] as string[] : [],
            instrumentalAvailable: Boolean(data['instrumentalAvailable']),
            stemsAvailable: Boolean(data['stemsAvailable']),
            master100PercentPrecleared: Boolean(data['master100PercentPrecleared']),
            publishing100PercentPrecleared: Boolean(data['publishing100PercentPrecleared']),
            syncContactEndpoint: (data['syncContactEndpoint'] ?? null) as string | null,
            territoryRestrictions: Array.isArray(data['territoryRestrictions']) ? data['territoryRestrictions'] as string[] : [],
            relations: Array.isArray(data['relations']) ? data['relations'] as SemanticCatalogNode['relations'] : [],
            visibility: 'public' as const,
            generatedAt: typeof data['generatedAt'] === 'string' ? data['generatedAt'] : new Date().toISOString(),
            ...(typeof data['isrc'] === 'string' && data['isrc'] ? { isrc: data['isrc'] } : {}),
            ...(typeof data['iswc'] === 'string' && data['iswc'] ? { iswc: data['iswc'] } : {}),
            ...(typeof data['upc'] === 'string' && data['upc'] ? { upc: data['upc'] } : {}),
            ...(typeof data['bpm'] === 'number' && data['bpm'] > 0 ? { bpm: data['bpm'] } : {}),
            ...(typeof data['key'] === 'string' && data['key'] ? { key: data['key'] } : {}),
        };
        const jsonLd = toCatalogJsonLd(node);
        response.setHeader('Content-Type', 'application/ld+json');
        response.setHeader('Cache-Control', 'public, max-age=300');
        response.status(200).json(jsonLd);
    },
);
