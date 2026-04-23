import { ExtendedGoldenMetadata, Deal } from './types';

/**
 * Maps metadata to ERN deal structures.
 */
export class ERNMapper {
      /**
       * Maps metadata to ERN deals.
       * @param metadata Extended metadata containing distribution channels
       * @returns List of ERN deals
       */
    static getDeals(metadata: ExtendedGoldenMetadata): Deal[] {
              return this.buildDeals(metadata);
    }

    /**
       * Builds deals based on metadata.
       * @param metadata Extended metadata
       * @returns List of deals
       */
    private static buildDeals(metadata: ExtendedGoldenMetadata): Deal[] {
              const deals: Deal[] = [];
              const distributionChannels = metadata.distributionChannels || [];

          const addDeal = (model: string, type: string, use: string) => {
                        deals.push({
                                          model,
                                          type,
                                          use,
                                          territories: ['Worldwide'],
                                          startDate: new Date().toISOString().split('T')[0]
                        });
          };

          // 1. Streaming Deals
          if (distributionChannels.includes('streaming')) {
                        // Subscription Streaming
                  addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');

                  // Ad-Supported Streaming
                  addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
          }

          // 2. Download Deals
          if (distributionChannels.includes('download')) {
                        // Permanent Download
                  addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
          }

          // 3. Physical Deals
          if (distributionChannels.includes('physical')) {
                        addDeal('PayAsYouGoModel', 'PhysicalProduct', 'Physical');
          }

          // Fallback: If no digital deal types were added, default to Streaming + Download
          // Per requirement, if only physical was added, we fallback to digital as well
          if (deals.length === 0 || (deals.length === 1 && distributionChannels.includes('physical') && distributionChannels.length === 1)) {
                        if (deals.length === 1) {
                                          deals.length = 0; // Remove physical if it's the only one and we are falling back
                        }
                        addDeal('SubscriptionModel', 'OnDemandStream', 'Stream');
                        addDeal('PayAsYouGoModel', 'PermanentDownload', 'Download');
                        addDeal('AdvertisementSupportedModel', 'OnDemandStream', 'Stream');
          }

          return deals;
    }
}
