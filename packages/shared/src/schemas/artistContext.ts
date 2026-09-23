import { z } from 'zod';
import { ProvenanceSchema, ProvenanceStateSchema } from './musicEntity.js';

/**
 * Artist Context v1 — the progressive, shared understanding of an artist.
 *
 * This is embedded in the existing user profile. It does not replace canonical
 * music identity and never treats an external identifier as identity. Facts
 * retain independent truth/provenance so an inference cannot silently become
 * an authoritative business or legal assertion.
 */
const ContextKeySchema = z.string().trim().min(1).max(120);
const ContextValueSchema = z.union([
  z.string().max(4000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().trim().min(1).max(500)).max(100),
]);

export const ArtistContextFactSchema = z.object({
  key: ContextKeySchema,
  value: ContextValueSchema,
  provenance: ProvenanceSchema,
  /** Authoritative facts require a human checkpoint before use in filings or rights decisions. */
  requiresHumanConfirmation: z.boolean().default(false),
}).strict();
export type ArtistContextFact = z.infer<typeof ArtistContextFactSchema>;

export const ArtistContextSchema = z.object({
  schemaVersion: z.literal('artist-context.v1'),
  /** indii canonical artist entity ID; never an ISNI, platform ID, or other external ID. */
  artistEntityId: z.string().trim().min(1).max(160).optional(),
  facts: z.record(ContextKeySchema, ArtistContextFactSchema).default({}),
  updatedAt: z.string().datetime(),
}).strict().superRefine((context, ctx) => {
  for (const [key, fact] of Object.entries(context.facts)) {
    if (key !== fact.key) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts', key, 'key'], message: 'Fact key must match its map key.' });
  }
});
export type ArtistContext = z.infer<typeof ArtistContextSchema>;

export type LegacyArtistProfile = {
  artistEntityId?: string;
  artistType?: string;
  careerStage?: string;
  careerProfile?: string;
  goals?: string[];
  brandKit?: { socials?: { distributor?: string; pro?: string } };
};

/**
 * Stable keys for the existing v1 fact map.  Keeping this vocabulary in one
 * place lets onboarding and downstream departments share a contract without
 * creating a second profile model or promoting an external ID to identity.
 */
export const ARTIST_CONTEXT_KEYS = {
  displayName: 'identity.displayName',
  artistType: 'identity.artistType',
  personEntityIds: 'identity.personEntityIds',
  organizationEntityIds: 'identity.organizationEntityIds',
  workingRoles: 'roles.working',
  careerStage: 'experience.careerStage',
  careerProfile: 'experience.careerProfile',
  experienceSummary: 'experience.summary',
  goals: 'goals.current',
  territories: 'infrastructure.territories',
  businessStructure: 'infrastructure.businessStructure',
  collaborators: 'team.collaborators',
  distributor: 'infrastructure.distributor',
  pro: 'registrations.pro',
  catalogMaturity: 'catalog.releaseMaturity',
  guidanceDepth: 'preferences.guidanceDepth',
  workflowPreference: 'preferences.workflow',
} as const;

export type ArtistContextPatch = Partial<Record<keyof typeof ARTIST_CONTEXT_KEYS, ArtistContextFact['value']>>;

const AUTHORITATIVE_STATES = new Set<z.infer<typeof ProvenanceStateSchema>>([
  'USER_CONFIRMED', 'DOCUMENTED', 'EXTERNAL_VERIFIED',
]);

export function isAuthoritativeContextFact(fact: ArtistContextFact | undefined): boolean {
  return !!fact && !fact.requiresHumanConfirmation && AUTHORITATIVE_STATES.has(fact.provenance.state);
}

export function declaredContextFact(key: string, value: ArtistContextFact['value'], observedAt: string, sourceId?: string): ArtistContextFact {
  return {
    key,
    value,
    requiresHumanConfirmation: false,
    provenance: { state: 'USER_DECLARED', sourceType: 'USER', sourceId, evidence: [], observedAt },
  };
}

/** Legacy/imported values are useful hints, never a declaration by the current user. */
export function importedContextFact(key: string, value: ArtistContextFact['value'], observedAt: string, sourceId = 'legacy-profile'): ArtistContextFact {
  return {
    key,
    value,
    requiresHumanConfirmation: true,
    provenance: { state: 'UNKNOWN', sourceType: 'IMPORT', sourceId, evidence: [], observedAt },
  };
}

