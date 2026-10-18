import { describe, expect, it } from 'vitest';
import {
  acceptHumanInput,
  canonicalRightsJson,
  filingStateForEvidence,
  RightsCase,
  RightsEvidence,
  RightsSessionFence,
  SessionInput,
  validateCopyrightCase,
} from './contracts';

describe('contracts - Rights and Copyright Validation', () => {
  const authorParty = {
    entityId: 'party-author-1',
    legalName: 'Alice Walker',
    address: '123 Main St, New York, NY 10001',
    citizenshipOrDomicile: 'United States',
  };

  const claimantParty = {
    entityId: 'party-claimant-1',
    legalName: 'Indii Publishing LLC',
    address: '456 Broadway, New York, NY 10013',
    citizenshipOrDomicile: 'United States',
  };

  const depositSample = {
    bucket: 'indii-deposits-prod',
    path: 'rights/deposit-001.wav',
    generation: '1234567890',
    sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    filename: 'track_master.wav',
    mimeType: 'audio/wav' as const,
    byteSize: 35_000_000,
  };

  const baseStandardCase: RightsCase = {
    schemaVersion: 2,
    caseId: 'case-std-001',
    revision: 1,
    applicationKind: 'standard',
    claimScope: 'composition',
    parties: [authorParty],
    works: [
      {
        entityId: 'work-comp-001',
        trackIds: ['track-001'],
        kind: 'musical_work',
        title: 'Dawn Anthem',
        authorIds: ['party-author-1'],
        claimantIds: ['party-author-1'],
        yearOfCreation: 2025,
        workForHire: false,
        publication: { status: 'unpublished' },
        exclusions: [],
        deposit: depositSample,
      },
    ],
    certifierPartyId: 'party-author-1',
    authority: 'author',
  };

  describe('validateCopyrightCase', () => {
    it('validates a standard unpublished composition claim', () => {
      const errors = validateCopyrightCase(baseStandardCase);
      expect(errors).toEqual([]);
    });

    it('validates a combined standard claim with one composition and one sound recording sharing claimants', () => {
      const combinedCase: RightsCase = {
        ...baseStandardCase,
        claimScope: 'combined',
        works: [
          {
            ...baseStandardCase.works[0],
            kind: 'musical_work',
          },
          {
            entityId: 'work-rec-001',
            embodiedWorkId: 'work-comp-001',
            trackIds: ['track-001'],
            kind: 'sound_recording',
            title: 'Dawn Anthem (Master)',
            authorIds: ['party-author-1'],
            claimantIds: ['party-author-1'],
            yearOfCreation: 2025,
            workForHire: false,
            publication: { status: 'unpublished' },
            exclusions: [],
            deposit: depositSample,
          },
        ],
      };

      const errors = validateCopyrightCase(combinedCase);
      expect(errors).toEqual([]);
    });

    it('rejects unrelated recordings and duplicate GRUW pairing', () => {
      const composition = baseStandardCase.works[0];
      const recording = { ...composition, entityId: 'rec-1', kind: 'sound_recording' as const, embodiedWorkId: composition.entityId, trackIds: ['other-track'] };
      expect(validateCopyrightCase({ ...baseStandardCase, claimScope: 'combined', works: [composition, recording] })).toContain('A combined standard claim needs one composition and its recording with the same claimants.');
      const other = { ...composition, entityId: 'comp-2' };
      expect(validateCopyrightCase({ ...baseStandardCase, applicationKind: 'gruw', claimScope: 'combined', works: [composition, other, { ...recording, trackIds: composition.trackIds }, { ...recording, entityId: 'rec-2', trackIds: composition.trackIds }] })).toContain('Combined GRUW requires explicit corresponding composition/recording links.');
    });

    it('rejects mismatched claim scopes and impossible publication dates', () => {
      expect(validateCopyrightCase({ ...baseStandardCase, applicationKind: 'gruw', claimScope: 'recording', works: [baseStandardCase.works[0], { ...baseStandardCase.works[0], entityId: 'second' }] })).toContain('Every work must match the selected claim scope.');
      const work = { ...baseStandardCase.works[0], publication: { status: 'published' as const, date: '2099-01-01', country: 'Canada' } };
      expect(validateCopyrightCase({ ...baseStandardCase, works: [work] })).toContain('Dawn Anthem: publication dates cannot be in the future.');
    });

    it('does not grant author or claimant authority merely because a party is in the directory', () => {
      const value = { ...baseStandardCase, parties: [authorParty, claimantParty], certifierPartyId: claimantParty.entityId };
      expect(validateCopyrightCase(value)).toContain('The certifying author must be an author of every claimed work, or document agency authority.');
      expect(validateCopyrightCase({ ...value, authority: 'claimant' })).toContain('The certifying claimant must be a claimant for every claimed work, or document agency authority.');
    });

    it('requires transfer basis when claimant is not an author', () => {
      const transferredCase: RightsCase = {
        ...baseStandardCase,
        parties: [authorParty, claimantParty],
        works: [
          {
            ...baseStandardCase.works[0],
            claimantIds: ['party-claimant-1'],
            // transferBasis missing
          },
        ],
        certifierPartyId: 'party-claimant-1',
        authority: 'claimant',
      };

      const errors = validateCopyrightCase(transferredCase);
      expect(errors).toContain('Dawn Anthem: claimant transfer basis is required.');

      const fixedCase: RightsCase = {
        ...transferredCase,
        works: [
          {
            ...transferredCase.works[0],
            transferBasis: 'Written assignment dated 2025-01-15',
          },
        ],
      };
      expect(validateCopyrightCase(fixedCase)).toEqual([]);
    });

    it('rejects duplicated party IDs and future creation year', () => {
      const invalidCase: RightsCase = {
        ...baseStandardCase,
        parties: [authorParty, authorParty],
        works: [
          {
            ...baseStandardCase.works[0],
            yearOfCreation: 2099,
          },
        ],
      };

      const errors = validateCopyrightCase(invalidCase);
      expect(errors).toContain('Party identifiers must be unique.');
      expect(errors).toContain('Dawn Anthem: creation year is in the future.');
    });

    it('validates GRUW (Group of Unpublished Works) constraints', () => {
      const gruwCase: RightsCase = {
        ...baseStandardCase,
        applicationKind: 'gruw',
        claimScope: 'composition',
        works: [
          {
            ...baseStandardCase.works[0],
            entityId: 'work-1',
            title: 'Song 1',
          },
          {
            ...baseStandardCase.works[0],
            entityId: 'work-2',
            title: 'Song 2',
          },
        ],
      };

      expect(validateCopyrightCase(gruwCase)).toEqual([]);

      // Cannot have published works in GRUW
      const publishedGruw: RightsCase = {
        ...gruwCase,
        works: [
          gruwCase.works[0],
          {
            ...gruwCase.works[1],
            publication: {
              status: 'published',
              date: '2025-05-01',
              country: 'US',
            },
          },
        ],
      };
      expect(validateCopyrightCase(publishedGruw)).toContain('GRUW cannot include published works.');

      // Needs at least 2 works
      const singleWorkGruw: RightsCase = {
        ...gruwCase,
        works: [gruwCase.works[0]],
      };
      expect(validateCopyrightCase(singleWorkGruw)).toContain('GRUW requires 2–10 eligible unpublished works.');
    });

    it('validates GRAM (Group of Published Works on an Album) constraints', () => {
      const gramCase: RightsCase = {
        ...baseStandardCase,
        applicationKind: 'gram_composition',
        claimScope: 'composition',
        works: [
          {
            ...baseStandardCase.works[0],
            entityId: 'work-gram-1',
            title: 'Track 1',
            publication: {
              status: 'published',
              date: '2025-06-01',
              country: 'United States',
              albumId: 'album-001',
              albumTitle: 'Summer Album',
              albumDate: '2025-06-01',
              trackNumber: 1,
            },
          },
          {
            ...baseStandardCase.works[0],
            entityId: 'work-gram-2',
            title: 'Track 2',
            publication: {
              status: 'published',
              date: '2025-06-01',
              country: 'United States',
              albumId: 'album-001',
              albumTitle: 'Summer Album',
              albumDate: '2025-06-01',
              trackNumber: 2,
            },
          },
        ],
      };

      expect(validateCopyrightCase(gramCase)).toEqual([]);

      // Mismatched album details fails
      const mismatchedGram: RightsCase = {
        ...gramCase,
        works: [
          gramCase.works[0],
          {
            ...gramCase.works[1],
            publication: {
              status: 'published',
              date: '2025-06-01',
              albumId: 'album-002',
              albumTitle: 'Different Album',
              country: 'United States',
              albumDate: '2025-06-01',
              trackNumber: 2,
            },
          },
        ],
      };
      expect(validateCopyrightCase(mismatchedGram)).toContain(
        'GRAM works must belong to the same published album and country with track numbers.',
      );
    });
  });

  describe('filingStateForEvidence', () => {
    const baseEvidence: RightsEvidence = {
      evidenceId: 'ev-001',
      kind: 'submission_receipt',
      externalId: 'USCO-REC-9921',
      observedAt: '2026-10-12T14:30:00.000Z',
    };

    it('maps untrusted source or user report to outcome_unknown', () => {
      expect(filingStateForEvidence(baseEvidence, false)).toBe('outcome_unknown');
      expect(filingStateForEvidence({ ...baseEvidence, kind: 'user_report' }, true)).toBe('outcome_unknown');
    });

    it('maps trusted evidence kinds accurately', () => {
      expect(filingStateForEvidence({ ...baseEvidence, kind: 'registration_certificate' }, true)).toBe('registered');
      expect(filingStateForEvidence({ ...baseEvidence, kind: 'society_ack' }, true)).toBe('accepted');
      expect(filingStateForEvidence({ ...baseEvidence, kind: 'submission_receipt' }, true)).toBe('submitted');
    });
  });

  describe('acceptHumanInput', () => {
    const fence: RightsSessionFence = {
      sessionId: 'session-xyz',
      control: 'human',
      controlGeneration: 3,
      navigationGeneration: 2,
      viewportVersion: 1,
      lastSequence: 10,
    };

    const validPointerInput: SessionInput = {
      sessionId: 'session-xyz',
      controlGeneration: 3,
      navigationGeneration: 2,
      viewportVersion: 1,
      sequence: 11,
      event: {
        type: 'pointer',
        x: 0.5,
        y: 0.5,
        action: 'down',
        button: 'left',
      },
    };

    it('accepts sequential human input matching the session fence', () => {
      expect(acceptHumanInput(fence, validPointerInput)).toBe(true);
    });

    it('rejects input when control is agent or none', () => {
      expect(acceptHumanInput({ ...fence, control: 'agent' }, validPointerInput)).toBe(false);
      expect(acceptHumanInput({ ...fence, control: 'none' }, validPointerInput)).toBe(false);
    });

    it('rejects stale sequence or mismatched generations', () => {
      expect(acceptHumanInput(fence, { ...validPointerInput, sequence: 10 })).toBe(false);
      expect(acceptHumanInput(fence, { ...validPointerInput, controlGeneration: 2 })).toBe(false);
      expect(acceptHumanInput(fence, { ...validPointerInput, sessionId: 'other-session' })).toBe(false);
    });
  });

  describe('canonicalRightsJson', () => {
    it('produces deterministic key-sorted JSON strings', () => {
      const objA = { b: 2, a: 1, c: { z: 9, y: 8 } };
      const objB = { a: 1, c: { y: 8, z: 9 }, b: 2 };
      expect(canonicalRightsJson(objA)).toBe(canonicalRightsJson(objB));
      expect(canonicalRightsJson(objA)).toBe('{"a":1,"b":2,"c":{"y":8,"z":9}}');
    });

    it('omits undefined fields cleanly', () => {
      const withUndefined = { a: 1, b: undefined, c: 3 };
      expect(canonicalRightsJson(withUndefined)).toBe('{"a":1,"c":3}');
    });
  });
});
