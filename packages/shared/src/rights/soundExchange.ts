import { z } from 'zod';

export const SoundExchangeRecordingSchema = z.object({
  recordingEntityId: z.string().min(1).max(160), isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
  recordingTitle: z.string().min(1).max(500), artistName: z.string().min(1).max(500),
  rightsOwnerName: z.string().min(1).max(500), ownershipUnits: z.number().int().min(1).max(10000),
  performerName: z.string().min(1).max(500), releaseDate: z.string().date(),
}).strict();
export const SoundExchangeTemplateSchema = z.object({
  profileId: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), reviewed: z.literal(true),
  sourceUrl: z.string().url().refine(url => new URL(url).protocol === 'https:' && (new URL(url).hostname === 'soundexchange.com' || new URL(url).hostname.endsWith('.soundexchange.com'))),
  claimType: z.enum(['rights_owner', 'performer']), delimiter: z.enum([',', '\t']),
  columns: z.array(z.object({ header: z.string().min(1).max(100), field: z.enum(['isrc', 'recordingTitle', 'artistName', 'rightsOwnerName', 'ownershipUnits', 'performerName', 'releaseDate']) }).strict()).min(1).max(50),
}).strict();
export function prepareSoundExchangeBulk(templateInput: unknown, recordingsInput: unknown): { text: string; claimType: 'rights_owner' | 'performer'; templateHash: string } {
  const template = SoundExchangeTemplateSchema.parse(templateInput);
  const recordings = z.array(SoundExchangeRecordingSchema).min(1).max(10000).parse(recordingsInput);
  if (new Set(template.columns.map(c => c.header)).size !== template.columns.length) throw new Error('Template contains duplicate columns.');
  if (template.claimType === 'performer' && template.columns.some(c => c.field === 'ownershipUnits' || c.field === 'rightsOwnerName')) throw new Error('Performer and master ownership claims must be separate.');
  const escape = (value: string) => {
    if (/^[=+@-]/.test(value)) throw new Error('Spreadsheet formula-like values require review.');
    return '"' + value.replace(/"/g, '""') + '"';
  };
  const rows = [template.columns.map(c => escape(c.header)).join(template.delimiter)];
  for (const recording of recordings) rows.push(template.columns.map(c => escape(c.field === 'ownershipUnits' ? (recording.ownershipUnits / 100).toFixed(2) : String(recording[c.field]))).join(template.delimiter));
  return { text: rows.join('\r\n') + '\r\n', claimType: template.claimType, templateHash: template.sha256 };
}
