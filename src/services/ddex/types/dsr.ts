export interface EarningsSummary {
    period: {
        startDate: string;
        endDate: string;
    };
    totalGrossRevenue: number;
    totalNetRevenue: number;
    totalStreams: number;
    totalDownloads: number;
    currencyCode: string;
    byPlatform: {
        platformName: string;
        revenue: number;
        streams: number;
        downloads: number;
    }[];
    byTerritory: {
        territoryCode: string;
        territoryName: string;
        revenue: number;
        streams: number;
        downloads: number;
    }[];
    byRelease: ReleaseEarnings[];
}

export interface ReleaseEarnings {
    releaseId: string;
    releaseName: string;
    revenue: number;
    streams: number;
    downloads: number;
}

export interface DSRReport {
    reportId: string;
    senderId: string;
    recipientId: string;
    startDate: string; // Deprecated by reportingPeriod in parser? Keep for compatibility
    endDate: string; // Deprecated
    reportingPeriod: {
        startDate: string;
        endDate: string;
    };
    currency: string; // Deprecated
    currencyCode: string;
    transactions: DSRTransaction[];
    summary: {
        totalRevenue: number;
        totalUsageCount: number;
    };
}

export interface DSRTransaction {
    transactionId: string;
    resourceId: {
        isrc?: string;
        upc?: string;
    };
    releaseTitle?: string;
    trackTitle?: string;
    artistName?: string;
    territoryCode: string;
    serviceName?: string;
    usageType: 'OnDemandStream' | 'ProgrammedStream' | 'Download' | 'RingtoneDownload' | 'Unknown';
    usageCount: number; // Renamed from quantity
    revenueAmount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
}

export interface RoyaltyCalculation {
    releaseId: string;
    resourceId: string;
    isrc: string;
    totalStreams: number;
    totalDownloads: number;
    grossRevenue: number;
    platformFees: number;
    distributorFees: number;
    netRevenue: number;
    contributorPayments: ContributorPayment[];
    period: {
        startDate: string;
        endDate: string;
    };
    currencyCode: string;
}

export interface ContributorPayment {
    contributorId: string;
    contributorName: string;
    role: string;
    splitPercentage: number;
    grossAmount: number;
    netAmount: number;
    paymentStatus: 'pending' | 'paid';
}
