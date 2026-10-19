import { z } from 'zod';
import { RightsEntityId } from './contracts.js';

/** Layouts pinned to CISAC CWR19-1070, 2.2 rev2 (2.1 rev7 compatible fields).
 * Original titles/names stay in catalog; exports require explicit ASCII text.
 * Receiver acceptance and sender authority are separate from structural validity.
 */
export const CWR_SPEC = 'CWR19-1070:2.2R2';
const A = (max: number) => z.string().trim().min(1).max(max).regex(/^[\x20-\x7e]+$/);
const cwrDuration = z.string().regex(/^\d{6}$/).refine(value => Number(value.slice(2, 4)) < 60 && Number(value.slice(4, 6)) < 60, 'Minutes and seconds must be below 60.');
const cwrDate = z.string().regex(/^\d{8}$/).refine(value => { const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10).replace(/-/g, '') === value; }, 'Use a valid calendar date.');
const society = z.string().regex(/^\d{3}$/);
const units = z.number().int().min(0).max(10000);
const Shares = z.object({ performance: units, mechanical: units, synchronization: units }).strict();
const Territory = z.object({ code: z.string().regex(/^\d{4}$/), included: z.boolean(), collection: Shares }).strict();
const Party = z.object({ id: A(9), name: A(45), ipi: z.string().regex(/^\d{9,11}$/), controlled: z.boolean(),
  societies: z.object({ performance: society, mechanical: society, synchronization: society }).strict(),
  ownership: Shares, territories: z.array(Territory).max(999),
});
export const CwrPublisherSchema = Party.extend({ chain: z.number().int().min(1).max(99), role: z.enum(['E', 'AM', 'SE', 'ES', 'PA']), agreementId: A(14).optional() }).strict();
export const CwrWriterSchema = Party.extend({ firstName: A(30).optional(), role: z.enum(['C', 'A', 'CA']),
  publisherIds: z.array(A(9)).max(99), workForHire: z.boolean(),
}).strict();
/** REC fields in the published 2.1/2.2 layouts. No legacy 2.0 SESAC flags. */
export const CwrRecordingSchema = z.object({
  releaseDate: cwrDate.optional(), duration: cwrDuration.optional(),
  albumTitle: A(60).optional(), albumLabel: A(60).optional(), catalogNumber: A(18).optional(),
  ean: z.string().regex(/^\d{13}$/).optional(), isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/).optional(),
  format: z.enum(['A', 'V']), technique: z.enum(['A', 'D', 'U']), mediaType: A(3).optional(),
  title: A(60).optional(), versionTitle: A(60).optional(), displayArtist: A(60).optional(),
  label: A(60).optional(), recordingId: A(14).optional(),
}).strict();
export interface CwrTransaction { group: number; transaction: number; type: 'NWR' | 'REV'; workId: string; revision: number; title?: string; entityId?: string }
export const CwrWorkSchema = z.object({ workId: A(14), title: A(60), transaction: z.enum(['NWR', 'REV']),
  revision: z.number().int().positive(), category: z.enum(['POP', 'JAZ', 'SER']), recorded: z.boolean(),
  duration: cwrDuration, textMusic: z.enum(['MUS', 'TXT', 'MTX']), iswc: z.string().regex(/^T\d{10}$/).optional(),
  recordings: z.array(CwrRecordingSchema).max(100).optional(),
  writers: z.array(CwrWriterSchema).min(1).max(99), publishers: z.array(CwrPublisherSchema).min(1).max(99),
}).strict();
export const CwrBatchInputSchema = z.object({
  version: z.enum(['2.1', '2.2']), recipient: z.enum(['musicmark', 'the_mlc', 'sesac']),
  sender: z.object({ name: A(45), ipi: z.string().regex(/^\d{9,11}$/), code: z.string().regex(/^[A-Z0-9]{2,3}$/) }).strict(),
  fileSequence: z.number().int().min(1).max(9999), createdAt: z.string().datetime(),
  works: z.array(CwrWorkSchema).min(1).max(10000),
  catalogLinks: z.array(z.object({ workId: A(14), entityId: RightsEntityId }).strict()).min(1).max(10000).optional(),
}).strict();
export type CwrBatchInput = z.infer<typeof CwrBatchInputSchema>;
export const CWR_PROFILES = Object.freeze({
  musicmark: { code: '707', version: 'musicmark-2025', transportEnabled: false },
  the_mlc: { code: '034', version: 'mlc-2024-05', transportEnabled: false },
  sesac: { code: '071', version: 'sesac-CWR19-1070', transportEnabled: false },
});
type Field = [start: number, width: number, value: string | number, numeric?: boolean];
function record(type: string, length: number, fields: Field[]): string {
  const chars = Array.from(' '.repeat(length));
  type.split('').forEach((c, i) => { chars[i] = c; });
  for (const [start, width, value, numeric] of fields) {
    const str = String(value);
    if (str.length > width || /[^\x20-\x7e]/.test(str)) throw new Error(`CWR ${type} field ${start} cannot be represented without loss.`);
    const padded = numeric ? str.padStart(width, '0') : str.padEnd(width, ' ');
    padded.split('').forEach((c, i) => { chars[start - 1 + i] = c; });
  }
  return chars.join('');
}
const n = (start: number, width: number, value: number | string): Field => [start, width, value, true];
const prefix = (transaction: number, sequence: number): Field[] => [n(4, 8, transaction), n(12, 8, sequence)];

