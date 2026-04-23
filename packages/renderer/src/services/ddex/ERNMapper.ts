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
import { logger } from '@/utils/logger';

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
                      keyWords: Array.from(new Set([
                                        ...(metadata.keywords || []),
                                        ...(metadata.mood || []),
                      ].map(k => k.toLowerCase()))),
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
                      duration: metadata.durationDDEXFormatted || ERNMapper.formatISO8601Duration(metadata.durationFormatted),
                      parentalWarningType: metadata.explicit ? 'Explicit' : 'NotExplicit',
                      soundRecordingDetails: {
                                        soundRecordingType: 'MusicalWorkSoundRecording',
                                        isInstrumental: metadata.language === 'zxx',
                                        languageOfPerformance: metadata.language || 'zxx',
                                        bpm: metadata.bpm,
                                        key: metadata.key,
                                        energy: metadata.energy,
                      },
        };

        if (assets?.audioFile) {
                      audioResource.technicalDetails = [{
                                        technicalResourceDetailsReference: 'T1',
                                        file: {
                                                               fileName: assets.audioFile.name || `${metadata.trackTitle}.${assets.audioFile.format}`,
                                                               filePath: assets.audioFile.path,
                                                               hashSum: assets.audioFile.hash,
                                        },
                                        duration: metadata.durationDDEXFormatted || ERNMapper.formatISO8601Duration(metadata.durationFormatted),
                      }];
        }

        resources.push(audioResource);

        // 2. Image Resource (Cover Art)
        if (assets?.coverArt || metadata.coverArtAIGenerated) {
                      const imageRef = 'IM1';
                      resourceReferences.push(imageRef);
                      
                      const imageResource: Resource = {
                                        resourceReference: imageRef,
                                        resourceType: 'Image',
                                        resourceId: { 
                                                            proprietaryId: { 
                                                                                id: 'COVER_ART', 
                                                                                proprietaryIdType: 'Internal' 
                                                            } 
                                        },
                                        resourceTitle: { titleText: `${metadata.releaseTitle || metadata.trackTitle} Cover Art`, titleType: 'DisplayTitle' },
                                        displayArtistName: metadata.artistName,
                                        contributors: [],
                      };

                      if (assets?.coverArt) {
                                        imageResource.technicalDetails = [{
                                                               technicalResourceDetailsReference: 'T2',
                                                               file: {
                                                                                         fileName: assets.coverArt.name || 'cover.jpg',
                                                                                         filePath: assets.coverArt.path,
                                                               },
                                        }];
                      }

                      if (metadata.coverArtAIGenerated) {
                                        imageResource.aiGenerationInfo = {
                                                            isFullyAIGenerated: true,
                                                            isPartiallyAIGenerated: false,
                                                            disclosureType: 'AI_Generated' as AIDisclosureType,
                                        };
                      }

                      resources.push(imageResource);
        }

        return { resources, resourceReferences };
    }

    private static buildDeals(
              metadata: ExtendedGoldenMetadata,
              _releaseReference: string,
              action?: 'NewRelease' | 'Update' | 'Takedown'
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

                // 4. YouTube Content ID Deal (Item 233)
                if (metadata.youtubeContentIdOptIn) {
                    const policy = metadata.youtubeContentIdPolicy || 'monetize';
                    const useType: UseType = policy === 'block' ? 'NonInteractiveStream' : 'UserMadeContentDelivery';
                    
                    const youtubeDeal: Deal = {
                        dealReference: `D${dealCounter++}`,
                        dealTerms: {
                            commercialModelType: 'UserMakeAvailableLabelProvided',
                            usage: [{
                                useType,
                                distributionChannelType: 'Stream'
                            }],
                            territoryCode,
                            validityPeriod,
                        },
                        youtubeContentIdPolicy: policy
                    };

                    // Release Display Start Date
                    if (metadata.releaseDate) {
                        youtubeDeal.dealTerms.releaseDisplayStartDate = metadata.releaseDate;
                    }

                    deals.push(youtubeDeal);
                }

                // 5. Additional legacy YouTube check (if Split exists but opt-in is false)
                const youtubeSplit = metadata.splits?.find(s => s.distributorId === 'youtube' || s.distributorId === 'youtube_content_id');
                if (youtubeSplit && !metadata.youtubeContentIdOptIn) {
                    addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
                }

                return deals;
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
            name: mainArtistName,
            role: 'MainArtist',
            isni: mainArtistIsni,
            spotifyId: spotifyId,
            appleMusicId: appleId,
        });

        // 2. Map Splits to Contributors (Composer, Lyricist, etc.)
        const ROLE_MAP: Record<string, ContributorRole> = {
            'songwriter': 'Composer',
            'performer': 'AssociatedPerformer',
            'producer': 'Producer',
            'mixer': 'Mixer',
            'composer': 'Composer',
            'lyricist': 'Lyricist',
        };

        splits.forEach(split => {
            const internalRole = (split.role || '').toLowerCase();
            if (internalRole && internalRole !== 'mainartist') {
                contributors.push({
                    name: split.legalName,
                    role: ROLE_MAP[internalRole] || 'AssociatedPerformer',
                });
            }
        });

        return contributors;
    }

    private static classifyAIDisclosure(aiContent: any): AIDisclosureType {
        if (aiContent.isFullyAIGenerated) return 'AI_Generated';
        if (aiContent.isPartiallyAIGenerated) {
            const contribution = (aiContent.humanContribution || '').toLowerCase();
            if (contribution.includes('composed') || contribution.includes('wrote')) {
                return 'Human_Composed_AI_Produced';
            }
            return 'AI_Assisted';
        }
        return 'Human_Created';
    }

    private static formatISO8601Duration(durationStr?: string): string | undefined {
        if (!durationStr) return undefined;
        
        // Handle HH:MM:SS or MM:SS
        const parts = durationStr.split(':').map(Number);
        
        if (parts.length === 3) {
            // HH:MM:SS
            const hours = parts[0];
            const minutes = parts[1];
            const seconds = parts[2];
            return `PT${hours}H${minutes}M${seconds}S`;
        } else if (parts.length === 2) {
            // MM:SS
            const minutes = parts[0];
            const seconds = parts[1];
            return `PT${minutes}M${seconds}S`;
        }
        
        return durationStr;
    }

    /**
     * Generates a unique reference for the ERN message
     */
    static generateReference(prefix: string, index: number): string {
              return `${prefix}${index.toString().padStart(2, '0')}`;
    }
}
