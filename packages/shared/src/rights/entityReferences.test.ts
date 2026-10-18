import { describe, expect, it } from 'vitest';
import type { CanonicalMusicEntity } from '../schemas/musicEntity.js';
import { RightsEntityId, type RightsCase } from './contracts.js';
import { validateRightsEntityReferences } from './entityReferences.js';

const timestamp = '2026-01-01T00:00:00.000Z';
const base = { schemaVersion: 'canonical-music-entity.v1' as const, createdAt: timestamp, updatedAt: timestamp };
const entities: CanonicalMusicEntity[] = [
  { ...base, id: 'party:person', entityType: 'person', displayName: 'Author' },
  { ...base, id: 'catalog:work', entityType: 'musical_work', title: 'Song', alternateTitles: [] },
  { ...base, id: 'catalog:recording', entityType: 'sound_recording', title: 'Song', recordingKind: 'ORIGINAL' },
];
// This verifier consumes identity references only; legal eligibility is independently validated.
const manifest = { parties: [{ entityId: 'party:person', legalName: 'Author' }], works: [{ entityId: 'catalog:work', title: 'Song', kind: 'musical_work' }] } as RightsCase;
describe('canonical rights identity references', () => {
  it('accepts existing owner-scoped identities of the correct type', () => expect(validateRightsEntityReferences(manifest, entities)).toEqual([]));
  it('does not infer identity from a matching name', () => expect(validateRightsEntityReferences({ ...manifest, parties: [{ ...manifest.parties[0], entityId: 'invented' }] }, entities)).toEqual(['Author: select an existing person or organization identity.']));
  it('keeps recording identity separate from composition identity', () => expect(validateRightsEntityReferences({ ...manifest, works: [{ ...manifest.works[0], entityId: 'catalog:recording' }] }, entities)).toEqual(['Song: select an existing composition identity.']));
  it('accepts canonical namespace IDs but rejects document path traversal', () => {
    expect(RightsEntityId.parse('catalog:work')).toBe('catalog:work');
    for (const id of ['../other', 'owner/entity', '.', '..', 'bad\u0000id']) expect(RightsEntityId.safeParse(id).success).toBe(false);
  });
});