/** Non-destructive compatibility projection. Unknown legacy values stay absent. */
export function projectLegacyArtistContext(profile: LegacyArtistProfile, observedAt: string): ArtistContext {
  const facts: Record<string, ArtistContextFact> = {};
  const add = (key: string, value: ArtistContextFact['value'] | undefined) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    facts[key] = importedContextFact(key, value, observedAt);
  };
  add('identity.artistType', profile.artistType);
  add('experience.careerStage', profile.careerStage);
  add('experience.careerProfile', profile.careerProfile);
  add('goals.current', profile.goals);
  add('infrastructure.distributor', profile.brandKit?.socials?.distributor);
  add('registrations.pro', profile.brandKit?.socials?.pro);
  return { schemaVersion: 'artist-context.v1', artistEntityId: profile.artistEntityId, facts, updatedAt: observedAt };
}

const CONTEXT_PRECEDENCE: Record<z.infer<typeof ProvenanceStateSchema>, number> = {
  UNKNOWN: 0,
  DETECTED: 1,
  INFERRED: 2,
  USER_DECLARED: 3,
  USER_CONFIRMED: 4,
  DOCUMENTED: 5,
  EXTERNAL_VERIFIED: 6,
  DISPUTED: 7,
};

function mayReplaceContextFact(current: ArtistContextFact | undefined, next: ArtistContextFact): boolean {
  if (!current) return true;
  // A dispute must remain visible until an explicit resolution workflow is
  // introduced; routine enrichment cannot erase it.
  if (current.provenance.state === 'DISPUTED') return false;
  const currentRank = CONTEXT_PRECEDENCE[current.provenance.state];
  const nextRank = CONTEXT_PRECEDENCE[next.provenance.state];
  if (nextRank !== currentRank) return nextRank > currentRank;
  return next.provenance.observedAt >= current.provenance.observedAt;
}

/** Applies user-supplied onboarding answers to the existing fact-map contract. */
export function applyDeclaredArtistContextPatch(base: ArtistContext | undefined, patch: ArtistContextPatch, observedAt: string, sourceId = 'onboarding'): ArtistContext {
  const facts: Record<string, ArtistContextFact> = {};
  for (const [name, value] of Object.entries(patch) as Array<[keyof typeof ARTIST_CONTEXT_KEYS, ArtistContextFact['value'] | undefined]>) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const key = ARTIST_CONTEXT_KEYS[name];
    facts[key] = declaredContextFact(key, value, observedAt, sourceId);
  }
  return mergeArtistContext(base, { schemaVersion: 'artist-context.v1', artistEntityId: base?.artistEntityId, facts, updatedAt: observedAt });
}

export function mergeArtistContext(base: ArtistContext | undefined, incoming: ArtistContext): ArtistContext {
  const facts = { ...(base?.facts ?? {}) };
  for (const [key, next] of Object.entries(incoming.facts)) {
    const current = facts[key];
    if (mayReplaceContextFact(current, next)) facts[key] = next;
  }
  return ArtistContextSchema.parse({
    schemaVersion: 'artist-context.v1',
    artistEntityId: base?.artistEntityId ?? incoming.artistEntityId,
    facts,
    updatedAt: incoming.updatedAt,
  });
}

export type DepartmentArtistContext = {
  artistEntityId?: string;
  guidance: { careerStage?: string; goals: string[] };
  known: Record<string, ArtistContextFact>;
  authoritative: Record<string, ArtistContextFact>;
  needsConfirmation: string[];
};

function consume(context: ArtistContext, keys: string[]): DepartmentArtistContext {
  const known: Record<string, ArtistContextFact> = {};
  const authoritative: Record<string, ArtistContextFact> = {};
  const needsConfirmation: string[] = [];
  for (const key of keys) {
    const fact = context.facts[key];
    if (!fact) continue;
    known[key] = fact;
    if (isAuthoritativeContextFact(fact)) authoritative[key] = fact;
    else if (fact.requiresHumanConfirmation || key.startsWith('registrations.') || key.startsWith('rights.')) needsConfirmation.push(key);
  }
  const stage = context.facts['experience.careerStage']?.value;
  const goals = context.facts['goals.current']?.value;
  return {
    artistEntityId: context.artistEntityId,
    guidance: { careerStage: typeof stage === 'string' ? stage : undefined, goals: Array.isArray(goals) ? goals : [] },
    known,
    authoritative,
    needsConfirmation,
  };
}

export function contextForRegistration(context: ArtistContext): DepartmentArtistContext {
  return consume(context, ['experience.careerStage', 'goals.current', 'identity.artistType', 'registrations.pro', 'registrations.mlc', 'registrations.soundExchange']);
}

export function contextForDistribution(context: ArtistContext): DepartmentArtistContext {
  return consume(context, ['experience.careerStage', 'goals.current', 'identity.artistType', 'infrastructure.distributor', 'catalog.releaseMaturity']);
}
