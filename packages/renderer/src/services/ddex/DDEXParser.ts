/**
 * DDEXParser
 * XML↔JSON conversion for DDEX messages
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { ERNMessage } from './types/ern';
import type { DSRReport } from './types/dsr';

// Parser options for DDEX XML
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: true,
  isArray: (tagName: string) => {
    // Tags that should always be arrays even with single elements
    const arrayTags = [
      'Release',
      'Resource',
      'Deal',
      'Contributor',
      'Territory',
      'Usage',
      'SalesTransaction',
      'UsageRecord',
      'ReleaseResourceReference',
      'ReleaseDetailsByTerritory',
    ];
    return arrayTags.includes(tagName);
  },
};

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

class DDEXParserImpl {
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser(parserOptions);
    this.builder = new XMLBuilder(builderOptions);
  }

  /**
   * Parse ERN XML to JSON
   */
  parseERN(xml: string): { success: boolean; data?: ERNMessage; error?: string } {
    try {
      const parsed = this.parser.parse(xml);

      // Navigate to the ERN root element
      const ernRoot = parsed['ern:NewReleaseMessage'] ||
        parsed['NewReleaseMessage'] ||
        parsed['ern:PurgeReleaseMessage'] ||
        parsed['PurgeReleaseMessage'];

      if (!ernRoot) {
        return {
          success: false,
          error: 'Invalid ERN: Missing root element (NewReleaseMessage or PurgeReleaseMessage)',
        };
      }

      // Map to our ERN type structure
      let action: 'NewRelease' | 'Update' | 'Takedown' = 'NewRelease';
      if (parsed['ern:PurgeReleaseMessage'] || parsed['PurgeReleaseMessage']) action = 'Takedown';
      else if (ernRoot.UpdateIndicator === 'UpdateMessage' || ernRoot['@_UpdateIndicator'] === 'UpdateMessage') action = 'Update';

      const ern: ERNMessage = {
        action,
        messageSchemaVersionId: ernRoot['@_MessageSchemaVersionId'] || '4.3',
        messageHeader: this.parseMessageHeader(ernRoot.MessageHeader),
        releaseList: this.parseReleaseList(ernRoot.ReleaseList),
        resourceList: this.parseResourceList(ernRoot.ResourceList),
        dealList: this.parseDealList(ernRoot.DealList),
      };

      return { success: true, data: ern };
    } catch (error: unknown) {
      return {
        success: false,
        error: `ERN parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Build ERN XML from JSON
   */
  buildERN(ern: ERNMessage): string {
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

  /**
   * Parse DSR flat file (tab-separated)
   */
  parseDSR(content: string): { success: boolean; data?: DSRReport; error?: string } {
    try {
      const lines = content.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        return { success: false, error: 'DSR file too short' };
      }

      // Parse header line
      const headers = lines[0]!.split('\t');

      // Parse data lines
      const transactions = lines.slice(1).map((line, index) => {
        const values = line.split('\t');
        const record: Record<string, string> = {};
        headers.forEach((header, i) => {
          record[header.trim()] = values[i]?.trim() || '';
        });
        return this.mapDSRRecord(record, index);
      });

      // Calculate summary
      const totalUsageCount = transactions.reduce((sum, t) => sum + t.usageCount, 0);
      const totalRevenue = transactions.reduce((sum, t) => sum + t.revenueAmount, 0);
      const totalStreams = transactions.filter(
        (t) => t.usageType === 'OnDemandStream' || t.usageType === 'ProgrammedStream'
      ).reduce((sum, t) => sum + t.usageCount, 0);
      const totalDownloads = transactions.filter(
        (t) => t.usageType === 'Download'
      ).reduce((sum, t) => sum + t.usageCount, 0);

      const report: DSRReport = {
        reportId: `DSR-${Date.now()}`,
        senderId: '', // Extract from file if available
        recipientId: '',
        reportingPeriod: {
          startDate: '', // Extract from file
          endDate: '',
        },
        reportCreatedDateTime: new Date().toISOString(),
        currencyCode: 'USD',
        summary: {
          totalUsageCount,
          totalRevenue,
          totalStreams,
          totalDownloads,
          currencyCode: 'USD',
        },
        transactions,
      };

      return { success: true, data: report };
    } catch (error: unknown) {
      return {
        success: false,
        error: `DSR parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Private helper methods

  private parseMessageHeader(header: Record<string, unknown>) {
    return {
      messageId: String(header?.MessageId || ''),
      messageThreadId: header?.MessageThreadId ? String(header.MessageThreadId) : undefined,
      messageSender: {
        partyId: String((header?.MessageSender as Record<string, unknown>)?.PartyId || ''),
        partyName: String((header?.MessageSender as Record<string, unknown>)?.PartyName || ''),
      },
      messageRecipient: {
        partyId: String((header?.MessageRecipient as Record<string, unknown>)?.PartyId || ''),
        partyName: String((header?.MessageRecipient as Record<string, unknown>)?.PartyName || ''),
      },
      messageCreatedDateTime: String(header?.MessageCreatedDateTime || ''),
      messageControlType: header?.MessageControlType as 'LiveMessage' | 'TestMessage' | undefined,
    };
  }

  private buildMessageHeader(header: ERNMessage['messageHeader']) {
    return {
      MessageThreadId: header.messageThreadId,
      MessageId: header.messageId,
      MessageSender: {
        PartyId: header.messageSender.partyId,
        PartyName: { '#text': header.messageSender.partyName },
      },
      MessageRecipient: {
        PartyId: header.messageRecipient.partyId,
        PartyName: { '#text': header.messageRecipient.partyName },
      },
      MessageCreatedDateTime: header.messageCreatedDateTime,
      MessageControlType: header.messageControlType,
    };
  }

  private parseReleaseList(releaseList: Record<string, unknown>): ERNMessage['releaseList'] {
    const releases = releaseList?.Release;
    if (!releases) return [];

    const releaseArray = Array.isArray(releases) ? releases : [releases];
    return releaseArray.map((r: Record<string, unknown>) => {
      const detailsByTerritory = (r?.ReleaseDetailsByTerritory as Record<string, unknown>[] | Record<string, unknown> | undefined);
      const firstTerritory = Array.isArray(detailsByTerritory) ? detailsByTerritory[0] : detailsByTerritory;

      const titleObj = (firstTerritory?.Title as Record<string, unknown>);

      const aiInfo = (r?.AIGenerationInfo as Record<string, unknown> | undefined);
      const aiTools = (aiInfo?.AIToolsUsed as Record<string, unknown> | undefined);

      return {
        releaseId: {
          icpn: String((r?.ReleaseId as Record<string, unknown>)?.ICPN || ''),
          isrc: String((r?.ReleaseId as Record<string, unknown>)?.ISRC || ''),
          catalogNumber: String((r?.ReleaseId as Record<string, unknown>)?.CatalogNumber || ''),
        },
        releaseReference: String(r?.ReleaseReference || ''),
        releaseType: String(r?.ReleaseType || 'Single') as ERNMessage['releaseList'][0]['releaseType'],
        releaseTitle: {
          titleText: String(titleObj?.TitleText || ''),
        },
        displayArtistName: String(firstTerritory?.DisplayArtistName || ''),
        contributors: [],
        labelName: String(firstTerritory?.LabelName || ''),
        genre: { genre: String((firstTerritory?.Genre as Record<string, unknown>)?.GenreText || '') },
        parentalWarningType: 'NoAdviceAvailable' as const,
        releaseResourceReferenceList: [],
        aiGenerationInfo: aiInfo ? {
          isFullyAIGenerated: aiInfo.IsFullyAIGenerated === true || aiInfo.IsFullyAIGenerated === 'true',
          isPartiallyAIGenerated: aiInfo.IsPartiallyAIGenerated === true || aiInfo.IsPartiallyAIGenerated === 'true',
          aiToolsUsed: aiTools?.AIToolUsed
            ? Array.isArray(aiTools.AIToolUsed)
              ? aiTools.AIToolUsed.map(String)
              : [String(aiTools.AIToolUsed)]
            : [],
          humanContributionDescription: String(aiInfo.HumanContributionDescription || '')
        } : undefined
      };
    });
  }

  private buildReleaseList(releases: ERNMessage['releaseList']) {
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
            HumanContributionDescription: r.aiGenerationInfo.humanContributionDescription
          }
        } : {})
      })),
    };
  }

  private parseResourceList(resourceList: Record<string, unknown>): ERNMessage['resourceList'] {
    if (!resourceList) return [];

    const resources: ERNMessage['resourceList'] = [];

    // Parse SoundRecordings
    if (resourceList.SoundRecording) {
      const recordings = Array.isArray(resourceList.SoundRecording)
        ? resourceList.SoundRecording
        : [resourceList.SoundRecording];

      recordings.forEach((r: unknown) => {
        const rec = r as Record<string, unknown>;
        const detailsByTerritory = (rec.SoundRecordingDetailsByTerritory as Record<string, unknown>[] | Record<string, unknown> | undefined);
        const details = Array.isArray(detailsByTerritory) ? detailsByTerritory[0] : detailsByTerritory;

        const lyrics = (details?.Lyrics as Record<string, unknown> | undefined);
        const lyricsText = lyrics?.LyricsText;

        resources.push({
          resourceReference: String(rec['@_ResourceReference'] || ''),
          resourceType: 'SoundRecording',
          resourceId: {
            isrc: String((rec.ResourceId as Record<string, unknown>)?.ISRC || '')
          },
          resourceTitle: {
            titleText: String((rec.ReferenceTitle as Record<string, unknown>)?.TitleText || '')
          },
          duration: String(rec.Duration || ''),
          displayArtistName: String(details?.DisplayArtistName || ''),
          contributors: [],
          soundRecordingDetails: {
            soundRecordingType: 'MusicalWorkSoundRecording',
            isInstrumental: false,
            languageOfPerformance: details?.LanguageOfPerformance ? String(details.LanguageOfPerformance) : undefined,
            immersiveAudioProfile: details?.ImmersiveAudioProfile as 'DolbyAtmos' | 'Sony360' | 'None' | undefined,
            lyrics: lyrics ? {
              lyricsText: typeof lyricsText === 'object' && lyricsText !== null ? String((lyricsText as Record<string, unknown>)['#text'] || '') : String(lyricsText || ''),
              isExplicit: lyrics.IsExplicit === true
            } : undefined
          }
        });
      });
    }

    // Parse Text Resources
    if (resourceList.Text) {
      const texts = Array.isArray(resourceList.Text)
        ? resourceList.Text
        : [resourceList.Text];

      texts.forEach((r: unknown) => {
        const txt = r as Record<string, unknown>;
        const resId = (txt.ResourceId as Record<string, unknown> | undefined);
        const propId = (resId?.ProprietaryId as Record<string, unknown> | undefined);
        const detailsByTerritory = (txt.TextDetailsByTerritory as Record<string, unknown>[] | Record<string, unknown> | undefined);
        const details = Array.isArray(detailsByTerritory) ? detailsByTerritory[0] : detailsByTerritory;

        resources.push({
          resourceReference: String(txt['@_ResourceReference'] || ''),
          resourceType: 'Text',
          resourceId: {
            proprietaryId: {
              proprietaryIdType: 'LabelInternal',
              id: String(propId?.Id || '')
            }
          },
          resourceTitle: {
            titleText: String((txt.ReferenceTitle as Record<string, unknown>)?.TitleText || '')
          },
          displayArtistName: '',
          contributors: [],
          textDetails: {
            textType: (details?.TextType as 'Lyrics' | 'LinerNotes') || 'Lyrics',
            languageOfText: details?.LanguageOfText ? String(details.LanguageOfText) : undefined,
            textContent: details?.Text ? String(details.Text) : undefined
          },
          technicalDetails: {
            fileName: String(((details?.TechnicalTextDetails as Record<string, unknown>)?.FileAvailabilityDescription as Record<string, unknown>)?.FilePath || '') || undefined
          }
        });
      });
    }

    // Parse Images
    if (resourceList.Image) {
      const images = Array.isArray(resourceList.Image)
        ? resourceList.Image
        : [resourceList.Image];

      images.forEach((r: unknown) => {
        const img = r as Record<string, unknown>;
        const resId = (img.ResourceId as Record<string, unknown> | undefined);
        const propId = (resId?.ProprietaryId as Record<string, unknown> | undefined);

        resources.push({
          resourceReference: String(img['@_ResourceReference'] || ''),
          resourceType: 'Image',
          resourceId: {
            proprietaryId: {
              proprietaryIdType: 'LabelInternal',
              id: String(propId?.Id || '')
            }
          },
          resourceTitle: {
            titleText: 'Front Cover Image'
          },
          displayArtistName: '',
          contributors: []
        });
      });
    }

    return resources;
  }

  private buildResourceList(resources: ERNMessage['resourceList']) {
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
          TechnicalImageDetails: r.technicalDetails ? {
            FileAvailabilityDescription: {
              FilePath: r.technicalDetails.fileName,
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
          ...(r.technicalDetails ? {
            TechnicalTextDetails: {
              FileAvailabilityDescription: {
                FilePath: r.technicalDetails.fileName,
              },
            }
          } : {})
        },
      })),
    };
  }

  private parseDealList(dealList: Record<string, unknown> | null | undefined): ERNMessage['dealList'] {
    if (!dealList || !dealList.ReleaseDeal) return [];

    const releaseDeals = Array.isArray(dealList.ReleaseDeal)
      ? (dealList.ReleaseDeal as Record<string, unknown>[])
      : [dealList.ReleaseDeal as Record<string, unknown>];

    return releaseDeals.map((rd) => {
      const dealsArray = Array.isArray(rd.Deal) ? rd.Deal : [rd.Deal || {}];
      const deal = dealsArray[0] as Record<string, unknown>;
      const dealTermsArray = Array.isArray(deal.DealTerms) ? deal.DealTerms : [deal.DealTerms || {}];
      const dealTerms = dealTermsArray[0] as Record<string, unknown>;
      const usage = (dealTerms.Usage || []) as Record<string, unknown>[];
      let youtubeContentIdPolicy: string | undefined = undefined;
      if (dealTerms.ProprietaryExtension) {
        const propExt = dealTerms.ProprietaryExtension as Record<string, unknown>;
        if (propExt.ExtensionCode === 'YouTubeContentIdPolicy') {
          youtubeContentIdPolicy = String(propExt.ExtensionPayload || '');
        }
      }

      return {
        dealReference: String(rd['@_DealReference'] || ''),
        dealTerms: {
          commercialModelType: (dealTerms.CommercialModelType as ERNMessage['dealList'][0]['dealTerms']['commercialModelType']) || 'SubscriptionModel',
          usage: (Array.isArray(usage) ? usage : [usage]).map((u) => ({
            useType: (u.UseType as ERNMessage['dealList'][0]['dealTerms']['usage'][0]['useType']) || 'OnDemandStream',
          })),
          territoryCode: (Array.isArray(dealTerms.TerritoryCode) ? dealTerms.TerritoryCode : [dealTerms.TerritoryCode]) as string[],
          validityPeriod: {
            startDate: String(dealTerms.ValidityPeriod ? (dealTerms.ValidityPeriod as Record<string, unknown>).StartDate : ''),
            endDate: dealTerms.ValidityPeriod ? String((dealTerms.ValidityPeriod as Record<string, unknown>).EndDate || '') || undefined : undefined,
          },
          takeDown: dealTerms.TakeDown === true || dealTerms.TakeDown === 'true' || undefined,
        },
        youtubeContentIdPolicy
      };
    });
  }

  private buildDealList(deals: ERNMessage['dealList']) {
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

  private mapDSRRecord(record: Record<string, string>, index: number) {
    return {
      transactionId: record['TransactionId'] || `TX-${index}`,
      resourceId: {
        isrc: record['ISRC'] || record['ResourceISRC'],
        title: record['Title'] || record['TrackTitle'],
      },
      usageType: this.mapUsageType(record['UsageType'] || record['TransactionType'] || ''),
      usageCount: parseInt(record['UsageCount'] || record['Quantity'] || '0', 10),
      revenueAmount: parseFloat(record['Revenue'] || record['Amount'] || '0'),
      currencyCode: record['Currency'] || 'USD',
      territoryCode: record['Territory'] || record['Country'] || 'US',
      serviceName: record['ServiceName'] || record['DSP'],
    };
  }

  private mapUsageType(type: string): 'OnDemandStream' | 'ProgrammedStream' | 'Download' | 'Other' {
    const normalized = type.toLowerCase();
    if (normalized.includes('stream')) return 'OnDemandStream';
    if (normalized.includes('download')) return 'Download';
    return 'Other';
  }
}

// Export singleton
export const DDEXParser = new DDEXParserImpl();
