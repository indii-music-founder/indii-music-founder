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
        parsed['ern:PurgeReleaseMessage'];

      if (!ernRoot) {
        return {
          success: false,
          error: 'Invalid ERN: Missing root element (NewReleaseMessage or PurgeReleaseMessage)',
        };
      }

      // Map to our ERN type structure
      const ern: ERNMessage = {
        messageSchemaVersionId: ernRoot['@_MessageSchemaVersionId'] || '4.3',
        messageHeader: this.parseMessageHeader(ernRoot.MessageHeader),
        releaseList: this.parseReleaseList(ernRoot.ReleaseList),
        resourceList: this.parseResourceList(ernRoot.ResourceList),
        dealList: this.parseDealList(ernRoot.DealList),
      };

      return { success: true, data: ern };
    } catch (error) {
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
    const xmlObj = {
      'ern:NewReleaseMessage': {
        '@_xmlns:ern': 'http://ddex.net/xml/ern/43',
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_MessageSchemaVersionId': ern.messageSchemaVersionId,
        '@_LanguageAndScriptCode': 'en',
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
      const headers = lines[0].split('\t');

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
    } catch (error) {
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

  private parseReleaseList(releaseList: Record<string, unknown>) {
    const releases = releaseList?.Release;
    if (!releases) return [];

    const releaseArray = Array.isArray(releases) ? releases : [releases];
    return releaseArray.map((r: Record<string, unknown>) => ({
      releaseId: {
        icpn: String((r?.ReleaseId as Record<string, unknown>)?.ICPN || ''),
        isrc: String((r?.ReleaseId as Record<string, unknown>)?.ISRC || ''),
        catalogNumber: String((r?.ReleaseId as Record<string, unknown>)?.CatalogNumber || ''),
      },
      releaseReference: String(r?.ReleaseReference || ''),
      releaseType: String(r?.ReleaseType || 'Single') as ERNMessage['releaseList'][0]['releaseType'],
      releaseTitle: {
        titleText: String(((r?.ReleaseDetailsByTerritory as Record<string, unknown>)?.Title as Record<string, unknown>)?.TitleText || ''),
      },
      displayArtistName: String((r?.ReleaseDetailsByTerritory as Record<string, unknown>)?.DisplayArtistName || ''),
      contributors: [],
      labelName: String((r?.ReleaseDetailsByTerritory as Record<string, unknown>)?.LabelName || ''),
      genre: { genre: String(((r?.ReleaseDetailsByTerritory as Record<string, unknown>)?.Genre as Record<string, unknown>)?.GenreText || '') },
      parentalWarningType: 'NoAdviceAvailable' as const,
      releaseResourceReferenceList: [],
    }));
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
          Genre: { GenreText: r.genre.genre },
          ParentalWarningType: r.parentalWarningType,
        },
        ReleaseType: r.releaseType,
        ReleaseResourceReferenceList: {
          ReleaseResourceReference: r.releaseResourceReferenceList,
        },
      })),
    };
  }

  private parseResourceList(resourceList: Record<string, unknown>) {
    // Simplified parsing - expand as needed
    return [];
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
        },
      })),
      Image: resources.filter((r) => r.resourceType === 'Image').map((r) => ({
        '@_ResourceReference': r.resourceReference,
        ImageDetailsByTerritory: {
          TerritoryCode: 'Worldwide',
        },
      })),
    };
  }

  private parseDealList(dealList: Record<string, unknown>) {
    // Simplified parsing - expand as needed
    return [];
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
      usageType: this.mapUsageType(record['UsageType'] || record['TransactionType']),
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
