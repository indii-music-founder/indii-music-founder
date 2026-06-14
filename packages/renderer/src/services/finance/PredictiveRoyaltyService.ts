import { RoyaltyEscalator } from './LabelDealRecoupmentService';

export interface ForecastPoint {
    date: string;
    predictedRevenue: number;
    lowerBound: number;
    upperBound: number;
}

export interface HorizonResult {
    estimatedRecoupmentDate: string | null;
    confidence: 'low' | 'medium' | 'high';
    projected12MonthRoi: number;
    forecast: ForecastPoint[];
    daysToRecoup: number | null;
}

export class PredictiveRoyaltyService {
    /**
     * Fit a linear regression line: y = mx + c
     * where x is timestamp or index, y is transaction amount.
     */
    private fitLinear(x: number[], y: number[]): { m: number; c: number } {
        const n = x.length;
        if (n === 0) return { m: 0, c: 0 };
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += x[i]!;
            sumY += y[i]!;
            sumXY += x[i]! * y[i]!;
            sumXX += x[i]! * x[i]!;
        }
        const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
        const c = (sumY - m * sumX) / n;
        return { m, c };
    }

    /**
     * Calculates the recoupment horizon date and ROI projections using linear trend forecast
     */
    public calculateHorizon(
        historicalEarnings: { date: string; amount: number }[],
        recoupmentThreshold: number,
        currentRecouped: number,
        escalators: RoyaltyEscalator[],
        royaltyRatePreRecoup: number,
        royaltyRatePostRecoup: number,
        horizonDays: number = 365
    ): HorizonResult {
        // Fallback for insufficient historical data
        if (historicalEarnings.length < 3) {
            return {
                estimatedRecoupmentDate: null,
                confidence: 'low',
                projected12MonthRoi: 0,
                forecast: [],
                daysToRecoup: null
            };
        }

        // Sort earnings chronologically to fit regression model correctly
        const sortedHistory = [...historicalEarnings].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const x = sortedHistory.map((_, idx) => idx);
        const y = sortedHistory.map(e => e.amount);
        const { m, c } = this.fitLinear(x, y);

        const forecast: ForecastPoint[] = [];
        let cumulativeRecouped = currentRecouped;
        let daysToRecoup: number | null = null;
        
        // Start date for projection is the day after the last transaction date (or today)
        const lastTxDateStr = sortedHistory[sortedHistory.length - 1]?.date;
        const baseDate = lastTxDateStr ? new Date(lastTxDateStr) : new Date();

        for (let d = 1; d <= horizonDays; d++) {
            const nextDate = new Date(baseDate);
            nextDate.setDate(nextDate.getDate() + d);
            const dateStr = nextDate.toISOString().split('T')[0]!;

            // Calculate trend-based daily predicted revenue
            // Since transactions might be monthly/weekly, we assume m and c match the average step interval in the history.
            // If average interval is ~30 days, we scale the day index step accordingly.
            const totalHistoryDays = (new Date(sortedHistory[sortedHistory.length - 1]!.date).getTime() - new Date(sortedHistory[0]!.date).getTime()) / (1000 * 60 * 60 * 24) || 1;
            const avgIntervalDays = totalHistoryDays / sortedHistory.length;
            const stepValue = sortedHistory.length - 1 + (d / (avgIntervalDays || 1));

            const predictedRevenue = Math.max(0, m * stepValue + c) / (avgIntervalDays || 1);
            
            const uncertainty = 0.10 + (d / horizonDays) * 0.15;
            const lowerBound = Math.max(0, predictedRevenue * (1 - uncertainty));
            const upperBound = predictedRevenue * (1 + uncertainty);

            forecast.push({
                date: dateStr,
                predictedRevenue,
                lowerBound,
                upperBound
            });

            // Simulate recoupment progress
            if (cumulativeRecouped < recoupmentThreshold) {
                // Determine rate based on recoupment status & escalators
                const isRecouped = cumulativeRecouped >= recoupmentThreshold;
                let effectiveRate = isRecouped ? royaltyRatePostRecoup : royaltyRatePreRecoup;

                // Evaluate escalators (escalators mapped to cumulative revenue threshold)
                for (const escalator of escalators) {
                    if (escalator.unitType === 'revenue' && cumulativeRecouped >= escalator.unitThreshold) {
                        effectiveRate = escalator.newRate;
                    }
                }

                // Cumulative recouped receives effective royalty rate percentage of the revenue
                const contribution = predictedRevenue * (effectiveRate / 100);
                cumulativeRecouped += contribution;

                if (cumulativeRecouped >= recoupmentThreshold && daysToRecoup === null) {
                    daysToRecoup = d;
                }
            }
        }

        const estimatedRecoupmentDate = daysToRecoup !== null
            ? new Date(baseDate.getTime() + daysToRecoup * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
            : null;

        const confidence = historicalEarnings.length > 15 ? 'high' : 'medium';
        const projected12MonthRoi = recoupmentThreshold > 0 ? (cumulativeRecouped / recoupmentThreshold) * 100 : 0;

        return {
            estimatedRecoupmentDate,
            confidence,
            projected12MonthRoi: Math.round(projected12MonthRoi * 100) / 100,
            forecast,
            daysToRecoup
        };
    }
}

export const predictiveRoyaltyService = new PredictiveRoyaltyService();
