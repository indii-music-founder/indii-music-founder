import { describe, expect, it } from 'vitest';
import {
  parseRdrRccMessage,
  serializeRdrRccMessage,
  serializeRdrRccRecordCells,
  splitRdrRccRecordCells,
} from './rdrRccTsv.js';

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

describe('RDR-RCC message framing', () => {
  const header = ['CHEA', '10', '012', 'message-1', '2026-09-25T12:00:00Z', 'PADPIDA2008120501W', 'Sender', 'PADPIDA2007081601G', 'Recipient'];
  const response = [
    'RCRR', 'response-1', 'notification-1', 'conflict-1', '', 'licensor::resource-1', 'Title', '', 'Artist', '', '', '',
    'licensor::party-1', 'Party', '', '', 'Maintain', 'US', '2020-01-01', '', '50',
  ];

  it('round-trips a response message and derives only mechanical footer counts', () => {
    const serialized = serializeRdrRccMessage(header, [response]);
    const parsed = parseRdrRccMessage(serialized);

    expect(parsed.kind).toBe('RightsClaimConflictResponse');
    expect(parsed.header).toEqual(header);
    expect(parsed.records).toEqual([response]);
    expect(splitRdrRccRecordCells(serialized.split('\n').at(-1)!)).toEqual(['CFOO', '1', '3']);
  });

  it('checks RTCR party-group width from its declared count without interpreting party rights', () => {
    const notification = [
      'RTCR', 'conflict-1', 'SoundRecording', '', '', '', 'False', '', '', 'licensor::resource-1', 'Title', '', 'Artist', '', '',
      '1', 'US', '2020-01-01', '2026-09-25', '', 'licensor::party-1', 'Party', '', '', '', '50',
    ];
    expect(parseRdrRccMessage(serializeRdrRccMessage(header, [notification])).kind)
      .toBe('RightsClaimConflictNotification');
  });

  it('preserves ignored comment records and still checks the physical line count', () => {
    const serialized = serializeRdrRccMessage(header, [response]);
    const withComment = serialized.replace('\nRCRR\t', '\n# human-readable note\nRCRR\t')
      .replace('CFOO\t1\t3', 'CFOO\t1\t4');

    expect(parseRdrRccMessage(withComment).commentRecords).toEqual(['# human-readable note']);
    expect(() => parseRdrRccMessage(withComment.replace('CFOO\t1\t4', 'CFOO\t1\t3'))).toThrow(/counts/);
  });

  it('rejects invalid record positions, duplicate IDs, mixed message records, and false footer counts', () => {
    expect(() => serializeRdrRccMessage(['CHEA', '10'], [response])).toThrow(/header/);
    expect(() => serializeRdrRccMessage(header, [response, [...response]])).toThrow(/unique/);
    expect(() => serializeRdrRccMessage(header, [response, ['RTCR', ...response.slice(1)]])).toThrow(/mix/);

    const valid = serializeRdrRccMessage(header, [response]);
    expect(() => parseRdrRccMessage(valid.replace('CFOO\t1\t3', 'CFOO\t2\t3'))).toThrow(/counts/);
    expect(() => parseRdrRccMessage(`${valid}\n`)).toThrow(/empty records/);
  });
});
