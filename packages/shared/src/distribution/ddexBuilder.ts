import { XMLBuilder } from 'fast-xml-parser';
import type { IngestionNotificationMessage } from './types/ern.js';

// Builder options for generating XML
const builderOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
};

export class DDEXBuilder {
    private builder: XMLBuilder;

    constructor() {
        this.builder = new XMLBuilder(builderOptions);
    }

    /**
     * Build IngestionNotification XML from JSON
     */
    buildIngestionNotification(ern: IngestionNotificationMessage): string {
        const rootTagName = ern.action === 'Takedown' ? 'ern:PurgeReleaseMessage' : 'ern:NewReleaseMessage';

        const xmlObj = {
            [rootTagName]: {
                '@_xmlns:ern': 'http://ddex.net/xml/ern/43',
                '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                '@_MessageSchemaVersionId': ern.messageSchemaVersionId,
                '@_LanguageAndScriptCode': 'en',
                ...(ern.action === 'Update' ? { UpdateIndicator: 'UpdateMessage' } : {}),
                MessageHeader: this.buildMessageHeader(ern.messageHeader),
                ReleaseList: this.buildReleaseList(ern.releaseList),
                ResourceList: this.buildResourceList(ern.resourceList),
                DealList: this.buildDealList(ern.dealList),
            },
        };

        const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n';
        return declaration + this.builder.build(xmlObj);
    }

    private buildMessageHeader(header: IngestionNotificationMessage['messageHeader']) {
        return {
            MessageThreadId: header.messageThreadId,
            MessageId: header.messageId,
            MessageSender: {
                SystemIdentifier: header.messageSender.systemIdentifier,
                EntityName: { '#text': header.messageSender.entityName },
            },
            MessageRecipient: {
                SystemIdentifier: header.messageRecipient.systemIdentifier,
                EntityName: { '#text': header.messageRecipient.entityName },
            },
            MessageCreatedDateTime: header.messageCreatedDateTime,
            MessageControlType: header.messageControlType,
        };
    }

    private buildReleaseList(releases: IngestionNotificationMessage['releaseList']) {
        return {
            Release: releases.map((r) => ({
                '@_ReleaseReference': r.releaseReference,
                ReleaseId: {
                    ICPN: r.releaseId.icpn,
                    CatalogNumber: r.releaseId.catalogNumber,
                },
                ReleaseDetailsByTerritory: {
                    TerritoryCode: 'Worldwide',
                    Title: {
                        '@_TitleType': 'FormalTitle',
                        TitleText: r.releaseTitle.titleText,
                    },
                    DisplayArtistName: r.displayArtistName,
                    LabelName: r.labelName,
                    Genre: {
                        GenreText: r.genre.genre,
                        SubGenre: r.genre.subGenre
                    },
                    ParentalWarningType: r.parentalWarningType,
                    MarketingComment: r.marketingComment,
                    KeyWords: (r.keyWords && r.keyWords.length > 0) ? {
                        KeyWord: r.keyWords
                    } : undefined,
                },
                ReleaseType: r.releaseType,
                ReleaseResourceReferenceList: {
                    ReleaseResourceReference: r.releaseResourceReferenceList,
                },
                ...(r.aiGenerationInfo ? {
                    AIGenerationInfo: {
                        IsFullyAIGenerated: r.aiGenerationInfo.isFullyAIGenerated,
                        IsPartiallyAIGenerated: r.aiGenerationInfo.isPartiallyAIGenerated,
                        AIToolsUsed: {
                            AIToolUsed: r.aiGenerationInfo.aiToolsUsed
                        },
                        HumanContributionDescription: r.aiGenerationInfo.humanContributionDescription,
                        DisclosureType: r.aiGenerationInfo.disclosureType
                    }
                } : {})
            })),
        };
    }

