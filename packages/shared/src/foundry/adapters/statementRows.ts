import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { QuarantinedRow } from '../types.js';

export const hashText = (value: string): string => bytesToHex(sha256(utf8ToBytes(value)));

export interface StatementRow {
  values: string[];
  lineIndex: number;
  rawContent: string;
}

/** RFC 4180 quoting for CSV and equivalent quoted TSV fields. */
export function parseDelimitedRows(content: string, delimiter: ',' | '\t'): { rows: StatementRow[]; errors: QuarantinedRow[] } {
  const input = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const rows: StatementRow[] = [];
  const errors: QuarantinedRow[] = [];
  let values: string[] = [];
  let value = '';
  let quoted = false;
  let afterQuote = false;
  let malformed = false;
  let line = 1;
  let startLine = 1;
  let startOffset = 0;

  const finish = (offset: number, nextOffset: number): void => {
    values.push(value);
    const rawContent = input.slice(startOffset, offset);
    if (rawContent.trim()) {
      if (quoted || malformed) errors.push({ lineIndex: startLine, rawContent, reason: 'Malformed quoted field', errorCode: 'ERR_MALFORMED_QUOTE', severity: 'warning' });
      else rows.push({ values, lineIndex: startLine, rawContent });
    }
    values = [];
    value = '';
    quoted = false;
    afterQuote = false;
    malformed = false;
    startOffset = nextOffset;
    startLine = line + 1;
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else { value += char; if (char === '\n') line++; }
      continue;
    }
    if (char === '"') {
      if (value === '' && !afterQuote) quoted = true;
      else malformed = true;
    } else if (char === delimiter) {
      values.push(value); value = ''; afterQuote = false;
    } else if (char === '\n' || char === '\r') {
      const end = i;
      if (char === '\r' && input[i + 1] === '\n') i++;
      finish(end, i + 1);
      line++;
    } else if (afterQuote && char !== ' ' && char !== '\t') {
      malformed = true;
    } else if (!afterQuote) value += char;
  }
  if (startOffset < input.length || quoted || values.length) finish(input.length, input.length);
  return { rows, errors };
}

export function rowIdentity(fields: Record<string, string>, occurrences: Map<string, number>): { sourceHash: string; transactionId: string } {
  const canonical = Object.entries(fields).map(([key, value]) => [key.trim().toLowerCase(), value.trim()]).sort(([a], [b]) => a.localeCompare(b));
  const baseHash = hashText(JSON.stringify(canonical));
  const occurrence = (occurrences.get(baseHash) ?? 0) + 1;
  occurrences.set(baseHash, occurrence);
  const sourceHash = hashText(`${baseHash}:${occurrence}`);
  return { sourceHash, transactionId: `TX-${sourceHash.slice(0, 40)}` };
}
