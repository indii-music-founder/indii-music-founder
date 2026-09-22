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

/** Non-destructive compatibility projection. Unknown legacy values stay absent. */
export function projectLegacyArtistContext(profile: LegacyArtistProfile, observedAt: string): ArtistContext {
  const facts: Record<string, ArtistContextFact> = {};
  const add = (key: string, value: ArtistContextFact['value'] | undefined) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return;
    facts[key] = declaredContextFact(key, value, observedAt);
  };
  add('identity.artistType', profile.artistType);
  add('experience.careerStage', profile.careerStage);
  add('experience.careerProfile', profile.careerProfile);
  add('goals.current', profile.goals);
  add('infrastructure.distributor', profile.brandKit?.socials?.distributor);
  add('registrations.pro', profile.brandKit?.socials?.pro);
  return { schemaVersion: 'artist-context.v1', artistEntityId: profile.artistEntityId, facts, updatedAt: observedAt };
}

export function mergeArtistContext(base: ArtistContext | undefined, incoming: ArtistContext): ArtistContext {
  const facts = { ...(base?.facts ?? {}) };
  for (const [key, next] of Object.entries(incoming.facts)) {
    const current = facts[key];
    // Progressive enrichment may strengthen truth, but routine compatibility
    // projection must never downgrade a confirmed/documented/verified fact.
    if (isAuthoritativeContextFact(current) && !isAuthoritativeContextFact(next)) continue;
    facts[key] = next;
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
