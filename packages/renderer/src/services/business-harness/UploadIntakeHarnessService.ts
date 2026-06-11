import type { AudioIntelligenceProfile } from '@/services/audio/types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { UserProfile } from '@/types/User';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { creatorProtectionHarnessService, type CreatorProtectionRun, type IdentityProtectionProfile } from '@/services/creator-protection';
import {
  releaseHarnessService,
  saveReleaseHarnessRun,
  type ReleaseHarnessInput,
  type ReleaseHarnessResult,
} from '@/services/release-harness';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { buildDistributionReadiness, buildReleaseDna } from '@/services/release-harness/ReleaseHarnessAdapters';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createHarnessRun, type HarnessRun } from './types';
import { saveHarnessRun } from './HarnessStorage';
import { compileHarness } from './HarnessCompiler';
import type { SongDnaHarnessOutput } from './SongDnaCompiler';
import type { DistributionDdexHarnessOutput } from './DistributionDdexCompiler';

export interface UploadIntakeHarnessInput extends Omit<ReleaseHarnessInput, 'audioProfile'> {
  audioProfile?: AudioIntelligenceProfile;
  protectionProfile?: IdentityProtectionProfile;
  save?: boolean;
}

export type { SongDnaHarnessOutput, DistributionDdexHarnessOutput };

export interface UploadIntakeHarnessResult {
  songDnaRun: HarnessRun<SongDnaHarnessOutput>;
  distributionRun: HarnessRun<DistributionDdexHarnessOutput>;
  creatorProtectionRun: CreatorProtectionRun;
  releaseResult: ReleaseHarnessResult;
  savedRunIds?: {
    songDna?: string;
    distribution?: string;
    creatorProtection?: string;
    release?: string;
  };
}

class UploadIntakeHarnessService {
  async compileUploadIntake(input: UploadIntakeHarnessInput): Promise<UploadIntakeHarnessResult> {
    const metadata = input.metadata ?? {};
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const songDnaRun = await compileHarness<any, SongDnaHarnessOutput>('song_dna', {
      audioProfile: input.audioProfile,
      metadata,
      releaseIntent: input.releaseIntent,
      trackId: input.trackId,
      userProfile: input.userProfile,
    }, { userId: input.userId, projectId: input.projectId });

    const releaseDna = songDnaRun.output.releaseDna;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creatorProtectionRun = await compileHarness<any, any>('creator_protection', {
      protectionProfile: input.protectionProfile,
      metadata,
      releaseIntent: input.releaseIntent,
      fingerprint: releaseDna.fingerprint,
      userProfile: input.userProfile,
    }, { userId: input.userId, projectId: input.projectId });

    const releaseResult = await releaseHarnessService.compileReleaseHarness({
      ...input,
      audioProfile: input.audioProfile,
      metadata,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const distributionRun = await compileHarness<any, DistributionDdexHarnessOutput>('distribution_ddex', {
      metadata,
      selectedStores: input.selectedStores,
      trackId: input.trackId,
    }, { userId: input.userId, projectId: input.projectId });

    const savedRunIds = input.save ? {
      songDna: await saveHarnessRun(songDnaRun),
      distribution: await saveHarnessRun(distributionRun),
      creatorProtection: await saveHarnessRun(creatorProtectionRun),
      release: await saveReleaseHarnessRun(releaseResult),
    } : undefined;

    return {
      songDnaRun,
      distributionRun,
      creatorProtectionRun,
      releaseResult,
      savedRunIds,
    };
  }

}
export const uploadIntakeHarnessService = new UploadIntakeHarnessService();
