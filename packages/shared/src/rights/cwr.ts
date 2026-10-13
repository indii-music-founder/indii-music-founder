import { z } from 'zod';

/** Layouts pinned to CISAC CWR19-1070, 2.2 rev2 (2.1 rev7 compatible fields).
 * Original titles/names stay in catalog; exports require explicit ASCII text.
 * Receiver acceptance and sender authority are separate from structural validity.
 */
export const CWR_SPEC = 'CWR19-1070:2.2R2';
const A = (max: number) => z.string().trim().min(1).max(max).regex(/^[\x20-\x7e]+$/);
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
export const CwrWorkSchema = z.object({ workId: A(14), title: A(60), transaction: z.enum(['NWR', 'REV']),
  revision: z.number().int().positive(), category: z.enum(['POP', 'JAZ', 'SER']), recorded: z.boolean(),
  duration: z.string().regex(/^\d{6}$/), textMusic: z.enum(['MUS', 'TXT', 'MTX']), iswc: z.string().regex(/^T\d{10}$/).optional(),
  writers: z.array(CwrWriterSchema).min(1).max(99), publishers: z.array(CwrPublisherSchema).min(1).max(99),
}).strict();
export const CwrBatchInputSchema = z.object({
  version: z.enum(['2.1', '2.2']), recipient: z.enum(['musicmark', 'the_mlc', 'sesac']),
  sender: z.object({ name: A(45), ipi: z.string().regex(/^\d{9,11}$/), code: z.string().regex(/^[A-Z0-9]{2,3}$/) }).strict(),
  fileSequence: z.number().int().min(1).max(9999), createdAt: z.string().datetime(),
  works: z.array(CwrWorkSchema).min(1).max(10000),
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

export function buildCwrBatch(raw: CwrBatchInput): { text: string; filename: string; transactions: Array<{ group: number; transaction: number; workId: string; revision: number }>; profileVersion: string } {
  const input = CwrBatchInputSchema.parse(raw);
  if (new Set(input.works.map(w => w.workId)).size !== input.works.length) throw new Error('Submitter work IDs must be unique.');
  if (input.recipient === 'sesac') throw new Error('SESAC export requires recording/performance fields and receiver validation; this profile is not enabled.');
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
  const transactions: Array<{ group: number; transaction: number; workId: string; revision: number }> = [];
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
      for (const p of parties) {
        if (!p.controlled && p.territories.length && input.version === '2.1') throw new Error('Non-controlled collection records require CWR 2.2.');
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
      let sequence = 0;
      lines.push(record(transactionType, 260, [...prefix(transaction, sequence), [20, 60, work.title], [82, 14, work.workId], [96, 11, work.iswc ?? ''],
        [127, 3, work.category], [130, 6, work.duration], [136, 1, work.recorded ? 'Y' : 'N'], [137, 3, work.textMusic], [143, 3, 'ORI']]));
      transactions.push({ group, transaction, workId: work.workId, revision: work.revision });
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
    });
    lines.push(record('GRT', 24, [n(4, 5, group), n(9, 8, works.length), n(17, 8, lines.length - groupStart + 1)]));
  }
  lines.push(record('TRL', 24, [n(4, 5, group), n(9, 8, input.works.length), n(17, 8, lines.length + 1)]));
  return { text: lines.join('\r\n') + '\r\n', filename: `CW${date.slice(2, 4)}${String(input.fileSequence).padStart(4, '0')}${input.sender.code}_${profile.code}.V${input.version.replace('.', '')}`, transactions, profileVersion: profile.version };
}

export interface CwrAcknowledgment { originalDate: string; originalTime: string; group: number; transaction: number; type: string; workId: string; recipientWorkId: string; processingDate: string; status: string; messages: string[] }
export function parseCwrAcknowledgments(text: string): { sender: string; acknowledgments: CwrAcknowledgment[] } {
  if (text.length > 20_000_000 || /[^\x20-\x7e\r\n]/.test(text)) throw new Error('ACK file size or encoding is unsupported.');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines[0]?.startsWith('HDR') || !lines.at(-1)?.startsWith('TRL')) throw new Error('ACK requires a complete CWR envelope.');
  const sender = lines[0].slice(5, 14).trim();
  const acknowledgments: CwrAcknowledgment[] = [];
  let current: CwrAcknowledgment | undefined;
  for (const line of lines) {
    if (line.startsWith('ACK')) {
      if (line.length < 159 || !/^\d{8}\d{6}\d{5}\d{8}$/.test(line.slice(19, 46))) throw new Error('Malformed ACK transaction.');
      current = { originalDate: line.slice(19, 27), originalTime: line.slice(27, 33), group: Number(line.slice(33, 38)), transaction: Number(line.slice(38, 46)), type: line.slice(46, 49), workId: line.slice(109, 129).trim(), recipientWorkId: line.slice(129, 149).trim(), processingDate: line.slice(149, 157), status: line.slice(157, 159), messages: [] };
      if (!['RA', 'AS', 'AC', 'RJ', 'DU', 'NP', 'CO', 'RC'].includes(current.status)) throw new Error('Unrecognized ACK status requires manual review.');
      acknowledgments.push(current);
    } else if (line.startsWith('MSG')) {
      if (!current || line.length < 185) throw new Error('MSG is truncated or has no ACK transaction.');
      current.messages.push(line.slice(19, 35).trim() + ': ' + line.slice(35, 185).trim());
    }
  }
  if (!acknowledgments.length) throw new Error('No ACK transactions found.');
  return { sender, acknowledgments };
}
