import { z } from 'zod';
import { TOTAL_SHARE_UNITS } from '../finance/shareUnits.js';

/**
 * Semantic catalog nodes — machine-readable catalog representation for sync
 * engines, search interfaces, and licensing agents (Post-Mastering
 * Administrative Engine P5; plan §1.6 + §4).
 *
 * Preclearance booleans are COMPUTED by deterministic code (exact share-unit
 * sums + signed-receipt coverage) — never asserted by a model. Public
 * exposure is owner-set (`visibility`), default private; only nodes whose
 * owner opted into 'link' or 'public' are ever mirrored to the public
 * projection the JSON-LD endpoint serves.
 */

export const SEMANTIC_CATALOG_SCHEMA_VERSION = 'semantic-catalog-node.v1';

export const SemanticNodeKindSchema = z.enum(['track', 'release', 'writer', 'master_owner']);
export type SemanticNodeKind = z.infer<typeof SemanticNodeKindSchema>;

export const SemanticRelationSchema = z
    .object({
        subject: z.string().min(1).max(160),
        predicate: z.enum([
            'isrc',
            'iswc',
            'bpm',
            'key',
            'mood_tags',
            'instrumental_available',
            'stems_available',
            'part_of_release',
            'written_by',
            'master_owned_by',
        ]),
        object: z.string().min(1).max(200),
    })
    .strict();
export type SemanticRelation = z.infer<typeof SemanticRelationSchema>;

export const SemanticVisibilitySchema = z.enum(['private', 'link', 'public']);
export type SemanticVisibility = z.infer<typeof SemanticVisibilitySchema>;

export const SemanticCatalogNodeSchema = z
    .object({
        entityId: z.string().min(1).max(160),
        ownerId: z.string().min(1).max(128),
        schemaVersion: z.literal(SEMANTIC_CATALOG_SCHEMA_VERSION),
        kind: SemanticNodeKindSchema,
        displayName: z.string().min(1).max(300),
        isrc: z.string().max(16).optional(),
        iswc: z.string().max(16).optional(),
        upc: z.string().max(14).optional(),
        bpm: z.number().positive().max(400).optional(),
        key: z.string().max(12).optional(),
        moodTags: z.array(z.string().min(1).max(60)).max(30),
        instrumentalAvailable: z.boolean(),
        stemsAvailable: z.boolean(),
        master100PercentPrecleared: z.boolean(),
        publishing100PercentPrecleared: z.boolean(),
        syncContactEndpoint: z.string().max(300).nullable(),
        territoryRestrictions: z.array(z.string().min(2).max(2)).max(100),
        relations: z.array(SemanticRelationSchema).max(500),
        visibility: SemanticVisibilitySchema,
        generatedAt: z.string().datetime(),
    })
    .strict();
export type SemanticCatalogNode = z.infer<typeof SemanticCatalogNodeSchema>;

// ── JSON-LD projection ──────────────────────────────────────────────────────

export const CATALOG_JSONLD_CONTEXT = 'https://schema.org';
export const INDII_CATALOG_NAMESPACE = 'https://indii.music/ns/catalog/v1#';

const JsonLdRelationSchema = z
    .object({
        '@type': z.literal('indii:CatalogRelation'),
        'indii:predicate': z.string().min(1),
        'indii:object': z.string().min(1),
    })
    .strict();

const JsonLdPropertySchema = z
    .object({
        '@type': z.literal('PropertyValue'),
        name: z.string().min(1),
        value: z.union([z.string(), z.boolean(), z.number()]),
    })
    .strict();

export const CatalogJsonLdSchema = z
    .object({
        '@context': z.string(),
        '@type': z.enum(['MusicRecording', 'MusicAlbum', 'Person', 'MusicGroup']),
        '@id': z.string().min(1),
        name: z.string().min(1),
        identifier: z.string().optional(),
        additionalProperty: z.array(JsonLdPropertySchema),
        'indii:relations': z.array(JsonLdRelationSchema),
    })
    .strict();
export type CatalogJsonLd = z.infer<typeof CatalogJsonLdSchema>;

const SCHEMA_ORG_TYPE: Record<SemanticNodeKind, CatalogJsonLd['@type']> = {
    track: 'MusicRecording',
    release: 'MusicAlbum',
    writer: 'Person',
    master_owner: 'MusicGroup',
};

/**
 * Deterministic JSON-LD projection of a semantic node for the public API.
 * The indii: extension predicates carry the unambiguous rights-availability
 * flags so licensing bots parse them without conversational ambiguity.
 */
export function toCatalogJsonLd(node: SemanticCatalogNode): CatalogJsonLd {
    const additionalProperty: CatalogJsonLd['additionalProperty'] = [
        { '@type': 'PropertyValue', name: 'master_100_percent_precleared', value: node.master100PercentPrecleared },
        { '@type': 'PropertyValue', name: 'publishing_100_percent_precleared', value: node.publishing100PercentPrecleared },
        { '@type': 'PropertyValue', name: 'instrumental_available', value: node.instrumentalAvailable },
        { '@type': 'PropertyValue', name: 'stems_available', value: node.stemsAvailable },
    ];
    if (node.syncContactEndpoint) {
        additionalProperty.push({ '@type': 'PropertyValue', name: 'sync_contact_endpoint', value: node.syncContactEndpoint });
    }
    for (const territory of node.territoryRestrictions) {
        additionalProperty.push({ '@type': 'PropertyValue', name: 'territory_restriction', value: territory });
    }
    return CatalogJsonLdSchema.parse({
        '@context': CATALOG_JSONLD_CONTEXT,
        '@type': SCHEMA_ORG_TYPE[node.kind],
        '@id': `${INDII_CATALOG_NAMESPACE}${node.entityId}`,
        name: node.displayName,
        ...(node.isrc ? { identifier: node.isrc } : {}),
        additionalProperty,
        'indii:relations': node.relations.map((relation) => ({
            '@type': 'indii:CatalogRelation',
            'indii:predicate': relation.predicate,
            'indii:object': relation.object,
        })),
    });
}

// ── Deterministic preclearance derivation ───────────────────────────────────

export interface PreclearanceInput {
    recordingShareBasisUnits: number[];
    publishingShareBasisUnits: number[];
    /** Collaborator ids covered by EXECUTED signature receipts. */
    signedCollaboratorIds: ReadonlySet<string>;
    recordingHolders: readonly string[];
    publishingHolders: readonly string[];
}

export function derivePreclearance(input: PreclearanceInput): {
    master100PercentPrecleared: boolean;
    publishing100PercentPrecleared: boolean;
} {
    const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
    const allSigned = (holders: readonly string[]): boolean =>
        holders.length > 0 && holders.every((holder) => input.signedCollaboratorIds.has(holder));

    return {
        master100PercentPrecleared:
            sum(input.recordingShareBasisUnits) === TOTAL_SHARE_UNITS && allSigned(input.recordingHolders),
        publishing100PercentPrecleared:
            sum(input.publishingShareBasisUnits) === TOTAL_SHARE_UNITS && allSigned(input.publishingHolders),
    };
}
