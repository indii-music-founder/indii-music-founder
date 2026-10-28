import { describe, expect, it } from 'vitest';
import {
  canApproveCwrExport,
  transitionCwrLifecycleState,
  type CwrTransitionEvidence,
} from './cwrLifecycle.js';

describe('CWR Lifecycle State Transitions & Evidence Verification (CI-V3-20261019-03)', () => {
  const dummySha256 = 'a'.repeat(64);
  const nowIso = new Date().toISOString();

  const validEvidence: CwrTransitionEvidence = {
    exportEvidence: {
      filename: 'CW260042IND_034.V22',
      fileChecksum: dummySha256,
      byteLength: 1024,
      exportedAt: nowIso,
    },
    submissionEvidence: {
      transportManifestDigest: 'manifest_digest_12345678',
      receiverRoute: 'the_mlc',
      submittedAt: nowIso,
    },
    ackEvidence: {
      ackEvidenceHash: dummySha256,
      parsedAckCount: 5,
      receiverSenderCode: '034',
      acknowledgedAt: nowIso,
    },
    registrationEvidence: {
      societyWorkId: 'MLC-WRK-987654',
      societyName: 'The MLC',
      registrationToken: 'mlc_reg_token_abcdef123456',
      registeredAt: nowIso,
    },
  };

  it('allows full linear progression through prepared -> exported -> submitted -> acknowledged -> registered', () => {
    let state = transitionCwrLifecycleState('prepared', 'exported', validEvidence);
    expect(state).toBe('exported');

    state = transitionCwrLifecycleState(state, 'submitted', validEvidence);
    expect(state).toBe('submitted');

    state = transitionCwrLifecycleState(state, 'acknowledged', validEvidence);
    expect(state).toBe('acknowledged');

    state = transitionCwrLifecycleState(state, 'registered', validEvidence);
    expect(state).toBe('registered');
  });

  it('is idempotent when transitioning to the current state', () => {
    const state = transitionCwrLifecycleState('submitted', 'submitted', validEvidence);
    expect(state).toBe('submitted');
  });

  it('blocks skipped lifecycle transitions (e.g. prepared directly to registered)', () => {
    expect(() => {
      transitionCwrLifecycleState('prepared', 'registered', validEvidence);
    }).toThrow('Illegal skipped lifecycle transition');
  });

  it('blocks skipped transitions from exported directly to registered', () => {
    expect(() => {
      transitionCwrLifecycleState('exported', 'registered', validEvidence);
    }).toThrow('Illegal skipped lifecycle transition');
  });

  it('blocks backward transitions (e.g. acknowledged back to prepared)', () => {
    expect(() => {
      transitionCwrLifecycleState('acknowledged', 'prepared', validEvidence);
    }).toThrow('Illegal backward lifecycle transition');
  });

  it('requires confirmed societyWorkId before claiming registered status', () => {
    expect(() => {
      transitionCwrLifecycleState('acknowledged', 'registered', {
        registrationEvidence: {
          societyWorkId: '',
          societyName: 'The MLC',
          registrationToken: 'mlc_token_12345678',
          registeredAt: nowIso,
        },
      });
    }).toThrow();
  });

  it('enforces canApproveCwrExport boundary', () => {
    expect(canApproveCwrExport('exported')).toBe(true);
    expect(canApproveCwrExport('approved_export')).toBe(true);
    for (const state of ['delivery_claimed', 'transmitted', 'delivery_outcome_unknown', 'registered', 'assembling', undefined, 'unrecognized']) {
      expect(canApproveCwrExport(state)).toBe(false);
    }
  });
});