export function buildCwrBatch(raw: CwrBatchInput): { text: string; filename: string; transactions: CwrTransaction[]; profileVersion: string } {
  const input = CwrBatchInputSchema.parse(raw);
  if (input.catalogLinks && (input.catalogLinks.length !== input.works.length || new Set(input.catalogLinks.map(link => link.entityId)).size !== input.works.length || new Set(input.catalogLinks.map(link => link.workId)).size !== input.works.length || input.works.some(work => !input.catalogLinks!.some(link => link.workId === work.workId)))) throw new Error('Every composition must have one unique canonical catalog link.');
  if (new Set(input.works.map(w => w.workId)).size !== input.works.length) throw new Error('Submitter work IDs must be unique.');
  const profile = CWR_PROFILES[input.recipient];
  const date = input.createdAt.slice(0, 10).replace(/-/g, '');
  const time = input.createdAt.slice(11, 19).replace(/:/g, '');
  const ipi = input.sender.ipi.padStart(11, '0');
  if (input.version === '2.1' && !ipi.startsWith('00')) throw new Error('This sender requires the CWR 2.2 extended sender layout.');
  const lines = [record('HDR', input.version === '2.2' ? 167 : 101, [
    [4, 2, ipi.startsWith('00') ? 'PB' : ipi.slice(0, 2)], n(6, 9, ipi.slice(2)), [15, 45, input.sender.name],
    [60, 5, '01.10'], [65, 8, date], [73, 6, time], [79, 8, date],
    ...(input.version === '2.2' ? [[102, 3, '2.2'], n(105, 3, 2), [108, 30, 'indii'], [138, 30, 'rights-v2']] as Field[] : []),
  ])];
  const transactions: CwrTransaction[] = [];
  let group = 0;
  for (const transactionType of ['NWR', 'REV'] as const) {
    const works = input.works.filter(w => w.transaction === transactionType);
    if (!works.length) continue;
    group++;
    const groupStart = lines.length;
    lines.push(record('GRH', 28, [[4, 3, transactionType], n(7, 5, group), [12, 5, input.version === '2.1' ? '02.10' : '02.20']]));
    works.forEach((work, transaction) => {
      const parties = [...work.writers, ...work.publishers];
      if (new Set(parties.map(p => p.id)).size !== parties.length) throw new Error('Party IDs must be unique within a work.');
      for (const right of ['performance', 'mechanical', 'synchronization'] as const) {
        const total = parties.reduce((sum, p) => sum + p.ownership[right], 0);
        if (total !== 0 && total !== 10000) throw new Error(`${work.workId}: ${right} ownership must account for 10000 units or be explicitly zero.`);
      }
      const territoryCodes = parties.flatMap(p => p.territories.filter(t => t.included).map(t => t.code));
      if (territoryCodes.some(code => !['0840', '0124', '2136'].includes(code)) || (territoryCodes.includes('2136') && territoryCodes.some(code => code !== '2136'))) throw new Error('This receiver profile supports disjoint US/Canada or worldwide territories; other territorial combinations require a reviewed profile.');
      if (input.recipient === 'musicmark') for (const p of work.publishers) {
        const original = work.publishers.find(o => o.chain === p.chain);
        if (original && p.role !== 'E' && ((original.societies.performance === '010' && ['021', '071'].includes(p.societies.performance)) || (['021', '071'].includes(original.societies.performance) && p.societies.performance === '010'))) throw new Error('Publisher chain violates MusicMark US affiliation rules.');
      }
      for (const p of parties) {
        if (!p.controlled && p.territories.length && input.version === '2.1') throw new Error('Non-controlled collection records require CWR 2.2.');
        if (new Set(p.territories.map(t => t.code)).size !== p.territories.length) throw new Error('Duplicate territories require review.');
        for (const t of p.territories) {
          const total = t.collection.performance + t.collection.mechanical + t.collection.synchronization;
          if ((!t.included && total !== 0) || (t.included && total === 0)) throw new Error('Territory inclusion and collection shares disagree.');
        }
      }
      if (!work.publishers.some(p => p.controlled && p.ipi.padStart(11, '0') === ipi)) throw new Error('The submitter must have an explicitly controlled publisher interest.');
      for (const code of new Set(parties.flatMap(p => p.territories.filter(t => t.included).map(t => t.code)))) {
        for (const right of ['performance', 'mechanical', 'synchronization'] as const) {
          if (parties.reduce((sum, p) => sum + p.territories.filter(t => t.included && t.code === code).reduce((s, t) => s + t.collection[right], 0), 0) > 10000) throw new Error('Territorial collection shares exceed 10000 units.');
        }
      }
      if (work.category !== 'POP' && work.duration === '000000') throw new Error('Duration is required for this category.');
      const hasSesacInterest = input.recipient === 'sesac' || parties.some(p => Object.values(p.societies).includes('071'));
      if (hasSesacInterest && (!work.recordings?.length || work.recordings.some(r => r.technique === 'U'))) throw new Error('SESAC preparation requires factual recording format and analogue/digital technique. Receiver onboarding must confirm its current implementation requirements.');
      if (work.recordings?.length && !work.recorded) throw new Error('Recording metadata conflicts with the declared unrecorded work.');
      let sequence = 0;
      lines.push(record(transactionType, 260, [...prefix(transaction, sequence), [20, 60, work.title], [82, 14, work.workId], [96, 11, work.iswc ?? ''],
        [127, 3, work.category], [130, 6, work.duration], [136, 1, work.recorded ? 'Y' : 'N'], [137, 3, work.textMusic], [143, 3, 'ORI']]));
      transactions.push({ group, transaction, type: transactionType, workId: work.workId, revision: work.revision, title: work.title,
        ...(input.catalogLinks?.find(link => link.workId === work.workId) ? { entityId: input.catalogLinks.find(link => link.workId === work.workId)!.entityId } : {}) });
      for (const p of work.publishers) {
        if (p.ownership.performance > 5000 || ((p.role !== 'E') && Object.values(p.ownership).some(v => v !== 0))) throw new Error('Publisher role/ownership shares are inconsistent.');
        const chain = work.publishers.filter(other => other.chain === p.chain);
        if (chain[0].role !== 'E' && chain[0].role !== 'PA') throw new Error('Each publisher chain must start with an original publisher or income participant.');
        lines.push(record(p.controlled ? 'SPU' : 'OPU', 183, [...prefix(transaction, ++sequence), n(20, 2, p.chain), [22, 9, p.id], [31, 45, p.name], [77, 2, p.role],
          [88, 11, p.ipi.padStart(11, '0')], [99, 14, p.agreementId ?? ''], [113, 3, p.societies.performance], n(116, 5, p.ownership.performance),
          [121, 3, p.societies.mechanical], n(124, 5, p.ownership.mechanical), [129, 3, p.societies.synchronization], n(132, 5, p.ownership.synchronization)]));
        p.territories.forEach((t, i) => {
          if (t.collection.performance > 5000) throw new Error('Publisher performance collection exceeds 50%.');
          lines.push(record(p.controlled ? 'SPT' : 'OPT', 58, [...prefix(transaction, ++sequence), [20, 9, p.id], n(35, 5, t.collection.performance), n(40, 5, t.collection.mechanical), n(45, 5, t.collection.synchronization), [50, 1, t.included ? 'I' : 'E'], [51, 4, t.code], n(56, 3, i + 1)]));
        });
      }
      for (const w of work.writers) {
        lines.push(record(w.controlled ? 'SWR' : 'OWR', 180, [...prefix(transaction, ++sequence), [20, 9, w.id], [29, 45, w.name], [74, 30, w.firstName ?? ''], [105, 2, w.role],
          [116, 11, w.ipi.padStart(11, '0')], [127, 3, w.societies.performance], n(130, 5, w.ownership.performance), [135, 3, w.societies.mechanical], n(138, 5, w.ownership.mechanical),
          [143, 3, w.societies.synchronization], n(146, 5, w.ownership.synchronization), [153, 1, w.workForHire ? 'Y' : 'N']]));
        w.territories.forEach((t, i) => lines.push(record(w.controlled ? 'SWT' : 'OWT', 52, [...prefix(transaction, ++sequence), [20, 9, w.id], n(29, 5, t.collection.performance), n(34, 5, t.collection.mechanical), n(39, 5, t.collection.synchronization), [44, 1, t.included ? 'I' : 'E'], [45, 4, t.code], n(50, 3, i + 1)])));
        for (const publisherId of w.publisherIds) {
          const publisher = work.publishers.find(p => p.id === publisherId);
          if (!publisher) throw new Error('Writer publisher link is unresolved.');
          lines.push(record('PWR', input.version === '2.2' ? 112 : 110, [...prefix(transaction, ++sequence), [20, 9, publisher.id], [29, 45, publisher.name], [74, 14, publisher.agreementId ?? ''], [102, 9, w.id], ...(input.version === '2.2' ? [n(111, 2, publisher.chain)] : [])]));
        }
      }
      for (const r of work.recordings ?? []) {
        if (input.version === '2.1' && [r.title, r.versionTitle, r.displayArtist, r.label, r.recordingId].some(Boolean)) throw new Error('Extended recording metadata requires CWR 2.2; no fields will be silently discarded.');
        lines.push(record('REC', input.version === '2.1' ? 266 : 540, [...prefix(transaction, ++sequence),
          [20, 8, r.releaseDate ?? ''], [88, 6, r.duration ?? ''], [99, 60, r.albumTitle ?? ''], [159, 60, r.albumLabel ?? ''],
          [219, 18, r.catalogNumber ?? ''], [237, 13, r.ean ?? ''], [250, 12, r.isrc ?? ''], [262, 1, r.format], [263, 1, r.technique], [264, 3, r.mediaType ?? ''],
          ...(input.version === '2.2' ? [[267, 60, r.title ?? ''], [327, 60, r.versionTitle ?? ''], [387, 60, r.displayArtist ?? ''], [447, 60, r.label ?? ''], [527, 14, r.recordingId ?? '']] as Field[] : []),
        ]));
      }
    });
    lines.push(record('GRT', 24, [n(4, 5, group), n(9, 8, works.length), n(17, 8, lines.length - groupStart + 1)]));
  }
  lines.push(record('TRL', 24, [n(4, 5, group), n(9, 8, input.works.length), n(17, 8, lines.length + 1)]));
  return { text: lines.join('\r\n') + '\r\n', filename: `CW${date.slice(2, 4)}${String(input.fileSequence).padStart(4, '0')}${input.sender.code}_${profile.code}.V${input.version.replace('.', '')}`, transactions, profileVersion: profile.version };
}

