import { describe, expect, it } from 'vitest';
import {
    CatalogJsonLdSchema,
    SemanticCatalogNodeSchema,
    derivePreclearance,
    toCatalogJsonLd,
    type SemanticCatalogNode,
} from './semanticCatalog.js';
import { TOTAL_SHARE_UNITS } from '../finance/shareUnits.js';

function node(overrides: Partial<SemanticCatalogNode> = {}): SemanticCatalogNode {
    return SemanticCatalogNodeSchema.parse({
        entityId: 'track-1',
        ownerId: 'user-1',
        schemaVersion: 'semantic-catalog-node.v1',
        kind: 'track',
        displayName: 'Midnight Motorway',
        isrc: 'USABC7123456',
        moodTags: ['nightdrive'],
        instrumentalAvailable: true,
        stemsAvailable: false,
        master100PercentPrecleared: false,
        publishing100PercentPrecleared: false,
        syncContactEndpoint: null,
        territoryRestrictions: ['US'],
        relations: [{ subject: 'track-1', predicate: 'isrc', object: 'USABC7123456' }],
        visibility: 'public',
        generatedAt: '2026-09-26T12:00:00.000Z',
        ...overrides,
    });
}

describe('derivePreclearance (deterministic rights flags)', () => {
    it('is true only when sums are exact AND every holder signed', () => {
        const half = TOTAL_SHARE_UNITS / 2;
        const signed = new Set(['ana', 'zed', 'wren']);
        const result = derivePreclearance({
            recordingShareBasisUnits: [half, half],
            publishingShareBasisUnits: [600_000, 400_000],
            signedCollaboratorIds: signed,
            recordingHolders: ['ana', 'zed'],
            publishingHolders: ['ana', 'wren'],
        });
        expect(result).toEqual({ master100PercentPrecleared: true, publishing100PercentPrecleared: true });
    });

    it('is false when a holder has not signed even if sums are exact', () => {
        const result = derivePreclearance({
            recordingShareBasisUnits: [TOTAL_SHARE_UNITS],
            publishingShareBasisUnits: [TOTAL_SHARE_UNITS],
            signedCollaboratorIds: new Set(['ana']),
            recordingHolders: ['ana', 'zed'],
            publishingHolders: ['ana'],
        });
        expect(result.master100PercentPrecleared).toBe(false);
        expect(result.publishing100PercentPrecleared).toBe(true);
    });

    it('is false when sums drift by one basis unit', () => {
        const result = derivePreclearance({
            recordingShareBasisUnits: [TOTAL_SHARE_UNITS - 1],
            publishingShareBasisUnits: [TOTAL_SHARE_UNITS],
            signedCollaboratorIds: new Set(['ana']),
            recordingHolders: ['ana'],
            publishingHolders: ['ana'],
        });
        expect(result.master100PercentPrecleared).toBe(false);
    });

    it('is false with no holders at all (nothing is precleared by default)', () => {
        const result = derivePreclearance({
            recordingShareBasisUnits: [],
            publishingShareBasisUnits: [],
            signedCollaboratorIds: new Set(),
            recordingHolders: [],
            publishingHolders: [],
        });
        expect(result.master100PercentPrecleared).toBe(false);
    });
});

describe('toCatalogJsonLd (machine-readable projection)', () => {
    it('emits schema.org context, rights flags as PropertyValues, and directional relations', () => {
        const jsonLd = toCatalogJsonLd(node({
            syncContactEndpoint: 'sync@artist.example',
            territoryRestrictions: ['US', 'DE'],
        }));
        expect(jsonLd['@context']).toBe('https://schema.org');
        expect(jsonLd['@type']).toBe('MusicRecording');
        expect(jsonLd['@id']).toContain('track-1');
        expect(jsonLd.identifier).toBe('USABC7123456');
        const flags = Object.fromEntries(jsonLd.additionalProperty.map((property) => [property.name, property.value]));
        expect(flags['master_100_percent_precleared']).toBe(false);
        expect(flags['sync_contact_endpoint']).toBe('sync@artist.example');
        const territoryEntries = jsonLd.additionalProperty.filter((property) => property.name === 'territory_restriction');
        expect(territoryEntries.map((property) => property.value)).toEqual(['US', 'DE']);
        expect(jsonLd['indii:relations'][0]).toMatchObject({ 'indii:predicate': 'isrc', 'indii:object': 'USABC7123456' });
    });

    it('matches the JSON-LD schema (golden shape)', () => {
        const jsonLd = toCatalogJsonLd(node({ kind: 'release', isrc: undefined, iswc: 'T-034524680-1' }));
        expect(CatalogJsonLdSchema.safeParse(jsonLd).success).toBe(true);
        expect(jsonLd['@type']).toBe('MusicAlbum');
    });
});

describe('SemanticCatalogNodeSchema', () => {
    it('defaults nothing silently — visibility is owner-set and required', () => {
        const partial = node();
        expect(partial.visibility).toBe('public');
        const parsed = SemanticCatalogNodeSchema.safeParse({ ...partial, visibility: 'classified' });
        expect(parsed.success).toBe(false);
    });

    it('rejects unknown fields (strict surface for the public projection)', () => {
        const parsed = SemanticCatalogNodeSchema.safeParse({ ...node(), freeform: 'x' });
        expect(parsed.success).toBe(false);
    });
});
