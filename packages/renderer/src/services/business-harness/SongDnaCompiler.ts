import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { AudioIntelligenceProfile } from '@/services/audio/types';
import type { HarnessCompiler, HarnessContext } from './HarnessCompiler';
import { createHarnessRun, type HarnessRun } from './types';
import { buildReleaseDna } from '../release-harness/ReleaseHarnessAdapters';
import type { ReleaseHarnessInput } from '../release-harness/types';

export interface SongDnaInput {
  audioProfile?: AudioIntelligenceProfile;
  metadata?: Partial<ExtendedGoldenMetadata>;
  releaseIntent?: ReleaseHarnessInput['releaseIntent'];
  trackId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userProfile?: any;
}

export interface SongDnaHarnessOutput {
  releaseDna: ReturnType<typeof buildReleaseDna>;
  aiDisclosure: ExtendedGoldenMetadata['aiGeneratedContent'] | undefined;
}

export class SongDnaCompiler implements HarnessCompiler<SongDnaInput, SongDnaHarnessOutput> {
  readonly domain = 'song_dna';

  compile(input: SongDnaInput, ctx: HarnessContext): HarnessRun<SongDnaHarnessOutput> {
    const metadata = input.metadata ?? {};
    const releaseDna = buildReleaseDna(input.audioProfile, metadata);

    return createHarnessRun<SongDnaHarnessOutput>({
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [
        ...(input.trackId ? [{ type: 'track' as const, id: input.trackId, label: metadata.trackTitle }] : []),
        ...(metadata.isrc ? [{ type: 'track' as const, id: metadata.isrc, label: 'ISRC' }] : []),
      ],
      scores: [{
        label: 'Song DNA Confidence',
        value: Math.round(releaseDna.confidence * 100),
        max: 100,
        status: releaseDna.confidence >= 0.75 ? 'good' : releaseDna.confidence >= 0.45 ? 'watch' : 'blocked',
        rationale: input.audioProfile ? 'Audio intelligence profile is attached.' : 'Using metadata fallback until audio analysis is available.',
      }],
      findings: [{
        id: 'song_dna_summary',
        domain: this.domain,
        severity: 'info',
        title: 'Creative intake compiled',
        detail: [
          releaseDna.genreSignals.length ? `Genres: ${releaseDna.genreSignals.slice(0, 4).join(', ')}` : 'Genre signals need confirmation.',
          releaseDna.moodSignals.length ? `Moods: ${releaseDna.moodSignals.slice(0, 4).join(', ')}` : 'Mood signals need confirmation.',
          typeof releaseDna.tempo === 'number' ? `Tempo: ${Math.round(releaseDna.tempo)} BPM` : 'Tempo unavailable.',
        ].join(' '),
        confidence: releaseDna.confidence >= 0.75 ? 'high' : releaseDna.confidence >= 0.45 ? 'medium' : 'low',
      }],
      recommendations: [{
        id: 'send_song_dna_to_departments',
        domain: this.domain,
        priority: 'medium',
        title: 'Send Song DNA to release, marketing, legal, merch, and licensing',
        detail: 'Use the compiled audio and metadata signals as the shared source of truth for downstream harnesses.',
        ownerAgentId: 'music',
        approvalRequired: false,
        nextAction: 'Run downstream harnesses from this intake packet.',
      }],
      costLines: [],
      legalBasis: [],
      evidenceRefs: [
        ...(releaseDna.fingerprint ? [{
          id: `fingerprint_${releaseDna.fingerprint}`,
          type: 'hash' as const,
          label: 'Audio fingerprint',
          hash: releaseDna.fingerprint,
          createdAt: new Date().toISOString(),
        }] : [])
      ],
      agentBriefs: [{
        agentId: 'music',
        departmentId: 'music',
        brief: 'Confirm Song DNA, audio confidence, AI artifacts, explicit status, and metadata suggestions.',
        inputs: ['audio profile', 'metadata', 'fingerprint'],
      }, {
        agentId: 'marketing',
        departmentId: 'marketing',
        brief: 'Use mood, energy, genre, and marketing comment to draft campaign angles.',
        inputs: releaseDna.moodSignals.concat(releaseDna.genreSignals).slice(0, 8),
      }],
      approvalGates: [],
      assumptions: input.audioProfile ? ['Audio intelligence profile was supplied by the upload flow.'] : ['Audio analysis was not supplied; Song DNA is metadata-derived until analysis runs.'],
      confidence: releaseDna.confidence,
      output: {
        releaseDna,
        aiDisclosure: metadata.aiGeneratedContent,
      },
    });
  }
}

export const songDnaCompiler = new SongDnaCompiler();
