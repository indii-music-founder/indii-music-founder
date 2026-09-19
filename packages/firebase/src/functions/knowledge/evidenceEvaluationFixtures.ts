import type { EvidenceEvaluationFixture } from './evidenceJudgment';

export const EVIDENCE_EVALUATION_FIXTURES: EvidenceEvaluationFixture[] = [
  {
    id: 'direct-distributor',
    family: 'direct-evidence',
    query: 'Which distributor does the artist use?',
    candidates: [
      { id: 'direct-1', documentId: 'artist-profile', text: 'Current distributor: TuneCore.', vectorScore: 0.94 },
      { id: 'direct-2', documentId: 'campaign-plan', text: 'The campaign uses Instagram and TikTok.', vectorScore: 0.41 },
      { id: 'direct-3', documentId: 'rights-notes', text: 'The master is owned by the artist.', vectorScore: 0.38 },
    ],
    expectedRelevantCandidateIds: ['direct-1'],
    answerable: true,
    topK: 1,
  },
  {
    id: 'lexical-master-rights',
    family: 'lexical-trap',
    query: 'Who controls the master recording rights for Neon Nights?',
    candidates: [
      { id: 'lexical-1', documentId: 'marketing', text: 'Neon Nights master campaign calendar and master social asset list.', vectorScore: 0.95 },
      { id: 'lexical-2', documentId: 'split-sheet', text: 'The artist retains 100% ownership of the sound recording master for Neon Nights.', vectorScore: 0.79 },
      { id: 'lexical-3', documentId: 'tour-notes', text: 'Neon Nights will be performed during the fall tour.', vectorScore: 0.64 },
    ],
    expectedRelevantCandidateIds: ['lexical-2'],
    answerable: true,
    topK: 1,
  },
  {
    id: 'paraphrase-delivery-readiness',
    family: 'paraphrase',
    query: 'Can we deliver this release yet?',
    candidates: [
      { id: 'paraphrase-1', documentId: 'logistics', text: 'Delivery truck arrival is scheduled for 3 PM.', vectorScore: 0.86 },
      { id: 'paraphrase-2', documentId: 'distribution-readiness', text: 'Storefront delivery authority is not verified because sender DPID credentials are missing.', vectorScore: 0.72 },
      { id: 'paraphrase-3', documentId: 'creative', text: 'Cover artwork passed the size check.', vectorScore: 0.55 },
    ],
    expectedRelevantCandidateIds: ['paraphrase-2'],
    answerable: true,
    topK: 1,
  },
  {
    id: 'no-answer-japan-mechanical-rate',
    family: 'no-answer',
    query: 'What mechanical royalty rate applies in Japan?',
    candidates: [
      { id: 'no-answer-1', documentId: 'us-royalties', text: 'This document describes U.S. mechanical royalty administration.', vectorScore: 0.84 },
      { id: 'no-answer-2', documentId: 'marketing', text: 'The release campaign targets Japan and the United States.', vectorScore: 0.73 },
      { id: 'no-answer-3', documentId: 'metadata', text: 'Territories include Worldwide.', vectorScore: 0.61 },
    ],
    expectedRelevantCandidateIds: [],
    answerable: false,
    topK: 1,
  },
  {
    id: 'conflicting-release-dates',
    family: 'conflicting-evidence',
    query: 'What is the release date?',
    candidates: [
      { id: 'conflict-1', documentId: 'old-plan', text: 'Initial release date: June 12, 2026.', vectorScore: 0.89 },
      { id: 'conflict-2', documentId: 'updated-plan', text: 'Updated release date: June 26, 2026.', vectorScore: 0.88 },
      { id: 'conflict-3', documentId: 'creative', text: 'Final cover art approved.', vectorScore: 0.44 },
    ],
    expectedRelevantCandidateIds: ['conflict-1', 'conflict-2'],
    answerable: true,
    topK: 2,
  },
  {
    id: 'multi-source-spotify-readiness',
    family: 'multi-source',
    query: 'Is this release ready to submit to Spotify?',
    candidates: [
      { id: 'multi-1', documentId: 'metadata-check', text: 'Required release metadata fields are complete.', vectorScore: 0.9 },
      { id: 'multi-2', documentId: 'authority-check', text: 'Sender DPID verification is missing, so storefront delivery is not authorized.', vectorScore: 0.82 },
      { id: 'multi-3', documentId: 'social-plan', text: 'Spotify pre-save promotion starts next week.', vectorScore: 0.78 },
    ],
    expectedRelevantCandidateIds: ['multi-1', 'multi-2'],
    answerable: true,
    topK: 2,
  },
];
