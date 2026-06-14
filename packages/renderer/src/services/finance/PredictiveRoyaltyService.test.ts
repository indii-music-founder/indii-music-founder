import { describe, it, expect } from 'vitest';
import { predictiveRoyaltyService } from './PredictiveRoyaltyService';

describe('PredictiveRoyaltyService', () => {
    const sampleHistory = [
        { date: '2026-01-01', amount: 100 },
        { date: '2026-02-01', amount: 110 },
        { date: '2026-03-01', amount: 120 }
    ];

    it('should return low confidence and empty forecast if historical transactions are less than 3', () => {
        const result = predictiveRoyaltyService.calculateHorizon(
            [{ date: '2026-01-01', amount: 100 }],
            500,
            0,
            [],
            20,
            50
        );

        expect(result.confidence).toBe('low');
        expect(result.estimatedRecoupmentDate).toBeNull();
        expect(result.forecast).toHaveLength(0);
    });

    it('should calculate recoupment horizon correctly using trend-based projection', () => {
        // Linear growth: 100, 110, 120. Next daily forecast projection should continue trend.
        const result = predictiveRoyaltyService.calculateHorizon(
            sampleHistory,
            200, // Threshold to recoup
            50,  // Already recouped
            [],  // Escalators
            50,  // Pre-recoup royalty rate
            70   // Post-recoup royalty rate
        );

        expect(result.confidence).toBe('medium');
        expect(result.forecast.length).toBeGreaterThan(0);
        expect(result.estimatedRecoupmentDate).not.toBeNull();
    });

    it('should handle escalators correctly during horizon simulation', () => {
        const escalators = [
            {
                unitThreshold: 150,
                newRate: 80,
                unitType: 'revenue' as const,
                triggered: false
            }
        ];

        const result = predictiveRoyaltyService.calculateHorizon(
            sampleHistory,
            500,
            50,
            escalators,
            50,
            70
        );

        expect(result.forecast.length).toBeGreaterThan(0);
    });
});
