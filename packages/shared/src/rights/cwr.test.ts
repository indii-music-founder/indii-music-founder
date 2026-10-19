import { describe, expect, it } from 'vitest';
import { societyPreparationCopy } from './societyPreparation.js';
import {
  buildCwrBatch,
  CwrBatchInput,
  parseCwrAcknowledgments, recoverCwrTransactions,
} from './cwr';

describe('cwr - Common Works Registration Batch and Ack Engine', () => {
  const sampleBatchInput: CwrBatchInput = {
    version: '2.2',
    recipient: 'the_mlc',
    sender: {
      name: 'INDII MUSIC PUBLISHING',
      ipi: '00123456789',
      code: 'IND',
    },
    fileSequence: 42,
    createdAt: '2026-10-12T14:30:00.000Z',
    works: [
      {
        workId: 'INDII-WRK-001',
        title: 'NEON MIDNIGHT',
        transaction: 'NWR',
        revision: 1,
        category: 'POP',
        recorded: true,
        duration: '000215',
        textMusic: 'MTX',
        publishers: [
          {
            id: 'PUB001',
            name: 'INDII MUSIC PUBLISHING',
            ipi: '00123456789',
            controlled: true,
            chain: 1,
            role: 'E',
            societies: {
              performance: '010',
              mechanical: '034',
              synchronization: '010',
            },
            ownership: {
              performance: 5000,
              mechanical: 5000,
              synchronization: 5000,
            },
            territories: [
              {
                code: '2136',
                included: true,
                collection: {
                  performance: 5000,
                  mechanical: 5000,
                  synchronization: 5000,
                },
              },
            ],
          },
        ],
        writers: [
          {
            id: 'WRT001',
            name: 'SMITH',
            firstName: 'JOHN',
            ipi: '00987654321',
            controlled: true,
            role: 'CA',
            societies: {
              performance: '010',
              mechanical: '034',
              synchronization: '010',
            },
            ownership: {
              performance: 5000,
              mechanical: 5000,
              synchronization: 5000,
            },
            territories: [
              {
                code: '2136',
                included: true,
                collection: {
                  performance: 5000,
                  mechanical: 5000,
                  synchronization: 5000,
                },
              },
            ],
            publisherIds: ['PUB001'],
            workForHire: false,
          },
        ],
      },
    ],
  };

  describe('buildCwrBatch', () => {
    it('restores an independent preparation copy while rejecting guessed composition identities', () => {
      const input = { ...sampleBatchInput, catalogLinks: [{ workId: sampleBatchInput.works[0].workId, entityId: 'composition:one' }] };
      const copy = societyPreparationCopy(input);
      expect(copy).toEqual(input);
      copy.works[0].writers[0].ownership.performance = 0;
      expect(input.works[0].writers[0].ownership.performance).toBe(5000);
      expect(() => societyPreparationCopy(sampleBatchInput)).toThrow('canonical composition linkage');
      expect(() => societyPreparationCopy({ ...input, catalogLinks: [{ workId: 'FOREIGN', entityId: 'composition:one' }] })).toThrow('canonical composition linkage');
    });
    it('keeps canonical composition linkage without changing fixed-width bytes', () => {
      const linked = { ...sampleBatchInput, catalogLinks: [{ entityId: 'composition:one', workId: sampleBatchInput.works[0].workId }] };
      expect(buildCwrBatch(linked).text).toBe(buildCwrBatch(sampleBatchInput).text);
      expect(() => buildCwrBatch({ ...linked, catalogLinks: [{ entityId: 'composition:one', workId: 'FOREIGN' }] })).toThrow('canonical catalog link');
      expect(() => buildCwrBatch({ ...linked, catalogLinks: [...linked.catalogLinks, ...linked.catalogLinks] })).toThrow('canonical catalog link');
    });

    it('generates fixed-width CWR records and control counts (structural only)', () => {
      const result = buildCwrBatch(sampleBatchInput);

      expect(result.filename).toBe('CW260042IND_034.V22');
      expect(result.profileVersion).toBe('mlc-2024-05');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toEqual({
        group: 1,
        transaction: 0,
        type: 'NWR',
        title: 'NEON MIDNIGHT',
        workId: 'INDII-WRK-001',
        revision: 1,
      });

      const lines = result.text.split('\r\n');
      expect(lines[0].startsWith('HDR')).toBe(true);
      expect(lines.some((l) => l.startsWith('GRH'))).toBe(true);
      expect(lines.some((l) => l.startsWith('NWR'))).toBe(true);
      expect(lines.some((l) => l.startsWith('SPU'))).toBe(true);
      expect(lines.some((l) => l.startsWith('SPT'))).toBe(true);
      expect(lines.some((l) => l.startsWith('SWR'))).toBe(true);
      expect(lines.some((l) => l.startsWith('SWT'))).toBe(true);
      expect(lines.some((l) => l.startsWith('PWR'))).toBe(true);
      expect(lines.some((l) => l.startsWith('GRT'))).toBe(true);
      expect(lines.some((l) => l.startsWith('TRL'))).toBe(true);
    });

    it('recovers identity from frozen bytes without re-exporting or guessing titles', () => {
      const built = buildCwrBatch(sampleBatchInput);
      expect(recoverCwrTransactions(sampleBatchInput, built.text)).toEqual(built.transactions);
      expect(() => recoverCwrTransactions(sampleBatchInput, built.text.replace('NEON MIDNIGHT', 'DIFFERENT    '))).toThrow('manifest transaction identity');
      expect(() => recoverCwrTransactions(sampleBatchInput, built.text.split('\r\n').filter(line => !line.startsWith('NWR')).join('\r\n'))).toThrow('incomplete');
    });
    it('requires actual recording metadata for SESAC preparation', () => {
      expect(() =>
        buildCwrBatch({
          ...sampleBatchInput,
          recipient: 'sesac',
        }),
      ).toThrow('SESAC preparation requires factual recording format');
    });

    it.each(['2.1', '2.2'] as const)('serializes REC offsets and count for %s without obsolete flags', version => {
      const input = structuredClone(sampleBatchInput);
      input.version = version; input.recipient = 'sesac';
      input.works[0].recordings = [{ format: 'A', technique: 'D', releaseDate: '20260101', duration: '000215', albumTitle: 'ALBUM', albumLabel: 'LABEL', catalogNumber: 'CAT1', ean: '1234567890123', isrc: 'USABC2600001', mediaType: 'CD', ...(version === '2.2' ? { title: 'TRACK', versionTitle: 'VERSION', displayArtist: 'ARTIST', label: 'RECORD LABEL', recordingId: 'REC1' } : {}) }];
      const result = buildCwrBatch(input), lines = result.text.trimEnd().split('\r\n');
      const rec = lines.find(line => line.startsWith('REC'))!;
      expect(rec).toHaveLength(version === '2.1' ? 266 : 540);
      expect(rec.slice(19, 27)).toBe('20260101'); expect(rec.slice(87, 93)).toBe('000215');
      expect(rec.slice(98, 158).trim()).toBe('ALBUM'); expect(rec.slice(158, 218).trim()).toBe('LABEL');
      expect(rec.slice(218, 236).trim()).toBe('CAT1'); expect(rec.slice(236, 249)).toBe('1234567890123');
      expect(rec.slice(249, 261)).toBe('USABC2600001'); expect(rec.slice(261, 266)).toBe('ADCD ');
      if (version === '2.2') { expect(rec.slice(266, 326).trim()).toBe('TRACK'); expect(rec.slice(526, 540).trim()).toBe('REC1'); }
      expect(Number(lines.at(-1)!.slice(16, 24))).toBe(lines.length);
      input.works[0].recordings[0].technique = 'U'; expect(() => buildCwrBatch(input)).toThrow('SESAC preparation');
    });

    it('throws when total shares do not sum to 10000 or 0', () => {
      const invalidSharesInput: CwrBatchInput = {
        ...sampleBatchInput,
        works: [
          {
            ...sampleBatchInput.works[0],
            writers: [
              {
                ...sampleBatchInput.works[0].writers[0],
                ownership: {
                  performance: 4000, // 5000 + 4000 = 9000 != 10000
                  mechanical: 5000,
                  synchronization: 5000,
                },
              },
            ],
          },
        ],
      };

      expect(() => buildCwrBatch(invalidSharesInput)).toThrow(
        'performance ownership must account for 10000 units',
      );
    });
  });

  describe('parseCwrAcknowledgments', () => {
    const ackPrefix = 'ACK' + '00000000' + '00000001';
    const ackDateGroup = '202610121430000000100000000';
    const ackType = 'NWR';
    const ackPadding = 'NEON MIDNIGHT'.padEnd(60, ' ');
    const ackWorkId = 'INDII-WRK-001'.padEnd(20, ' ');
    const ackRecipientId = 'MLC-WRK-998822'.padEnd(20, ' ');
    const ackProcDate = '20261012';
    const ackStatus = 'RA';
    const ackLine = ackPrefix + ackDateGroup + ackType + ackPadding + ackWorkId + ackRecipientId + ackProcDate + ackStatus;

    const msgPrefix = 'MSG' + '00000000' + '00000002';
    const msgCode = 'F00000001NWRF001';
    const msgText = 'Work registration accepted and indexed in musical works database'.padEnd(150, ' ');
    const msgLine = msgPrefix + msgCode + msgText;

    const validAckText = [
      'HDRSO000000034' + 'THE MLC'.padEnd(45, ' ') + '01.102026101214300020261012' + ' '.repeat(15),
      'GRHACK0000102.20' + ' '.repeat(12),
      ackLine,
      msgLine,
      'GRT000010000000100000004',
      'TRL000010000000100000006',
    ].join('\r\n') + '\r\n';

    it('parses valid CWR acknowledgment files with status and messages', () => {
      const parsed = parseCwrAcknowledgments(validAckText);
      expect(parsed.sender).toBe('000000034');
      expect(parsed.acknowledgments).toHaveLength(1);

      const ack = parsed.acknowledgments[0];
      expect(ack.workId).toBe('INDII-WRK-001');
      expect(ack.recipientWorkId).toBe('MLC-WRK-998822');
      expect(ack.status).toBe('RA');
      expect(ack.messages[0]).toContain('F00000001NWRF001: Work registration accepted');
    });

    it('rejects wrong group type, duplicate identities and unclosed counts', () => {
      expect(() => parseCwrAcknowledgments(validAckText.replace('GRHACK', 'GRHNWR'))).toThrow('group header');
      const duplicate = validAckText.replace(msgLine, ackLine).replace('GRT0000100000001', 'GRT0000100000002').replace('TRL0000100000001', 'TRL0000100000002');
      expect(() => parseCwrAcknowledgments(duplicate)).toThrow('Duplicate ACK');
      expect(() => parseCwrAcknowledgments(validAckText.replace('GRT00001', 'GRT00002'))).toThrow('control counts');
    });
    it('retains unknown status as reviewable evidence', () => {
      expect(parseCwrAcknowledgments(validAckText.replace(ackLine, ackLine.slice(0, -2) + 'ZZ')).acknowledgments[0].status).toBe('ZZ');
    });
    it('throws if file lacks HDR or TRL boundaries', () => {
      expect(() => parseCwrAcknowledgments('NOT_A_CWR_FILE')).toThrow(
        'ACK requires a complete CWR envelope.',
      );
    });
  });
});
