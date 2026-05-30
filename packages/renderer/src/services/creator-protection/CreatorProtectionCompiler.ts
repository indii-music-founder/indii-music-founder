import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import type { IdentityProtectionProfile, CreatorProtectionRun } from './types';
import { creatorProtectionHarnessService } from './CreatorProtectionHarnessService';
import type { UserProfile } from '@/types/User';

export interface CreatorProtectionInput {
  protectionProfile?: IdentityProtectionProfile;
  metadata?: Partial<ExtendedGoldenMetadata>;
  releaseIntent?: { title?: string };
  fingerprint?: string;
  userProfile?: UserProfile;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CreatorProtectionCompiler implements HarnessCompiler<CreatorProtectionInput, any> {
  readonly domain = 'creator_protection';

  compile(input: CreatorProtectionInput, ctx: HarnessContext): CreatorProtectionRun {
    const metadata = input.metadata ?? {};
    
    let protectionProfile = input.protectionProfile;
    if (!protectionProfile) {
      protectionProfile = creatorProtectionHarnessService.createIdentityProtectionProfile({
        userId: ctx.userId,
        legalName: metadata.composerName,
        artistName: metadata.artistName ?? input.userProfile?.displayName ?? undefined,
        country: 'US',
        labelName: metadata.labelName,
        publisherName: metadata.publisherName ?? metadata.publisher,
        pro: metadata.pro,
        ipiCae: metadata.composerIPI,
        copyrightStatus: metadata.isrc || metadata.upc ? 'draft' : 'unknown',
        trademarkStatus: 'unknown',
        aiVoiceLikenessPermission: 'not_authorized',
        monitoringOptIn: false,
        biometricFingerprintOptIn: false,
      });
    }

    const workTitle = metadata.trackTitle?.trim() || input.releaseIntent?.title?.trim();

    return creatorProtectionHarnessService.compileReadiness({
      profile: protectionProfile,
      works: workTitle ? [{
        workTitle,
        isrc: metadata.isrc,
        upc: metadata.upc,
        iswc: metadata.iswc,
        catalogNumber: metadata.catalogNumber,
        copyrightRegistration: protectionProfile.copyrightStatus === 'registered' ? 'registered' : undefined,
        proWorkId: metadata.composerIPI,
        humanAuthorshipStatement: metadata.aiGeneratedContent?.humanContribution,
      }] : [],
      evidenceRefs: [
        ...(input.fingerprint ? [{
          id: `fingerprint_${input.fingerprint}`,
          type: 'hash' as const,
          label: 'Audio fingerprint',
          hash: input.fingerprint,
          createdAt: new Date().toISOString(),
        }] : []),
        ...(metadata.isrc ? [{
          id: `isrc_${metadata.isrc}`,
          type: 'identifier' as const,
          label: 'ISRC',
          value: metadata.isrc,
          createdAt: new Date().toISOString(),
        }] : []),
      ],
    });
  }
}

export const creatorProtectionCompiler = new CreatorProtectionCompiler();
