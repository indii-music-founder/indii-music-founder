import { z } from 'zod';

export const DDEXSerializationSchema = z.enum(['XML', 'JSON', 'TSV']);
export type DDEXSerialization = z.infer<typeof DDEXSerializationSchema>;

export const DDEXStandardFamilySchema = z.enum([
  'ERN',
  'RDR_C',
  'RDR_N',
  'RDR_R',
  'RDR_RCC',
  'ECM_C',
  'ECM_MW',
  'ECM_ISRC',
  'RIN',
  'MEAD',
  'PIE',
  'BWARM',
  'OTHER',
]);
export type DDEXStandardFamily = z.infer<typeof DDEXStandardFamilySchema>;

export const DDEXStandardDefinitionSchema = z.object({
  family: DDEXStandardFamilySchema,
  version: z.string().trim().min(1),
  serialization: DDEXSerializationSchema,
  current: z.boolean(),
  avsVersion: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1),
  sourceUrl: z.string().url(),
}).strict();
export type DDEXStandardDefinition = z.infer<typeof DDEXStandardDefinitionSchema>;

export const DDEX_ALLOWED_VALUE_SET_VERSION = '012' as const;
export const DDEX_ALLOWED_VALUE_SET_PUBLISHED_AT = '2026-09-16' as const;

/**
 * Phase 2 registry seed.
 *
 * Keep standards/version facts centralized and adapter-visible. This registry
 * intentionally does not duplicate every AVS value into TypeScript until those
 * values are imported from the authoritative DDEX data dictionary/XSD.
 */
export const DDEX_STANDARD_REGISTRY: readonly DDEXStandardDefinition[] = [
  {
    family:'ERN',
    version:'4.3.2',
    serialization:'XML',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Electronic Release Notification baseline XML schema.',
    sourceUrl:'https://kb.ddex.net/reference-material/standards-specifications/',
  },
  {
    family:'RDR_C',
    version:'1.1',
    serialization:'XML',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Recording Data and Rights communication protocol.',
    sourceUrl:'https://kb.ddex.net/reference-material/standards-specifications/',
  },
  {
    family:'RDR_N',
    version:'1.5',
    serialization:'XML',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Recording Data and Rights notification.',
    sourceUrl:'https://kb.ddex.net/reference-material/standards-specifications/',
  },
  {
    family:'RDR_R',
    version:'1.1',
    serialization:'XML',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Recording Data and Rights revenue reporting.',
    sourceUrl:'https://kb.ddex.net/reference-material/standards-specifications/',
  },
  {
    family:'RDR_RCC',
    version:'1.0',
    serialization:'TSV',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Recording Data and Rights rights-claim conflict.',
    sourceUrl:'https://kb.ddex.net/reference-material/standards-specifications/',
  },
  {
    family:'ECM_C',
    version:'1.0',
    serialization:'JSON',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Entity Cluster Message communication protocol.',
    sourceUrl:'https://kb.ddex.net/implementing-each-standard/entity-cluster-message-suite-%28ecm%29/ecm-part-1-explained/',
  },
  {
    family:'ECM_MW',
    version:'1.0',
    serialization:'JSON',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Entity Cluster Message musical-work clusters.',
    sourceUrl:'https://kb.ddex.net/implementing-each-standard/entity-cluster-message-suite-%28ecm%29/',
  },
  {
    family:'ECM_ISRC',
    version:'1.0',
    serialization:'JSON',
    current:true,
    avsVersion:DDEX_ALLOWED_VALUE_SET_VERSION,
    description:'Entity Cluster Message duplicate-ISRC clusters.',
    sourceUrl:'https://kb.ddex.net/implementing-each-standard/entity-cluster-message-suite-%28ecm%29/',
  },
] as const;

export const DDEX_ECM_AVS_NAMES = [
  'ClusterMembershipType',
  'EcmFileStatus',
  'EcmMessageType',
  'EcmProposedActionType',
  'LinkVerification',
] as const;

export type DDEXEcmAvsName = (typeof DDEX_ECM_AVS_NAMES)[number];

export function getCurrentDDEXStandard(family:DDEXStandardFamily):DDEXStandardDefinition|undefined{
  return DDEX_STANDARD_REGISTRY.find(definition=>definition.family===family && definition.current);
}