    private buildResourceList(resources: IngestionNotificationMessage['resourceList']) {
        return {
            SoundRecording: resources.filter((r) => r.resourceType === 'SoundRecording').map((r) => ({
                '@_ResourceReference': r.resourceReference,
                ResourceId: {
                    ISRC: r.resourceId.isrc,
                },
                ReferenceTitle: {
                    TitleText: r.resourceTitle.titleText,
                },
                Duration: r.duration,
                SoundRecordingDetailsByTerritory: {
                    TerritoryCode: 'Worldwide',
                    Title: {
                        '@_TitleType': 'FormalTitle',
                        TitleText: r.resourceTitle.titleText,
                    },
                    DisplayArtistName: r.displayArtistName,
                    LanguageOfPerformance: r.soundRecordingDetails?.languageOfPerformance,
                    ImmersiveAudioProfile: r.soundRecordingDetails?.immersiveAudioProfile,
                    Lyrics: r.soundRecordingDetails?.lyrics ? {
                        LyricsText: { '#text': r.soundRecordingDetails.lyrics.lyricsText },
                        IsExplicit: r.soundRecordingDetails.lyrics.isExplicit
                    } : undefined,
                    BPM: r.soundRecordingDetails?.bpm,
                    Key: r.soundRecordingDetails?.key,
                    Energy: r.soundRecordingDetails?.energy
                },
            })),
            Image: resources.filter((r) => r.resourceType === 'Image').map((r) => ({
                '@_ResourceReference': r.resourceReference,
                ResourceId: {
                    ProprietaryId: {
                        '@_Namespace': r.resourceId.proprietaryId?.proprietaryIdType || 'LabelInternal',
                        Id: r.resourceId.proprietaryId?.id,
                    },
                },
                ReferenceTitle: {
                    TitleText: r.resourceTitle.titleText,
                },
                ImageDetailsByTerritory: {
                    TerritoryCode: 'Worldwide',
                    TechnicalImageDetails: (r.technicalDetails && r.technicalDetails[0]) ? {
                        FileAvailabilityDescription: {
                            FilePath: r.technicalDetails[0].fileName,
                        },
                    } : undefined,
                },
            })),
            Text: resources.filter((r) => r.resourceType === 'Text').map((r) => ({
                '@_ResourceReference': r.resourceReference,
                ResourceId: {
                    ProprietaryId: {
                        '@_Namespace': r.resourceId.proprietaryId?.proprietaryIdType || 'LabelInternal',
                        Id: r.resourceId.proprietaryId?.id,
                    },
                },
                ReferenceTitle: {
                    TitleText: r.resourceTitle.titleText,
                },
                TextDetailsByTerritory: {
                    TerritoryCode: 'Worldwide',
                    TextType: r.textDetails?.textType,
                    LanguageOfText: r.textDetails?.languageOfText,
                    ...(r.textDetails?.textContent ? { Text: r.textDetails.textContent } : {}),
                    ...(r.technicalDetails?.[0]?.fileName ? {
                        TechnicalTextDetails: {
                            FileAvailabilityDescription: {
                                FilePath: r.technicalDetails[0].fileName,
                            },
                        }
                    } : {})
                },
            })),
        };
    }

    private buildDealList(deals: IngestionNotificationMessage['dealList']) {
        return {
            ReleaseDeal: deals.map((d) => ({
                '@_DealReference': d.dealReference,
                Deal: {
                    DealTerms: {
                        CommercialModelType: d.dealTerms.commercialModelType,
                        Usage: d.dealTerms.usage.map((u) => ({
                            UseType: u.useType,
                        })),
                        TerritoryCode: d.dealTerms.territoryCode,
                        ValidityPeriod: {
                            StartDate: d.dealTerms.validityPeriod.startDate,
                            EndDate: d.dealTerms.validityPeriod.endDate,
                        },
                        ...(d.dealTerms.takeDown ? { TakeDown: true } : {}),
                        ...(d.youtubeContentIdPolicy ? {
                            ProprietaryExtension: {
                                ExtensionCode: 'YouTubeContentIdPolicy',
                                ExtensionPayload: d.youtubeContentIdPolicy,
                            },
                        } : {}),
                    },
                },
            })),
        };
    }
}

export const ddexBuilder = new DDEXBuilder();
