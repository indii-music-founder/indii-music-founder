import { db } from '@/services/firebase';
import { Purchase } from '@/services/marketplace/types';
import { SocialPost } from '@/services/social/types';

// Mock Data Types
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
    // Mock: Get main revenue statistics
    getStats: async (userId: string): Promise<RevenueStats> => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Return mock data for now
        return {
            totalRevenue: 12450.00,
            pendingPayout: 1250.00,
            lastPayout: 4500.00,
            totalSales: 342,
            averageOrderValue: 36.40
        };
    },

    // Mock: Get chart data for the last 30 days
    getChartData: async (userId: string, period: 'week' | 'month' | 'year' = 'month'): Promise<RevenueChartData[]> => {
        await new Promise(resolve => setTimeout(resolve, 600));

        const data: RevenueChartData[] = [];
        const now = new Date();
        const days = period === 'week' ? 7 : 30;

        for (let i = days; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            // Random daily revenue between $50 and $500
            const randomAmount = Math.floor(Math.random() * 450) + 50;

            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                amount: randomAmount
            });
        }

        return data;
    },

    // Mock: Get recent sales transactions
    getRecentSales: async (userId: string, limit: number = 5): Promise<RecentSale[]> => {
        await new Promise(resolve => setTimeout(resolve, 700));

        const mockSales: RecentSale[] = [
            {
                id: 'tx_1',
                productName: 'Midnight Vibes LP (Vinyl)',
                customerName: 'Sarah Jenkins',
                amount: 35.00,
                date: Date.now() - 1000 * 60 * 30, // 30 mins ago
                status: 'completed'
            },
            {
                id: 'tx_2',
                productName: 'Digital Discography',
                customerName: 'Mike Chen',
                amount: 15.00,
                date: Date.now() - 1000 * 60 * 60 * 4, // 4 hours ago
                status: 'completed'
            },
            {
                id: 'tx_3',
                productName: 'Exclusive Hoodie',
                customerName: 'Alex Rivera',
                amount: 65.00,
                date: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
                status: 'pending'
            },
            {
                id: 'tx_4',
                productName: 'Backstage Pass NFT',
                customerName: 'CryptoFan_99',
                amount: 150.00,
                date: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
                status: 'completed'
            },
            {
                id: 'tx_5',
                productName: 'Sticker Pack',
                customerName: 'Jenny Low',
                amount: 10.00,
                date: Date.now() - 1000 * 60 * 60 * 72, // 3 days ago
                status: 'completed'
            }
        ];

        return mockSales.slice(0, limit);
    }
};
