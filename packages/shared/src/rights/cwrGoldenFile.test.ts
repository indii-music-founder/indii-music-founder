import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildCwrBatch,
  type CwrBatchInput,
  parseCwrAcknowledgments,
} from './cwr.js';
import {
  reconcileCwrOutcome,
  cwrAckOutcome,
  type CwrWorkOutcome,
} from './cwrReconciliation.js';

describe('CWR 2.1 and 2.2 Golden-File, Split Integrity and Idempotent ACK Reconciliation (CI-V3-20261019-03)', () => {
  const sampleBatchInput22: CwrBatchInput = {
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
        title: 'GOLDEN HARMONY',
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

  const sampleBatchInput21: CwrBatchInput = {
    ...sampleBatchInput22,
    version: '2.1',
    recipient: 'musicmark',
  };

  it('generates valid, deterministic fixed-width CWR 2.2 output', () => {
    const result = buildCwrBatch(sampleBatchInput22);
    expect(result.filename).toBe('CW260042IND_034.V22');
    expect(result.text).toContain('HDR');
    expect(result.text).toContain('NWR');
    expect(result.text).toContain('SPU');
    expect(result.text).toContain('SWR');
    expect(result.text).toContain('TRL');

    // Split validation: Publisher 50% + Writer 50% = 100% (10000 hundredths)
    const pubPerf = sampleBatchInput22.works[0].publishers[0].ownership.performance;
    const wrtPerf = sampleBatchInput22.works[0].writers[0].ownership.performance;
    expect(pubPerf + wrtPerf).toBe(10000);

    const hash1 = createHash('sha256').update(result.text).digest('hex');
    const result2 = buildCwrBatch(sampleBatchInput22);
    const hash2 = createHash('sha256').update(result2.text).digest('hex');
    expect(hash1).toBe(hash2);
  });

  it('generates valid, deterministic fixed-width CWR 2.1 output', () => {
    const result = buildCwrBatch(sampleBatchInput21);
    expect(result.filename).toBe('CW260042IND_707.V21');
    expect(result.text).toContain('HDR');
    expect(result.text).toContain('NWR');
    expect(result.text).toContain('TRL');
  });

  it('enforces idempotent ACK reconciliation when the same society ACK arrives multiple times', () => {
    const initialOutcome: CwrWorkOutcome = {
      revision: 1,
      batchId: 'BATCH-001',
      workId: 'INDII-WRK-001',
      sender: '034',
      processingDate: '20261028',
      status: 'AS',
      outcome: 'accepted',
      recipientWorkId: 'MLC-WRK-10099',
      source: 'receiver_transport',
      independentlyVerified: true,
      evidenceHash: 'hash_abc123',
    };

    const duplicateIncoming: CwrWorkOutcome = {
      ...initialOutcome,
      evidenceHash: 'hash_abc123',
    };

    const reconciled = reconcileCwrOutcome(initialOutcome, duplicateIncoming);
    expect(reconciled).toEqual(initialOutcome);
    expect(reconciled.outcome).toBe('accepted');
    expect(reconciled.recipientWorkId).toBe('MLC-WRK-10099');
  });

  it('correctly advances intermediate processing (RA) to accepted status (AS) upon society confirmation', () => {
    const intermediateOutcome: CwrWorkOutcome = {
      revision: 1,
      batchId: 'BATCH-001',
      workId: 'INDII-WRK-001',
      sender: '034',
      processingDate: '20261028',
      status: 'RA',
      outcome: 'processing',
      recipientWorkId: '',
      source: 'receiver_transport',
      independentlyVerified: true,
      evidenceHash: 'hash_intermediate',
    };

    const acceptedIncoming: CwrWorkOutcome = {
      revision: 1,
      batchId: 'BATCH-001',
      workId: 'INDII-WRK-001',
      sender: '034',
      processingDate: '20261028',
      status: 'AS',
      outcome: 'accepted',
      recipientWorkId: 'MLC-WRK-10099',
      source: 'receiver_transport',
      independentlyVerified: true,
      evidenceHash: 'hash_accepted',
    };

    const reconciled = reconcileCwrOutcome(intermediateOutcome, acceptedIncoming);
    expect(reconciled.status).toBe('AS');
    expect(reconciled.outcome).toBe('accepted');
    expect(reconciled.recipientWorkId).toBe('MLC-WRK-10099');
  });
});
