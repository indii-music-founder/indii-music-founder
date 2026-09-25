import { z } from 'zod';
import { getCurrentDDEXStandard } from './ddexStandardsRegistry.js';

/**
 * A text cell is a single value. An array explicitly represents a DDEX
 * multi-value cell; its values are joined with the unescaped pipe delimiter.
 */
export const RdrRccCellSchema = z.union([
  z.string(),
  z.array(z.string()).min(2),
]);
export type RdrRccCell = z.infer<typeof RdrRccCellSchema>;

export type RdrRccMessage = {
  kind: 'RightsClaimConflictNotification' | 'RightsClaimConflictResponse';
  header: string[];
  records: string[][];
  commentRecords: string[];
};

/**
 * RDR-RCC 1.0 TSV framing and positional message structure only. This does not
 * validate full DDEX profile semantics or AVS membership, map external
 * identifiers to canonical entities, assert rights, or authorize I/O.
 */
export function serializeRdrRccRecordCells(cells: readonly RdrRccCell[]): string {
  const standard = getCurrentDDEXStandard('RDR_RCC');
  if (!standard || standard.version !== '1.0' || standard.serialization !== 'TSV') {
    throw new Error('The current RDR-RCC 1.0 TSV profile is unavailable.');
  }
  if (cells.length === 0) {
    throw new Error('An RDR-RCC record must contain its record-type cell.');
  }

  return cells.map((cell) => {
    const parsed = RdrRccCellSchema.parse(cell);
    return Array.isArray(parsed)
      ? parsed.map(escapeRdrRccText).join('|')
      : escapeRdrRccText(parsed);
  }).join('\t');
}

/**
 * Split one wire-format RDR-RCC record into cells without decoding or
 * interpreting their values. Escapes remain intact so downstream code must
 * apply field-specific DDEX semantics before any canonical mapping.
 */
export function splitRdrRccRecordCells(record: string): string[] {
  if (record.includes('\n') || record.includes('\r')) {
    throw new Error('Pass exactly one RDR-RCC record without its line ending.');
  }

  const cells: string[] = [];
  let cell = '';
  let slashRun = 0;

  for (const character of record) {
    if (character === '\\') {
      slashRun += 1;
      cell += character;
      continue;
    }

    if (character === '\t') {
      if (slashRun % 4 === 1) {
        // One escape slash (plus any encoded literal backslashes) quotes TAB.
        cell += character;
      } else if (slashRun % 4 === 0) {
        cells.push(cell);
        cell = '';
      } else {
        throw new Error('Invalid RDR-RCC escape sequence before TAB.');
      }
      slashRun = 0;
      continue;
    }

    if (character === '|') {
      if (slashRun % 4 !== 0 && slashRun % 4 !== 2) {
        throw new Error('Invalid RDR-RCC escape sequence before pipe.');
      }
      cell += character;
      slashRun = 0;
      continue;
    }

    if (slashRun % 4 !== 0) {
      throw new Error('Invalid RDR-RCC escape sequence in cell.');
    }
    cell += character;
    slashRun = 0;
  }

  if (slashRun % 4 !== 0) {
    throw new Error('Invalid trailing RDR-RCC escape sequence.');
  }
  cells.push(cell);
  return cells;
}

/**
 * Validates the positional framing of a complete RDR-RCC 1.0 message. Values
 * remain wire strings: this does not validate AVS membership, decide a
 * response, map an external identifier to an indii entity, or authorize I/O.
 */
