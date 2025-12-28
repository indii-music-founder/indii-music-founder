// Revenue Service Types
export interface RevenueStats {
    totalRevenue: number;
    pendingPayout: number;
    lastPayout: number;
    totalSales: number;
    averageOrderValue: number;
}

export interface RevenueChartData {
    date: string;
    amount: number;
}

export interface RecentSale {
    id: string;
    productName: string;
    customerName: string;
    amount: number;
    date: number; // Timestamp
    status: 'completed' | 'pending' | 'refunded';
    productImage?: string;
}

export const RevenueService = {
    // TODO: Replace with real Firestore/Stripe integration when backend is ready
    getStats: async (userId: string): Promise<RevenueStats> => {
        // Return empty data until real backend integration
        return {
            totalRevenue: 0,
            pendingPayout: 0,
            lastPayout: 0,
            totalSales: 0,
            averageOrderValue: 0
        };
    },

    // TODO: Replace with real analytics when backend is ready
    getChartData: async (userId: string, period: 'week' | 'month' | 'year' = 'month'): Promise<RevenueChartData[]> => {
        // Return empty chart data until real backend integration
        return [];
    },

    // TODO: Replace with real Firestore query when backend is ready
    getRecentSales: async (userId: string, limit: number = 5): Promise<RecentSale[]> => {
        // Return empty until real backend integration
        return [];
    }
};
