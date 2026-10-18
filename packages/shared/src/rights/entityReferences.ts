import type { CanonicalMusicEntity } from '../schemas/musicEntity.js';
import type { RightsCase } from './contracts.js';

/** A legal name or an external identifier never creates canonical identity. */
export function validateRightsEntityReferences(manifest: RightsCase, entities: readonly CanonicalMusicEntity[]): string[] {
  const directory = new Map(entities.map(entity => [entity.id, entity]));
  const errors: string[] = [];
  for (const party of manifest.parties) {
    const entity = directory.get(party.entityId);
    if (!entity || !['person', 'organization'].includes(entity.entityType)) errors.push(`${party.legalName}: select an existing person or organization identity.`);
  }
  for (const work of manifest.works) {
    if (directory.get(work.entityId)?.entityType !== work.kind) errors.push(`${work.title}: select an existing ${work.kind === 'musical_work' ? 'composition' : 'recording'} identity.`);
  }
  return errors;
}
