import { SalesAnalyticsData } from './schema';

export const MOCK_SALES_ANALYTICS: SalesAnalyticsData = {
    conversionRate: { value: 4.2, change: 0.5, trend: 'up', formatted: '4.2%' },
    totalVisitors: { value: 12500, change: 12, trend: 'up', formatted: '12.5k' },
    clickRate: { value: 18.3, change: 0, trend: 'neutral', formatted: '18.3%' },
    avgOrderValue: { value: 24.00, change: 2, trend: 'up', formatted: '$24.00' },
    revenueChart: [30, 45, 35, 60, 55, 70, 65, 80, 75, 90],
    period: '30d' // This might be overwritten by the service depending on the requested period
};
