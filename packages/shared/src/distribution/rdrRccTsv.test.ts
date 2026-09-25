import { describe, expect, it } from 'vitest';
import { serializeRdrRccRecordCells, splitRdrRccRecordCells } from './rdrRccTsv.js';

describe('RDR-RCC TSV cell framing', () => {
  it('escapes tabs, pipes, and backslashes in single-value cells', () => {
    expect(serializeRdrRccRecordCells(['RCRR', 'A\tB', 'A|B', 'A\\B']))
      .toBe('RCRR\tA\\\tB\tA\\\\|B\tA\\\\\\\\B');
  });

  it('keeps explicitly typed multi-value delimiters while escaping each value', () => {
    expect(serializeRdrRccRecordCells(['RTCR', ['party|one', 'party\\two']]))
      .toBe('RTCR\tparty\\\\|one|party\\\\\\\\two');
  });

  it('splits only unescaped tabs and preserves wire escapes verbatim', () => {
    expect(splitRdrRccRecordCells('RCRR\tA\\\tB\tX\\\\|Y'))
      .toEqual(['RCRR', 'A\\\tB', 'X\\\\|Y']);
  });

  it('preserves empty cells and rejects malformed delimiter escapes', () => {
    expect(splitRdrRccRecordCells('RCRR\t\tvalue')).toEqual(['RCRR', '', 'value']);
    expect(() => splitRdrRccRecordCells('RCRR\tbad\\x')).toThrow(/escape sequence/);
    expect(() => splitRdrRccRecordCells('RCRR\tbad\\\nrow')).toThrow(/exactly one/);
    expect(() => serializeRdrRccRecordCells(['RCRR', 'bad\nrow'])).toThrow(/record delimiters/);
  });

  it('requires an explicit record-type cell and does not infer a message or rights action', () => {
    expect(() => serializeRdrRccRecordCells([])).toThrow(/record-type cell/);
    expect(serializeRdrRccRecordCells(['RCRR', 'Maintain'])).toBe('RCRR\tMaintain');
  });
});
