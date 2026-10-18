import { z } from 'zod';

export const RIGHTS_LIMITS = Object.freeze({ globalSessions: 5, ownerSessions: 1, sessionMs: 120 * 60_000, idleMs: 15 * 60_000, rememberMs: 7 * 86400_000, ticketMs: 60_000, depositBytes: 500 * 1024 * 1024 });
export const RightsId = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/);
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const RightsEntityId = z.string().trim().min(1).max(160).refine(id => id !== '.' && id !== '..' && !id.includes('/') && Array.from(id).every(c => { const code = c.codePointAt(0)!; return code >= 32 && code !== 127; }));
const Text = z.string().trim().min(1).max(500);
const DateOnly = z.string().date();
export const CopyrightApplicationKind = z.enum(['standard', 'gruw', 'gram_composition', 'gram_recording']);
export const RightsProviderSchema = z.enum(['loc_copyright', 'musicmark', 'the_mlc', 'sesac', 'soundexchange']);
export const FilingStateSchema = z.enum(['draft', 'needs_information', 'ready', 'in_progress', 'outcome_unknown', 'submitted', 'accepted', 'rejected', 'registered']);
export type FilingState = z.infer<typeof FilingStateSchema>;
export const RightsPartySchema = z.object({ entityId: RightsEntityId, legalName: Text, address: Text, citizenshipOrDomicile: Text }).strict();
export const RightsDepositSchema = z.object({
  bucket: Text, path: Text, generation: z.string().regex(/^[1-9][0-9]*$/), sha256: Sha256,
  filename: Text, mimeType: z.enum(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/aiff', 'application/pdf']),
  byteSize: z.number().int().positive().max(RIGHTS_LIMITS.depositBytes),
  convertedFrom: z.object({ generation: Text, sha256: Sha256, mimeType: Text }).strict().optional(),
}).strict();
export const CopyrightWorkSchema = z.object({
  entityId: RightsEntityId, trackIds: z.array(RightsId).min(1).max(100), kind: z.enum(['musical_work', 'sound_recording']),
  embodiedWorkId: RightsEntityId.optional(),
  title: Text, authorIds: z.array(RightsEntityId).min(1).max(100), claimantIds: z.array(RightsEntityId).min(1).max(100),
  yearOfCreation: z.number().int().min(1900).max(2200), workForHire: z.boolean(),
  publication: z.discriminatedUnion('status', [
    z.object({ status: z.literal('unpublished') }).strict(),
    z.object({ status: z.literal('published'), date: DateOnly, country: Text,
      albumId: RightsId.optional(), albumTitle: Text.optional(), albumDate: DateOnly.optional(),
      trackNumber: z.number().int().positive().optional(), identicalEarlierSingle: z.boolean().optional() }).strict(),
  ]),
  // A claimant who is not an author must supply the basis of the transfer.
  transferBasis: Text.optional(), exclusions: z.array(Text).max(100).default([]),
  deposit: RightsDepositSchema,
}).strict();
export const RightsCaseSchema = z.object({
  schemaVersion: z.literal(2), caseId: RightsId, revision: z.number().int().positive(),
  applicationKind: CopyrightApplicationKind, claimScope: z.enum(['composition', 'recording', 'combined']),
  parties: z.array(RightsPartySchema).min(1).max(100), works: z.array(CopyrightWorkSchema).min(1).max(40),
  certifierPartyId: RightsEntityId, authority: z.enum(['author', 'claimant', 'authorized_agent']),
  authorityEvidence: Text.optional(),
}).strict();
export type RightsCase = z.infer<typeof RightsCaseSchema>;
export type CopyrightWork = z.infer<typeof CopyrightWorkSchema>;

/** Deterministic eligibility only. It never declares ownership or files a claim. */
export function validateCopyrightCase(input: RightsCase): string[] {
  const errors: string[] = [];
  const { works, applicationKind: kind } = input;
  const parties = new Set(input.parties.map(p => p.entityId));
  if (parties.size !== input.parties.length) errors.push('Party identifiers must be unique.');
  if (new Set(works.map(w => w.entityId)).size !== works.length) errors.push('Work identifiers must be unique.');
  if (!parties.has(input.certifierPartyId)) errors.push('Select a known certifying party.');
  if (input.authority === 'author' && works.some(w => !w.authorIds.includes(input.certifierPartyId))) errors.push('The certifying author must be an author of every claimed work, or document agency authority.');
  if (input.authority === 'claimant' && works.some(w => !w.claimantIds.includes(input.certifierPartyId))) errors.push('The certifying claimant must be a claimant for every claimed work, or document agency authority.');
  if (input.authority === 'authorized_agent' && !input.authorityEvidence) errors.push('Document the certifier’s agency authority.');
  const today = new Date().toISOString().slice(0, 10);
  for (const work of works) {
    if (work.publication.status === 'published' && (work.publication.date > today || (work.publication.albumDate && work.publication.albumDate > today))) errors.push(`${work.title}: publication dates cannot be in the future.`);
    if (work.publication.status === 'published' && work.yearOfCreation > Number(work.publication.date.slice(0, 4))) errors.push(`${work.title}: creation cannot follow first publication.`);
    if (work.yearOfCreation > new Date().getUTCFullYear()) errors.push(`${work.title}: creation year is in the future.`);
    if (work.authorIds.some(id => !parties.has(id)) || work.claimantIds.some(id => !parties.has(id))) errors.push(`${work.title}: author or claimant is missing from the party directory.`);
    if (work.claimantIds.some(id => !work.authorIds.includes(id)) && !work.transferBasis) errors.push(`${work.title}: claimant transfer basis is required.`);
    if (new Set(work.authorIds).size !== work.authorIds.length || new Set(work.claimantIds).size !== work.claimantIds.length) errors.push(`${work.title}: duplicate authors or claimants.`);
  }
  const same = (sets: string[][]) => sets.every(s => [...s].sort().join('|') === [...sets[0]].sort().join('|'));
  const compositions = works.filter(w => w.kind === 'musical_work');
  const recordings = works.filter(w => w.kind === 'sound_recording');
  const paired = recordings.length === compositions.length && new Set(recordings.map(w => w.embodiedWorkId)).size === recordings.length
    && recordings.every(w => compositions.some(c => c.entityId === w.embodiedWorkId && c.trackIds.some(id => w.trackIds.includes(id))));
  if (input.claimScope !== 'combined' && works.some(w => w.kind !== (input.claimScope === 'composition' ? 'musical_work' : 'sound_recording'))) errors.push('Every work must match the selected claim scope.');
  if (kind === 'standard') {
    if (input.claimScope === 'combined') {
      if (works.length !== 2 || works[0].kind === works[1].kind || !paired || !same(works.map(w => w.claimantIds))) errors.push('A combined standard claim needs one composition and its recording with the same claimants.');
    } else if (works.length !== 1 || works[0].kind !== (input.claimScope === 'composition' ? 'musical_work' : 'sound_recording')) errors.push('A standard claim must contain one work of the selected type.');
  } else if (kind === 'gruw') {
    const count = input.claimScope === 'combined' ? works.filter(w => w.kind === 'sound_recording').length : works.length;
    if (count < 2 || count > 10) errors.push('GRUW requires 2–10 eligible unpublished works.');
    if (works.some(w => w.publication.status !== 'unpublished')) errors.push('GRUW cannot include published works.');
    if (!same(works.map(w => w.authorIds)) || !same(works.map(w => w.claimantIds)) || works.some(w => !same([w.authorIds, w.claimantIds]))) errors.push('GRUW requires the same authors and author-claimants for every work.');
    if (input.claimScope === 'combined' && !paired) errors.push('Combined GRUW requires explicit corresponding composition/recording links.');
  } else {
    if (works.length < 2 || works.length > 20) errors.push('GRAM requires 2–20 works.');
    const expected = kind === 'gram_composition' ? 'musical_work' : 'sound_recording';
    if (works.some(w => w.kind !== expected) || input.claimScope !== (kind === 'gram_composition' ? 'composition' : 'recording')) errors.push('GRAM composition and recording applications are separate.');
    if (!same(works.map(w => w.claimantIds))) errors.push('GRAM requires the same claimants for every work.');
    if (!works[0].authorIds.some(id => works.every(w => w.authorIds.includes(id)))) errors.push('GRAM requires a common author.');
    const publications = works.map(w => w.publication);
    const first = publications[0];
    if (first.status !== 'published' || !first.albumId || !first.albumTitle || !first.albumDate) errors.push('GRAM requires album identity and publication facts.');
    if (new Set(publications.map(p => p.status === 'published' ? p.trackNumber : undefined)).size !== publications.length) errors.push('GRAM album track numbers must be unique.');
    for (const p of publications) {
      if (p.status !== 'published' || first.status !== 'published' || !p.trackNumber || p.albumId !== first.albumId || p.albumTitle !== first.albumTitle || p.country !== first.country || p.albumDate !== first.albumDate) errors.push('GRAM works must belong to the same published album and country with track numbers.');
      else if (p.date !== p.albumDate && !(p.date < (p.albumDate ?? '') && p.identicalEarlierSingle)) errors.push('An earlier single requires confirmation that the album work is identical.');
    }
  }
  return [...new Set(errors)];
}

export const RightsEvidenceSchema = z.object({
  evidenceId: RightsId, kind: z.enum(['user_report', 'submission_receipt', 'society_ack', 'registration_certificate']),
  externalId: Text, observedAt: z.string().datetime(),
  artifact: RightsDepositSchema.optional(),
}).strict();
export type RightsEvidence = z.infer<typeof RightsEvidenceSchema>;
export function filingStateForEvidence(evidence: RightsEvidence, trustedSource: boolean): FilingState {
  if (!trustedSource || evidence.kind === 'user_report') return 'outcome_unknown';
  if (evidence.kind === 'registration_certificate') return 'registered';
  if (evidence.kind === 'society_ack') return 'accepted';
  return 'submitted';
}

export const SessionControlSchema = z.enum(['none', 'agent', 'human']);
export const SessionStateSchema = z.enum(['queued', 'starting', 'connected', 'paused', 'reconnecting', 'dispatch_unknown', 'termination_pending', 'ended', 'failed']);
export const SessionInputSchema = z.object({
  sessionId: RightsId, controlGeneration: z.number().int().nonnegative(), navigationGeneration: z.number().int().nonnegative(),
  viewportVersion: z.number().int().nonnegative(), sequence: z.number().int().positive(),
  event: z.discriminatedUnion('type', [
    z.object({ type: z.literal('dialog'), requestId: RightsId, accept: z.boolean(), text: z.string().max(500).optional() }).strict(),
    z.object({ type: z.literal('pointer'), x: z.number().min(0).max(1), y: z.number().min(0).max(1), action: z.enum(['move', 'down', 'up']), button: z.enum(['left', 'right', 'middle']).default('left') }).strict(),
    z.object({ type: z.literal('key'), key: z.string().min(1).max(50), action: z.enum(['down', 'up']) }).strict(),
    z.object({ type: z.literal('text'), text: z.string().max(500) }).strict(),
    z.object({ type: z.literal('scroll'), deltaX: z.number().min(-2000).max(2000), deltaY: z.number().min(-2000).max(2000), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
  ]),
}).strict();
export type SessionInput = z.infer<typeof SessionInputSchema>;
export interface RightsSessionFence { sessionId: string; control: 'none' | 'agent' | 'human'; controlGeneration: number; navigationGeneration: number; viewportVersion: number; lastSequence: number }
export function acceptHumanInput(fence: RightsSessionFence, input: SessionInput): boolean {
  return fence.control === 'human' && fence.sessionId === input.sessionId && fence.controlGeneration === input.controlGeneration
    && fence.navigationGeneration === input.navigationGeneration && fence.viewportVersion === input.viewportVersion && input.sequence > fence.lastSequence;
}

/** Canonical JSON used before hashing approvals and manifests on either runtime. */
export function canonicalRightsJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRightsJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalRightsJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

export const RightsDepositSelectionSchema = z.object({ type: z.literal('deposit_request'), requestId: RightsId, multiple: z.boolean(), choices: z.array(z.object({ id: RightsEntityId, label: z.string().max(500) }).strict()).max(40) }).strict();
export type RightsDepositSelection = z.infer<typeof RightsDepositSelectionSchema>;

export const RightsBrowserDialogSchema = z.object({ type: z.literal('browser_dialog'), requestId: RightsId, kind: z.enum(['alert', 'confirm', 'prompt', 'beforeunload']), message: z.string().max(4000) }).strict();
export type RightsBrowserDialog = z.infer<typeof RightsBrowserDialogSchema>;