/** Recover immutable transaction identity from the transmitted artifact, without
 * re-exporting old manifests through a newer codec or revalidating receiver rules. */
export function recoverCwrTransactions(input: CwrBatchInput, text: string): CwrTransaction[] {
  const result: CwrTransaction[] = []; let group = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('GRH')) group = Number(line.slice(6, 11));
    if (!['NWR', 'REV'].includes(line.slice(0, 3))) continue;
    const workId = line.slice(81, 95).trim(), type = line.slice(0, 3) as 'NWR' | 'REV';
    const work = input.works.find(item => item.workId === workId);
    if (!group || !work || work.transaction !== type || work.title !== line.slice(19, 79).trim() || !/^\d{8}$/.test(line.slice(3, 11))) throw new Error('Stored artifact does not match its manifest transaction identity.');
    result.push({ group, transaction: Number(line.slice(3, 11)), type, workId, title: work.title, revision: work.revision,
      ...(input.catalogLinks?.find(link => link.workId === workId) ? { entityId: input.catalogLinks.find(link => link.workId === workId)!.entityId } : {}) });
  }
  if (result.length !== input.works.length || new Set(result.map(item => item.workId)).size !== input.works.length) throw new Error('Stored transaction manifest is incomplete.');
  return result;
}

export interface CwrAcknowledgment { title?: string; originalDate: string; originalTime: string; group: number; transaction: number; type: string; workId: string; recipientWorkId: string; processingDate: string; status: string; messages: string[] }
export function parseCwrAcknowledgments(text: string): { sender: string; version: string; acknowledgments: CwrAcknowledgment[] } {
  if (text.length > 20_000_000 || /[^\x20-\x7e\r\n]/.test(text)) throw new Error('ACK file size or encoding is unsupported.');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines[0]?.startsWith('HDR') || !lines.at(-1)?.startsWith('TRL')) throw new Error('ACK requires a complete CWR envelope.');
  if (lines[0].length < 86 || lines[0].slice(3, 5) !== 'SO' || !/^\d{9}$/.test(lines[0].slice(5, 14)) || lines[0].slice(59, 64) !== '01.10') throw new Error('ACK header is malformed.');
  let groupStart = -1, groupCount = 0, transactionCount = 0, groupTransactions = 0;
  let version = ''; let groupId = ''; const identities = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (line.startsWith('HDR') && index !== 0 || line.startsWith('TRL') && index !== lines.length - 1) throw new Error('Duplicate CWR envelope record.');
    if (line.startsWith('GRH')) { if (groupStart !== -1) throw new Error('ACK group was not closed.'); if (line.slice(3, 6) !== 'ACK' || !/^\d{5}$/.test(line.slice(6, 11)) || !['02.10', '02.20'].includes(line.slice(11, 16))) throw new Error('Malformed ACK group header.');
      if (version && version !== line.slice(11, 16)) throw new Error('Mixed ACK versions require review.');
      version = line.slice(11, 16); groupId = line.slice(6, 11);
      if (Number(groupId) !== groupCount + 1) throw new Error('ACK group sequence is inconsistent.'); groupStart = index; groupCount++; groupTransactions = 0; }
    if (line.startsWith('ACK')) { if (groupStart < 0) throw new Error('ACK is outside a group.'); transactionCount++; groupTransactions++; }
    if (line.startsWith('GRT')) {
      if (line.slice(3, 8) !== groupId || groupStart < 0 || Number(line.slice(8, 16)) !== groupTransactions || Number(line.slice(16, 24)) !== index - groupStart + 1) throw new Error('ACK group control counts disagree.');
      groupStart = -1;
    }
  }
  const trailer = lines.at(-1)!;
  if (groupStart !== -1 || Number(trailer.slice(3, 8)) !== groupCount || Number(trailer.slice(8, 16)) !== transactionCount || Number(trailer.slice(16, 24)) !== lines.length) throw new Error('ACK transmission control counts disagree.');
  const sender = lines[0].slice(5, 14).trim();
  const acknowledgments: CwrAcknowledgment[] = [];
  let current: CwrAcknowledgment | undefined;
  let responseTransaction = ''; let responseSequence = -1; let expectedResponseTransaction = 0;
  const echoed = new Set(['AGR', 'NWR', 'REV', 'EXC', 'SPU', 'OPU', 'SPT', 'OPT', 'SWR', 'OWR', 'SWT', 'OWT', 'PWR', 'ALT', 'PER', 'REC', 'ORN', 'COM', 'EWT', 'VER', 'ARI', 'XRF', 'NPN', 'NCT', 'NPR', 'NOW']);
  for (const line of lines) {
    if (line.startsWith('GRH') || line.startsWith('GRT')) { current = undefined; responseTransaction = ''; responseSequence = -1; expectedResponseTransaction = 0; }
    if (line.startsWith('ACK')) {
      if (line.length < 159 || !/^\d{8}\d{6}\d{5}\d{8}$/.test(line.slice(19, 46))) throw new Error('Malformed ACK transaction.');
      responseTransaction = line.slice(3, 11); responseSequence = Number(line.slice(11, 19));
      if (!/^\d{16}$/.test(line.slice(3, 19))) throw new Error('Malformed ACK record prefix.');
      current = { title: line.slice(49, 109).trim(), originalDate: line.slice(19, 27), originalTime: line.slice(27, 33), group: Number(line.slice(33, 38)), transaction: Number(line.slice(38, 46)), type: line.slice(46, 49), workId: line.slice(109, 129).trim(), recipientWorkId: line.slice(129, 149).trim(), processingDate: line.slice(149, 157), status: line.slice(157, 159), messages: [] };
      if (!['NWR', 'REV', 'HDR', 'TRL', 'GRH', 'GRT'].includes(current.type) || !cwrDate.safeParse(current.processingDate).success || !cwrDate.safeParse(current.originalDate).success || !/^([01]\d|2[0-3])[0-5]\d[0-5]\d$/.test(current.originalTime) || !/^[A-Z]{2}$/.test(current.status)) throw new Error('Malformed ACK identity or processing status.');
      if (['NWR', 'REV'].includes(current.type) && (!current.workId || !current.title)) throw new Error('Work ACK is missing its original title or submitter identity.');
      const identity = `${current.group}_${current.transaction}${['HDR', 'TRL', 'GRH', 'GRT'].includes(current.type) ? `_${current.type}` : ''}`;
      if (identities.has(identity)) throw new Error('Duplicate ACK transaction identity requires review.');
      identities.add(identity);
      if (Number(responseTransaction) !== expectedResponseTransaction++) throw new Error('ACK response transaction sequence is inconsistent.');
      acknowledgments.push(current);
    } else if (line.startsWith('MSG')) {
      if (!current || line.length < 185) throw new Error('MSG is truncated or has no ACK transaction.');
      if (line.slice(3, 11) !== responseTransaction || !/^\d{8}$/.test(line.slice(11, 19)) || Number(line.slice(11, 19)) !== responseSequence + 1 || !/^[FRTGE]\d{8}[A-Z]{3}[EGTRF][A-Z0-9]{3}$/.test(line.slice(19, 35))) throw new Error('MSG prefix or message fields do not belong to the current ACK.');
      responseSequence++;
      current.messages.push(line.slice(19, 35).trim() + ': ' + line.slice(35, 185).trim());
    } else if (echoed.has(line.slice(0, 3))) {
      if (!current || line.slice(3, 11) !== responseTransaction || !/^\d{8}$/.test(line.slice(11, 19)) || Number(line.slice(11, 19)) !== responseSequence + 1) throw new Error('Echoed record is outside its ACK transaction.');
      responseSequence++;
    } else if (!['HDR', 'GRH', 'GRT', 'TRL'].includes(line.slice(0, 3))) throw new Error('Unsupported response record requires manual review.');
  }
  if (!acknowledgments.length) throw new Error('No ACK transactions found.');
  return { sender, version, acknowledgments };
}
