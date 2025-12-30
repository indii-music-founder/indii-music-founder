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
        const deals = this.buildDeals(metadata, releaseReference);

        return {
            messageSchemaVersionId: '4.3',
            messageHeader,
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

        const contributors = this.mapContributors(metadata.splits, metadata.artistName);

        // Determine ReleaseType
        let releaseType: ReleaseType = 'Single';
        if (metadata.releaseType) {
            // Map internal release types to strict DDEX types if different
            // Assuming types match for now based on types.ts
            if ((metadata.releaseType as string) === 'AudioAlbum') releaseType = 'Album';
            else if ((metadata.releaseType as string) === 'Single') releaseType = 'Single';
            else if ((metadata.releaseType as string) === 'VideoSingle') releaseType = 'VideoSingle' as ReleaseType;
            else if ((metadata.releaseType as string) === 'Ringtone') releaseType = 'Ringtone' as ReleaseType;
            else releaseType = metadata.releaseType as ReleaseType;
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
            release.aiGenerationInfo = {
                isFullyAIGenerated: metadata.aiGeneratedContent.isFullyAIGenerated,
                isPartiallyAIGenerated: metadata.aiGeneratedContent.isPartiallyAIGenerated,
                aiToolsUsed: metadata.aiGeneratedContent.aiToolsUsed,
                humanContributionDescription: metadata.aiGeneratedContent.humanContribution
            }
        }

        return release;
    }

    private static buildResources(metadata: ExtendedGoldenMetadata, assets?: ReleaseAssets): {
        resources: Resource[];
        resourceReferences: string[];
    } {
        const resources: Resource[] = [];
        const resourceReferences: string[] = [];
        let resourceCounter = 1;

        // Determine tracks to process
        // If it's a Single, metadata acts as the track if tracks array is empty.
        // If it's an Album/EP, iterate metadata.tracks.
        const tracksToProcess = (metadata.tracks && metadata.tracks.length > 0)
            ? metadata.tracks
            : [metadata]; // Treat root as the single track

        // 1. Audio Resources
        tracksToProcess.forEach((track, index) => {
            const audioRef = `A${resourceCounter++}`;
            resourceReferences.push(audioRef);

            const audioResource: Resource = {
                resourceReference: audioRef,
                resourceType: 'SoundRecording',
                resourceId: {
                    isrc: track.isrc,
                },
                resourceTitle: {
                    titleText: track.trackTitle,
                    titleType: 'DisplayTitle',
                },
                displayArtistName: track.artistName,
                contributors: this.mapContributors(track.splits, track.artistName),
                duration: track.durationFormatted ? `PT${track.durationFormatted.replace(':', 'M')}S` : undefined,
                parentalWarningType: track.explicit ? 'Explicit' : 'NotExplicit',
                soundRecordingDetails: {
                    soundRecordingType: 'MusicalWorkSoundRecording',
                    isInstrumental: track.isInstrumental || false,
                    languageOfPerformance: track.language
                }
            };

            // AI Info for Resource
            if (track.aiGeneratedContent) {
                audioResource.aiGenerationInfo = {
                    isFullyAIGenerated: track.aiGeneratedContent.isFullyAIGenerated,
                    isPartiallyAIGenerated: track.aiGeneratedContent.isPartiallyAIGenerated,
                    aiToolsUsed: track.aiGeneratedContent.aiToolsUsed,
                    humanContributionDescription: track.aiGeneratedContent.humanContribution
                }
            }

             // Link TechnicalDetails from Assets
             if (assets && assets.audioFiles && assets.audioFiles.length > index) {
                // Try to match by explicit mapping if available (e.g. trackIndex) or fallback to order
                const matchedAsset = assets.audioFiles.find(a => a.trackIndex === index) || assets.audioFiles[index];

                if (matchedAsset) {
                    const ext = matchedAsset.format || 'wav';
                    audioResource.technicalDetails = {
                        file: {
                            fileName: `${audioRef}.${ext}`
                        }
                    };
                } else {
                     // Fallback default
                    audioResource.technicalDetails = {
                        file: { fileName: `${audioRef}.wav` }
                    };
                }
             } else if (assets && assets.audioFile && index === 0) {
                 // Backward compatibility for singular audioFile (Single release only)
                  const ext = assets.audioFile.format || 'wav';
                  audioResource.technicalDetails = {
                      file: {
                          fileName: `${audioRef}.${ext}`
                      }
                  };
             } else {
                 // No matching asset found
                 audioResource.technicalDetails = {
                     file: { fileName: `${audioRef}.wav` }
                 };
             }

             resources.push(audioResource);
        });

        // 2. Image Resource (Cover Art)
        // Typically one cover art for the release.
        const imageRef = `IMG${resourceCounter++}`;
        resourceReferences.push(imageRef);

        const imageResource: Resource = {
            resourceReference: imageRef,
            resourceType: 'Image',
            resourceId: {
                proprietaryId: {
                    proprietaryIdType: 'PartySpecific',
                    id: `IMG-${metadata.isrc || Date.now()}`
                }
            },
            resourceTitle: {
                titleText: 'Front Cover Image',
                titleType: 'DisplayTitle'
            },
            displayArtistName: metadata.artistName,
            contributors: [],
            technicalDetails: {
                // In a real scenario, we'd extract this from file metadata
            }
        }

        if (assets && assets.coverArt) {
             const ext = assets.coverArt.url.split('.').pop() || 'jpg';
             imageResource.technicalDetails = {
                file: {
                    fileName: `${imageRef}.${ext}`
                }
             };
        } else {
             imageResource.technicalDetails = {
                file: {
                    fileName: `${imageRef}.jpg`
                }
             };
        }

        resources.push(imageResource);

        return { resources, resourceReferences };
    }

    private static buildDeals(
        metadata: ExtendedGoldenMetadata,
        _releaseReference: string
    ): Deal[] {
        const deals: Deal[] = [];
        let dealCounter = 1;

        // Default to Worldwide if no territories specified
        const territoryCode: TerritoryCode[] = metadata.territories.length > 0
            ? (metadata.territories as TerritoryCode[])
            : ['Worldwide'];

        const validityPeriod = {
            startDate: metadata.releaseDate
        };

        // Helper to create and add a deal
        const addDeal = (commercialModel: CommercialModelType, useType: UseType, distributionChannelType?: 'Download' | 'Stream' | 'MobileDevice') => {
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
                    takeDown: false,
                },
            };

            // Release Display Start Date
            if (metadata.releaseDate) {
                deal.dealTerms.releaseDisplayStartDate = metadata.releaseDate;
            }

            deals.push(deal);
        };

        const distributionChannels = metadata.distributionChannels || [];

        // If 'physical' is the ONLY channel, we should fallback to default digital deals
        // because we don't handle physical, but we want to ensure deals are generated.
        // If distributionChannels is empty, we also fallback.
        const hasStreaming = distributionChannels.includes('streaming');
        const hasDownload = distributionChannels.includes('download');
        const hasPhysical = distributionChannels.includes('physical');
        const isPhysicalOnly = hasPhysical && !hasStreaming && !hasDownload;
        const isEmpty = distributionChannels.length === 0;

        // 1. Streaming Deals
        // Maps 'streaming' channel to both Subscription (Premium) and Ad-Supported (Free) models
        if (distributionChannels.includes('streaming')) {
            // Subscription Streaming (Premium)
            addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');

            // Ad-Supported Streaming (Free Tier)
            addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');

            // Non-Interactive Streaming (Web Radio)
            addDeal('SubscriptionModel', 'NonInteractiveStream', 'Stream');
            addDeal('AdvertisementSupportedModel', 'NonInteractiveStream', 'Stream');
        }

        // 2. Download Deals
        // Maps 'download' channel to PayAsYouGo (Permanent Download)
        // Maps 'download' channel to Permanent Download (PayAsYouGo)
        if (distributionChannels.includes('download')) {
            // Permanent Download (iTunes, Amazon MP3, etc.)
            addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
        }

        // Fallback: Default to standard set if no deals created
        if (deals.length === 0) {
            addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');
            addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
            addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
        }

        // 3. Physical Deals
        // Note: Physical channels are currently ignored in this mapper as they require different supply chain logic.
        if (distributionChannels.includes('physical')) {
            // Placeholder for future implementation
        }

        // Fallback: If no deal types were added (e.g. no channels specified), default to Streaming + Download
        // This ensures backward compatibility if distributionChannels is missing or empty
        if (deals.length === 0) {
             addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');
             addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
        }

        return deals;
    }

    private static mapContributors(splits: RoyaltySplit[], displayArtist: string): Contributor[] {
        const contributors: Contributor[] = [];

        // Ensure Display Artist is included
        // Check if display artist is in splits, if not add as MainArtist
        const artistInSplits = splits.find(s => s.legalName === displayArtist);
        if (!artistInSplits) {
            contributors.push({
                name: displayArtist,
                role: 'MainArtist',
                sequenceNumber: 1
            });
        }

        // Map splits to contributors
        splits.forEach((split, index) => {
            let role: ContributorRole;
            switch (split.role) {
                case 'songwriter': role = 'Composer'; break; // Approximate
                case 'producer': role = 'Producer'; break;
                case 'performer': role = 'FeaturedArtist'; break; // Defaulting to featured if not main
                default: role = 'AssociatedPerformer';
            }

            // If this split IS the display artist, map as MainArtist
            if (split.legalName === displayArtist) {
                role = 'MainArtist';
            }

            contributors.push({
                name: split.legalName,
                role: role,
                sequenceNumber: index + 2 // Start after inferred main artist if added
            });
        });

        return contributors;
    }
}
