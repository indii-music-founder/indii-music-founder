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

/**
 * Low-level RDR-RCC 1.0 TSV primitives only. This does not validate a complete
 * DDEX message, map external identifiers to canonical entities, assert rights,
 * or authorize storage, signing, or transmission.
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
