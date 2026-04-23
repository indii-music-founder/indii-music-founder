import {
      ExtendedGoldenMetadata,
      RoyaltySplit,
} from '@/services/metadata/types';
import { ReleaseAssets } from '@/services/distribution/types/distributor';
import {
      ERNMessage,
      Release,
      Resource,
      Deal,
      Contributor,
      ReleaseId,
      TitleText,
      GenreWithSubGenre,
} from './types/ern';
import {
      DDEXMessageHeader,
      DPID,
      TerritoryCode,
      ReleaseType,
      ContributorRole,
      CommercialModelType,
      UseType,
      AIDisclosureType,
} from './types/common';

/**
 * ERN Mapper
 * Transforms internal GoldenMetadata into strict DDEX ERN 4.3 Objects
 */
export class ERNMapper {
      static mapMetadataToERN(
                metadata: ExtendedGoldenMetadata,
                options: {
                              messageId: string;
                              sender: DPID;
                              recipient: DPID;
                              createdDateTime: string;
                              messageControlType?: 'LiveMessage' | 'TestMessage';
                              action?: 'NewRelease' | 'Update' | 'Takedown';
                },
                assets?: ReleaseAssets
            ): ERNMessage {
                const releaseReference = 'R1';

          // 1. Build Header
          const messageHeader: DDEXMessageHeader = {
                        messageId: options.messageId,
                        messageSender: options.sender,
                        messageRecipient: options.recipient,
                        messageCreatedDateTime: options.createdDateTime,
                        messageControlType: options.messageControlType || 'LiveMessage',
          };

          // 2. Build Release List
          const mainRelease = this.buildMainRelease(metadata, releaseReference);

          // 3. Build Resource List
          const { resources, resourceReferences } = this.buildResources(metadata, assets);
                // Link resources to main release
          mainRelease.releaseResourceReferenceList = resourceReferences;

          // 4. Build Deal List
          const deals = this.buildDeals(metadata, releaseReference, options.action);

          return {
                        messageSchemaVersionId: '4.3',
                        messageHeader,
                        action: options.action || 'NewRelease',
                        releaseList: [mainRelease],
                        resourceList: resources,
                        dealList: deals,
          };
      }

    private static buildMainRelease(
              metadata: ExtendedGoldenMetadata,
              releaseReference: string
          ): Release {
              const releaseId: ReleaseId = {
                            icpn: metadata.upc,
                            catalogNumber: metadata.catalogNumber,
              };

          const title: TitleText = {
                        titleText: metadata.releaseTitle || metadata.trackTitle,
                        titleType: 'DisplayTitle',
          };

          const contributors = this.mapContributors(
                        metadata.splits, 
                        metadata.artistName, 
                        metadata.artistIsni, 
                        metadata.artistSpotifyId, 
                        metadata.artistAppleMusicId
                    );

          // Determine ReleaseType
          const RELEASE_TYPE_MAP: Record<string, ReleaseType> = {
                        'AudioAlbum': 'Album',
                        'Single': 'Single',
                        'EP': 'EP',
                        'Compilation': 'Compilation',
                        'VideoSingle': 'VideoSingle',
                        'Ringtone': 'Ringtone',
          };
    };

        let releaseType: ReleaseType = 'Single';
          if (metadata.releaseType) {
                        releaseType = RELEASE_TYPE_MAP[metadata.releaseType] || 'Single';
          }

        const genre: GenreWithSubGenre = {
                      genre: metadata.genre,
                      subGenre: metadata.subGenre
        };

        const release: Release = {
                      releaseId,
                      releaseReference,
                      releaseType,
                      releaseTitle: title,
                      displayArtistName: metadata.artistName,
                      contributors,
                      labelName: metadata.labelName,
                      genre,
                      parentalWarningType: metadata.explicit ? 'Explicit' : 'NotExplicit',
                      releaseDate: {
                                        releaseDate: metadata.releaseDate,
                                        isOriginalReleaseDate: true
                      },
                      originalReleaseDate: metadata.originalReleaseDate,
                      marketingComment: metadata.marketingComment,
                      releaseResourceReferenceList: [], // Filled later
                      pLine: metadata.pLineYear ? { year: metadata.pLineYear, text: metadata.pLineText || '' } : undefined,
                      cLine: metadata.cLineYear ? { year: metadata.cLineYear, text: metadata.cLineText || '' } : undefined,
        };