export function parseRdrRccMessage(message: string): RdrRccMessage {
  const lines = message.split(/\r?\n/);
  if (lines.some(line => line.length === 0)) {
    throw new Error('RDR-RCC messages cannot contain empty records in this profile.');
  }
  if (lines.some(line => line.includes('\r'))) {
    throw new Error('RDR-RCC messages must use LF or CRLF record delimiters.');
  }
  if (lines.length < 3) {
    throw new Error('An RDR-RCC message requires a header, at least one conflict record, and a footer.');
  }

  const header = splitRdrRccRecordCells(lines[0]!);
  const footer = splitRdrRccRecordCells(lines.at(-1)!);
  const commentRecords = lines.slice(1, -1).filter(line => line.startsWith('#'));
  const records = lines.slice(1, -1)
    .filter(line => !line.startsWith('#'))
    .map(splitRdrRccRecordCells);
  if (header[0] !== 'CHEA' || header.length !== 9 || header[1] !== '10') {
    throw new Error('RDR-RCC message header must be a nine-cell CHEA record with message version 10.');
  }
  if (footer[0] !== 'CFOO' || footer.length !== 3) {
    throw new Error('RDR-RCC message footer must be a three-cell CFOO record.');
  }

  const recordType = records[0]?.[0];
  if (recordType !== 'RTCR' && recordType !== 'RCRR') {
    throw new Error('RDR-RCC message records must be RTCR or RCRR records.');
  }
  if (records.some(record => record[0] !== recordType)) {
    throw new Error('RDR-RCC messages cannot mix RTCR and RCRR records.');
  }

  const recordIds = new Set<string>();
  for (const record of records) {
    validateRdrRccBodyRecord(record, recordType);
    const recordId = record[1];
    if (!recordId || recordIds.has(recordId)) {
      throw new Error('RDR-RCC conflict record IDs must be present and unique within a message.');
    }
    recordIds.add(recordId);
  }

  const conflictCount = parseRdrRccCount(footer[1], 'NumberOfConflicts');
  const lineCount = parseRdrRccCount(footer[2], 'NumberOfLines');
  if (conflictCount !== records.length || lineCount !== lines.length) {
    throw new Error('RDR-RCC CFOO counts must match the conflict records and physical message lines.');
  }

  return {
    kind: recordType === 'RTCR' ? 'RightsClaimConflictNotification' : 'RightsClaimConflictResponse',
    header,
    records,
    commentRecords,
  };
}

/** Serializes caller-supplied wire records and derives only the mechanical CFOO counts. */
export function serializeRdrRccMessage(
  header: readonly RdrRccCell[],
  records: readonly (readonly RdrRccCell[])[],
): string {
  if (records.length === 0) {
    throw new Error('RDR-RCC messages require at least one conflict record.');
  }
  const serializedRecords = records.map(record => serializeRdrRccRecordCells(record));
  const serializedHeader = serializeRdrRccRecordCells(header);
  const footer = serializeRdrRccRecordCells([
    'CFOO',
    String(records.length),
    String(records.length + 2),
  ]);
  const message = [serializedHeader, ...serializedRecords, footer].join('\n');
  parseRdrRccMessage(message);
  return message;
}

function validateRdrRccBodyRecord(record: string[], type: 'RTCR' | 'RCRR'): void {
  if (record.length < 2) throw new Error(`RDR-RCC ${type} record is missing its RecordId.`);
  if (type === 'RCRR') {
    if (record.length !== 21) {
      throw new Error('RDR-RCC RCRR records must contain exactly 21 cells.');
    }
    return;
  }

  if (record.length < 26) {
    throw new Error('RDR-RCC RTCR records require the fixed fields and at least one party group.');
  }
  const partyCount = parseRdrRccCount(record[15], 'NumberOfConflictingParties');
  const expectedCellCount = 19 + partyCount * 7;
  if (record.length !== expectedCellCount) {
    throw new Error(`RDR-RCC RTCR cell count does not match NumberOfConflictingParties (expected ${expectedCellCount}).`);
  }
}

function parseRdrRccCount(value: string | undefined, field: string): number {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`RDR-RCC ${field} must be a non-negative whole-number cell.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`RDR-RCC ${field} exceeds the supported integer range.`);
  return parsed;
}

function escapeRdrRccText(value: string): string {
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error('RDR-RCC cell values cannot contain record delimiters.');
  }

  let encoded = '';
  for (const character of value) {
    if (character === '\\') encoded += '\\\\\\\\';
    else if (character === '|') encoded += '\\\\|';
    else if (character === '\t') encoded += '\\\t';
    else encoded += character;
  }
  return encoded;
}
