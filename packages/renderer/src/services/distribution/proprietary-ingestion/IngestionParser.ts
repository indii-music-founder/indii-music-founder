/**
 * IngestionParser
 * XML↔JSON conversion for Ingestion messages
 */

import { XMLParser } from 'fast-xml-parser';
import type { IngestionNotificationMessage } from './types/ern';
import type { EarningsReportReport } from './types/dsr';

// Parser options for Ingestion XML
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

class IngestionParserImpl {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser(parserOptions);
  }

  /**
   * Parse IngestionNotification XML to JSON
   */
  parseIngestionNotification(xml: string): { success: boolean; data?: IngestionNotificationMessage; error?: string } {
    try {
      const parsed = this.parser.parse(xml);

      // Navigate to the IngestionNotification root element
      const ernRoot = parsed['ern:NewReleaseMessage'] ||
        parsed['NewReleaseMessage'] ||
        parsed['ern:PurgeReleaseMessage'] ||
        parsed['PurgeReleaseMessage'];

      if (!ernRoot) {
        return {
          success: false,
          error: 'Invalid IngestionNotification: Missing root element (NewReleaseMessage or PurgeReleaseMessage)',
        };
      }

      // Map to our IngestionNotification type structure
      let action: 'NewRelease' | 'Update' | 'Takedown' = 'NewRelease';
      if (parsed['ern:PurgeReleaseMessage'] || parsed['PurgeReleaseMessage']) action = 'Takedown';
      else if (ernRoot.UpdateIndicator === 'UpdateMessage' || ernRoot['@_UpdateIndicator'] === 'UpdateMessage') action = 'Update';

      const ern: IngestionNotificationMessage = {
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
        error: `IngestionNotification parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }


  /**
   * Parse EarningsReport flat file (tab-separated)
   */
  parseEarningsReport(content: string): { success: boolean; data?: EarningsReportReport; error?: string } {
    try {
      const lines = content.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        return { success: false, error: 'EarningsReport file too short' };
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
        return this.mapEarningsReportRecord(record, index);
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

      const report: EarningsReportReport = {
        reportId: `EarningsReport-${Date.now()}`,
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
        error: `EarningsReport parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Private helper methods

  private parseMessageHeader(header: Record<string, unknown>) {
    return {
      messageId: String(header?.MessageId || ''),
      messageThreadId: header?.MessageThreadId ? String(header.MessageThreadId) : undefined,
      messageSender: {
        systemIdentifier: String((header?.MessageSender as Record<string, unknown>)?.SystemIdentifier || ''),
        entityName: String((header?.MessageSender as Record<string, unknown>)?.EntityName || ''),
      },
      messageRecipient: {
        systemIdentifier: String((header?.MessageRecipient as Record<string, unknown>)?.SystemIdentifier || ''),
        entityName: String((header?.MessageRecipient as Record<string, unknown>)?.EntityName || ''),
      },
      messageCreatedDateTime: String(header?.MessageCreatedDateTime || ''),
      messageControlType: header?.MessageControlType as 'LiveMessage' | 'TestMessage' | undefined,
    };
  }


  private parseReleaseList(releaseList: Record<string, unknown>): IngestionNotificationMessage['releaseList'] {
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
        releaseType: String(r?.ReleaseType || 'Single') as IngestionNotificationMessage['releaseList'][0]['releaseType'],
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


  private parseResourceList(resourceList: Record<string, unknown>): IngestionNotificationMessage['resourceList'] {
    if (!resourceList) return [];

    const resources: IngestionNotificationMessage['resourceList'] = [];

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
              proprietaryIdType: String(propId?.['@_Namespace'] || 'LabelInternal'),
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
          ...(() => {
            const filePath = String(((details?.TechnicalTextDetails as Record<string, unknown>)?.FileAvailabilityDescription as Record<string, unknown>)?.FilePath || '');
            return filePath ? { technicalDetails: [{ fileName: filePath }] } : {};
          })()
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

  private parseDealList(dealList: Record<string, unknown> | null | undefined): IngestionNotificationMessage['dealList'] {
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
          commercialModelType: (dealTerms.CommercialModelType as IngestionNotificationMessage['dealList'][0]['dealTerms']['commercialModelType']) || 'SubscriptionModel',
          usage: (Array.isArray(usage) ? usage : [usage]).map((u) => ({
            useType: (u.UseType as IngestionNotificationMessage['dealList'][0]['dealTerms']['usage'][0]['useType']) || 'OnDemandStream',
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


  private mapEarningsReportRecord(record: Record<string, string>, index: number) {
    return {
      transactionId: record['TransactionId'] || record['TransactionID'] || record['ID'] || `TX-${index}`,
      resourceId: {
        isrc: record['ISRC'] || record['ResourceISRC'] || record['RecordingISRC'],
        title: record['Title'] || record['TrackTitle'] || record['ResourceTitle'],
      },
      usageType: this.mapUsageType(record['UsageType'] || record['TransactionType'] || record['Usage'] || ''),
      usageCount: parseInt(record['UsageCount'] || record['Quantity'] || record['Units'] || '0', 10),
      revenueAmount: parseFloat(record['Revenue'] || record['Amount'] || record['TotalRevenue'] || record['NetRevenue'] || '0'),
      currencyCode: record['Currency'] || record['CurrencyCode'] || 'USD',
      territoryCode: record['Territory'] || record['Country'] || record['TerritoryCode'] || 'US',
      serviceName: record['ServiceName'] || record['DSP'] || record['StoreName'] || record['Platform'],
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
export const IngestionParser = new IngestionParserImpl();
