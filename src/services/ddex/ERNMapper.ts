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
        // When publisher is 'Self' or empty, the artist controls 100% of composition rights.
        if (!metadata.publisher || metadata.publisher === 'Self' || metadata.publisher === 'self') {
            release.rightsControllers = [{
                partyName: metadata.labelName || metadata.artistName,
                role: 'OriginalPublisher',
                rightSharePercentage: 100,
            }];
        }

        return release;
    }

    private static formatDuration(duration?: string): string | undefined {
        if (!duration) return undefined;

        // Handle HH:MM:SS or MM:SS
        const parts = duration.split(':').map(Number);
        let h = 0, m = 0, s = 0;

        if (parts.length === 3) {
            [h, m, s] = parts as [number, number, number];
        } else if (parts.length === 2) {
            [m, s] = parts as [number, number];
        } else {
            s = parts[0] ?? 0;
        }

        let iso = 'PT';
        if (h > 0) iso += `${h}H`;
        if (m > 0 || h > 0) iso += `${m}M`;
        iso += `${s}S`;

        return iso;
    }

    private static buildResources(metadata: ExtendedGoldenMetadata, assets?: ReleaseAssets): {
        resources: Resource[];
        resourceReferences: string[];
    } {
        const resources: Resource[] = [];
        const resourceReferences: string[] = [];
        let resourceCounter = 1;

        // Determine tracks to process
        const tracksToProcess = (metadata.tracks && metadata.tracks.length > 0)
            ? metadata.tracks as ExtendedGoldenMetadata[]
            : [metadata];

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
                duration: this.formatDuration(track.durationFormatted),
                parentalWarningType: track.explicit ? 'Explicit' : 'NotExplicit',
                soundRecordingDetails: {
                    soundRecordingType: 'MusicalWorkSoundRecording',
                    isInstrumental: track.isInstrumental || false,
                    languageOfPerformance: track.language,
                    lyrics: track.lyrics ? {
                        lyricsText: track.lyrics,
                        isExplicit: track.explicit
                    } : undefined
                }
            };

            // Map Lyrics (Metadata to ERN Detail)
            // Note: ERN 4.3 typically handles lyrics as a Text Resource or DetailsByTerritory.
            // For simplicity in this 'Gold Standard' pass, we'll attach it if the schema allows,
            // or implicitly rely on it being present in the package.
            // Here we assume it might be added to details if we had a field for it in Resource.
            // (DDEX 4.3 encourages Lyrics as a separate Text Resource linked to the SoundRecording)

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
                const matchedAsset = assets.audioFiles.find((a: NonNullable<ReleaseAssets['audioFiles']>[number]) => a.trackIndex === index) || assets.audioFiles[index];

                if (matchedAsset) {
                    const ext = matchedAsset.format || 'wav';
                    audioResource.technicalDetails = {
                        fileName: `${audioRef}.${ext}`
                    };
                } else {
                    // Fallback default
                    audioResource.technicalDetails = {
                        fileName: `${audioRef}.wav`
                    };
                }
            } else if (assets && assets.audioFile && index === 0) {
                // Backward compatibility for singular audioFile (Single release only)
                const ext = assets.audioFile.format || 'wav';
                audioResource.technicalDetails = {
                    fileName: `${audioRef}.${ext}`
                };
            } else {
                // No matching asset found
                audioResource.technicalDetails = {
                    fileName: `${audioRef}.wav`
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
                fileName: `${imageRef}.${ext}`
            };
        } else {
            imageResource.technicalDetails = {
                fileName: `${imageRef}.jpg`
            };
        }

        // Flag Image as AI-generated when cover art was created by AI
        // This is critical for 2026 DSP compliance — indiiOS generates art via Nano Banana
        if (metadata.aiGeneratedContent?.isFullyAIGenerated || metadata.coverArtAIGenerated) {
            imageResource.aiGenerationInfo = {
                isFullyAIGenerated: true,
                isPartiallyAIGenerated: false,
                aiToolsUsed: metadata.aiGeneratedContent?.aiToolsUsed || ['indiiOS Nano Banana'],
                disclosureType: 'AI_Generated',
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
        const territoryCode: TerritoryCode[] = (metadata.territories && metadata.territories.length > 0)
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
        // Maps 'download' channel to Permanent Download (PayAsYouGo)
        if (distributionChannels.includes('download')) {
            // Permanent Download (iTunes, Amazon MP3, etc.)
            addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
        }

        // Fallback: If no deal types were added (e.g. no channels specified), default to Streaming + Download
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

        // 4. YouTube Content ID Deal (Item 233)
        // When opted in, include a UGC monetization deal for YouTube CMS delivery.
        // DDEX ERN 4.3: UserMakeAvailableLabelProvided + UserMadeContentDelivery use type
        // signals the distributor to register the asset with YouTube Content ID.
        if (metadata.youtubeContentIdOptIn === true) {
            const contentIdPolicy = metadata.youtubeContentIdPolicy || 'monetize';
            // block → prevent UGC; monetize/track → allow with revenue collection or tracking only
            const useType: UseType = contentIdPolicy === 'block'
                ? 'NonInteractiveStream'
                : ('UserMadeContentDelivery' as UseType);

            const contentIdDeal: Deal = {
                dealReference: `D${dealCounter++}`,
                dealTerms: {
                    commercialModelType: ('UserMakeAvailableLabelProvided' as CommercialModelType),
                    usage: [{ useType, distributionChannelType: 'Stream' }],
                    territoryCode,
                    validityPeriod,
                    takeDown: false,
                    releaseDisplayStartDate: metadata.releaseDate,
                },
            };
            // Annotate the deal with the YouTube-specific policy in a proprietary extension field
            (contentIdDeal as unknown as Record<string, unknown>)['youtubeContentIdPolicy'] = contentIdPolicy;
            deals.push(contentIdDeal);
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

    /**
     * Classify AI disclosure per 2026 DDEX / DSP requirements.
     *
     * Maps the internal metadata flags to the standardized disclosure types:
     * - Fully AI → AI_Generated
     * - Partially AI → AI_Assisted
     * - Human-written but AI-produced → Human_Composed_AI_Produced
     * - None → Human_Created
     */
    static classifyAIDisclosure(aiContent: {
        isFullyAIGenerated: boolean;
        isPartiallyAIGenerated: boolean;
        humanContribution?: string;
    }): AIDisclosureType {
        if (aiContent.isFullyAIGenerated) {
            return 'AI_Generated';
        }
        if (aiContent.isPartiallyAIGenerated) {
            // If there's meaningful human composition, classify as composed-then-produced
            const humanNote = (aiContent.humanContribution || '').toLowerCase();
            if (humanNote.includes('composed') || humanNote.includes('wrote') || humanNote.includes('written')) {
                return 'Human_Composed_AI_Produced';
            }
            return 'AI_Assisted';
        }
        return 'Human_Created';
    }
}