        if (metadata.aiGeneratedContent) {
                      const disclosureType = ERNMapper.classifyAIDisclosure(metadata.aiGeneratedContent);
                      release.aiGenerationInfo = {
                                        isFullyAIGenerated: metadata.aiGeneratedContent.isFullyAIGenerated,
                                        isPartiallyAIGenerated: metadata.aiGeneratedContent.isPartiallyAIGenerated,
                                        aiToolsUsed: metadata.aiGeneratedContent.aiToolsUsed,
                                        humanContributionDescription: metadata.aiGeneratedContent.humanContribution,
                                        disclosureType,
                      };
        }

        // Self-Publishing Rights Controller
        if (!metadata.publisher || metadata.publisher === 'Self' || metadata.publisher === 'self') {
            release.rightsControllers = [{
                              partyName: metadata.labelName || metadata.artistName,
                              role: 'OriginalPublisher',
                              rightSharePercentage: 100,
            }];
}

        return release;
}

    private static buildResources(
              metadata: ExtendedGoldenMetadata,
              assets?: ReleaseAssets
          ): { resources: Resource[]; resourceReferences: string[] } {
              const resources: Resource[] = [];
        const resourceReferences: string[] = [];

        // 1. Audio Recording Resource
        const audioRef = 'AS1';
        resourceReferences.push(audioRef);

        const contributors = this.mapContributors(
                      metadata.splits,
                      metadata.artistName,
                      metadata.artistIsni,
                      metadata.artistSpotifyId,
                      metadata.artistAppleMusicId
                  );

        const audioResource: Resource = {
                      resourceReference: audioRef,
                      resourceType: 'SoundRecording',
                      resourceId: { isrc: metadata.isrc },
                      resourceTitle: { titleText: metadata.trackTitle, titleType: 'DisplayTitle' },
                      displayArtistName: metadata.artistName,
                      contributors,
                      duration: metadata.duration,
                      pLine: metadata.pLineYear ? { year: metadata.pLineYear, text: metadata.pLineText || '' } : undefined,
                      isExplicit: metadata.explicit,
                      audioLegalType: 'AudioRecording',
        };

        if (assets?.audioFile) {
                      audioResource.technicalDetails = [{
                                        technicalResourceDetailsReference: 'T1',
                                        file: {
                                                              fileName: assets.audioFile.name,
                                                              filePath: assets.audioFile.path,
                                                              hashSum: assets.audioFile.hash,
                                        },
                                        duration: metadata.duration,
                      }];
        }

        resources.push(audioResource);

        // 2. Image Resource (Cover Art)
        if (assets?.coverArt) {
                      const imageRef = 'IM1';
                      resourceReferences.push(imageRef);
                      resources.push({
                                        resourceReference: imageRef,
                                        resourceType: 'Image',
                                        resourceId: { proprietaryId: 'COVER_ART' },
                                        resourceTitle: { titleText: `${metadata.releaseTitle} Cover Art`, titleType: 'DisplayTitle' },
                                        imageType: 'FrontCoverImage',
                                        technicalDetails: [{
                                                              technicalResourceDetailsReference: 'T2',
                                                              file: {
                                                                                        fileName: assets.coverArt.name,
                                                                                        filePath: assets.coverArt.path,
                                                              }
                                        }]
                      });
        }

        return { resources, resourceReferences };
}

    private static buildDeals(
              metadata: ExtendedGoldenMetadata,
              _releaseReference: string,
              action?: 'NewRelease' | 'Update' | 'Takedown'
          ): Deal[] {
                    ): Deal[] {
                        const deals: Deal[] = [];
                              let dealCounter = 1;

                              // Default to Worldwide if no territories specified
                              const territoryCode: TerritoryCode[] = (metadata.territories && metadata.territories.length > 0)
                                  ? (metadata.territories as TerritoryCode[])
                                      : ['Worldwide'];

                              const validityPeriod = {
                                            startDate: metadata.releaseDate
                              };

                              // Helper to create and add a deal
                              const addDeal = (commercialModel: CommercialModelType, useType: UseType, distributionChannelType?: 'Download' | 'Stream' | 'MobileDevice' | 'Physical') => {
                                            const deal: Deal = {
                                                              dealReference: `D${dealCounter++}`,
                                                              dealTerms: {
                                                                                    commercialModelType: commercialModel,
                                                                                    usage: [{
                                                                                                              useType,
                                                                                                              distributionChannelType
                                                                                      }],
                                                                                    territoryCode,
                                                                                    validityPeriod,
                                                                                    ...(action === 'Takedown' ? { takeDown: true } : {}),
                                                              },
                                            };

                                  // Release Display Start Date
                                  if (metadata.releaseDate) {
                                                    deal.dealTerms.releaseDisplayStartDate = metadata.releaseDate;
                                  }

                                  deals.push(deal);
                              };

                              const distributionChannels = metadata.distributionChannels || [];

                              // 1. Streaming Deals
                              if (distributionChannels.includes('streaming')) {
                                  addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');
                                  addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
                                  addDeal('SubscriptionModel', 'NonInteractiveStream', 'Stream');
                                  addDeal('AdvertisementSupportedModel', 'NonInteractiveStream', 'Stream');
                    }

                        // 2. Download Deals
                        if (distributionChannels.includes('download')) {
                            addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
}

        // 3. Physical Deals
        if (distributionChannels.includes('physical')) {
                      addDeal('PayAsYouGoModel', 'PhysicalProduct', 'Physical');
        }

        // Fallback: If no digital deal types were added, default to Streaming + Download
        if (deals.length === 0 || (deals.length === 1 && distributionChannels.includes('physical') && distributionChannels.length === 1)) {
                      if (deals.length === 1) {
                                        deals.length = 0;
                                        dealCounter = 1;
                      }
                      addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');
                      addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
                      addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
        }

        // 4. YouTube Content ID Deal (Legacy/Item 233)
        // If there's a YouTube-specific split, we add a YouTube deal
        const youtubeSplit = metadata.splits?.find(s => s.distributorId === 'youtube' || s.distributorId === 'youtube_content_id');
        if (youtubeSplit) {
                      addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
        }

        return deals;
}
}

    private static mapContributors(
              splits: RoyaltySplit[] = [],
              mainArtistName: string,
              mainArtistIsni?: string,
              spotifyId?: string,
              appleId?: string
          ): Contributor[] {
                        const contributors: Contributor[] = [];

        // 1. Main Artist
        contributors.push({
                      partyName: mainArtistName,
                      role: 'MainArtist',
                      isni: mainArtistIsni,
                      proprietaryIds: [
                                        ...(spotifyId ? [{ id: spotifyId, type: 'SpotifyArtistId' as any }] : []),
                                        ...(appleId ? [{ id: appleId, type: 'AppleArtistId' as any }] : []),
                                    ]
        });

        // 2. Map Splits to Contributors (Composer, Lyricist, etc.)
        splits.forEach(split => {
                      if (split.role && split.role !== 'MainArtist') {
                                        contributors.push({
                                                              partyName: split.userName || split.userId,
                                                              role: split.role as ContributorRole,
                                                              rightSharePercentage: split.percentage,
                                        });
                      }
        });

        return contributors;
}

    private static classifyAIDisclosure(aiContent: any): AIDisclosureType {
        if (aiContent.isFullyAIGenerated) return 'FullyAIGenerated';
              if (aiContent.isPartiallyAIGenerated) return 'PartiallyAIGenerated';
              return 'NotAIGenerated';
    }

    /**
     * Generates a unique reference for the ERN message
     */
    static generateReference(prefix: string, index: number): string {
              return `${prefix}${index.toString().padStart(2, '0')}`;
    }
}
