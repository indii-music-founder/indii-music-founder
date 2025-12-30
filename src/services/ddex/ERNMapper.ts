import {
    ExtendedGoldenMetadata,
    RoyaltySplit,
} from '@/services/metadata/types';
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
    ParentalWarningType,
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
        }
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
        const { resources, resourceReferences } = this.buildResources(metadata);
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
            // If single and no UPC, might use ISRC as proprietary ID or gridId?
            // Standard practice: Releases need UPC/EAN (ICPN). Tracks have ISRCs.
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
            releaseType = metadata.releaseType as ReleaseType;
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

    private static buildResources(metadata: ExtendedGoldenMetadata): {
        resources: Resource[];
        resourceReferences: string[];
    } {
        const resources: Resource[] = [];
        const resourceReferences: string[] = [];
        let resourceCounter = 1;

        // 1. Audio Resource (Primary)
        // For a single, there is one sound recording.
        // For albums, this would iterate over tracks.
        // Assuming Single for ExtendedGoldenMetadata context for now.

        const audioRef = `A${resourceCounter++}`;
        resourceReferences.push(audioRef);

        const audioResource: Resource = {
            resourceReference: audioRef,
            resourceType: 'SoundRecording',
            resourceId: {
                isrc: metadata.isrc,
            },
            resourceTitle: {
                titleText: metadata.trackTitle,
                titleType: 'DisplayTitle',
            },
            displayArtistName: metadata.artistName,
            contributors: this.mapContributors(metadata.splits, metadata.artistName),
            duration: metadata.durationFormatted ? `PT${metadata.durationFormatted.replace(':', 'M')}S` : undefined, // Simple formatting, needs robust logic
            parentalWarningType: metadata.explicit ? 'Explicit' : 'NotExplicit',
            soundRecordingDetails: {
                soundRecordingType: 'MusicalWorkSoundRecording',
                isInstrumental: metadata.isInstrumental || false,
                languageOfPerformance: metadata.language
            }
        };

        // AI Info for Resource
        if (metadata.aiGeneratedContent) {
            audioResource.aiGenerationInfo = {
                isFullyAIGenerated: metadata.aiGeneratedContent.isFullyAIGenerated,
                isPartiallyAIGenerated: metadata.aiGeneratedContent.isPartiallyAIGenerated,
                aiToolsUsed: metadata.aiGeneratedContent.aiToolsUsed,
                humanContributionDescription: metadata.aiGeneratedContent.humanContribution
            }
        }

        resources.push(audioResource);

        // 2. Image Resource (Cover Art)
        const imageRef = `IMG${resourceCounter++}`;
        resourceReferences.push(imageRef);

        // We assume there's cover art if we are distributing
        const imageResource: Resource = {
            resourceReference: imageRef,
            resourceType: 'Image',
            resourceId: {
                proprietaryId: {
                    proprietaryIdType: 'PartySpecific', // Or Use provided ID
                    id: `IMG-${metadata.isrc || Date.now()}`
                }
            },
            resourceTitle: {
                titleText: 'Front Cover Image',
                titleType: 'DisplayTitle'
            },
            displayArtistName: metadata.artistName,
            contributors: [], // Usually specific to image
            technicalDetails: {
                // In a real scenario, we'd extract this from file metadata
            }
        }
        resources.push(imageResource);


        return { resources, resourceReferences };
    }

    private static buildDeals(
        metadata: ExtendedGoldenMetadata,
        releaseReference: string
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

        // 1. Streaming Deals
        if (distributionChannels.includes('streaming')) {
            // Subscription Streaming (Premium)
            addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');
            // Ad-Supported Streaming (Free Tier)
            addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
            // Non-Interactive Streaming (Web Radio)
            addDeal('SubscriptionModel', 'NonInteractiveStream', 'Stream');
        }

        // 2. Download Deals
        if (distributionChannels.includes('download')) {
            addDeal('PayAsYouGoModel', 'PermanentDownload');
            // Permanent Download (iTunes, Amazon MP3, etc.)
            addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
        }

        // Fallback: Default to standard set if no deals created
        if (deals.length === 0) {
            addDeal('SubscriptionModel', 'OnDemandStream');
            addDeal('PayAsYouGoModel', 'PermanentDownload');
        }

        return deals;
    }

    private static mapContributors(splits: RoyaltySplit[], displayArtist: string): Contributor[] {
        const contributors: Contributor[] = [];

        // Ensure Display Artist is included
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
                case 'songwriter': role = 'Composer'; break;
                case 'producer': role = 'Producer'; break;
                case 'performer': role = 'FeaturedArtist'; break;
                default: role = 'AssociatedPerformer';
            }

            if (split.legalName === displayArtist) {
                role = 'MainArtist';
            }

            contributors.push({
                name: split.legalName,
                role: role,
                sequenceNumber: index + 2
            });
        });

        return contributors;
    }
}
