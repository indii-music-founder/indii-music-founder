
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadTools } from '../RoadTools';
import { firebaseAI } from '../services/ai/FirebaseAIService';

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateStructuredData: vi.fn(),
    }
}));

describe('RoadTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calculate_tour_budget uses deterministic math', async () => {
        // days=10, crew=5, standard (200 hotel, 60 food, 100 transport)
        // Hotel: 200 * 5 * 10 = 10000
        // Food: 60 * 5 * 10 = 3000
        // Transport: 1 vehicle (5/5) -> 100 * 1 * 10 = 1000
        // Crew Wages: 250 * 5 * 10 = 12500
        // Subtotal: 26500
        // Contingency: 2650
        // Total: 29150

        const result = await RoadTools.calculate_tour_budget({ days: 10, crew: 5, accommodation_level: 'standard' });

        expect(result.success).toBe(true);
        const parsed = result.data;

        expect(parsed.totalBudget).toBe(29150);
        expect(parsed.breakdown.lodging).toBe(10000);
        expect(parsed.breakdown.crew_costs).toBe(12500);
    });

    it('plan_tour_route calls AI with enhanced prompt', async () => {
        const mockResponse = {
            route: ["A", "B"],
            totalDistance: "100 miles",
            estimatedDuration: "2 hours",
            legs: []
        };
        (firebaseAI.generateStructuredData as any).mockResolvedValue(mockResponse);

        const result = await RoadTools.plan_tour_route({ locations: ["A", "B"] });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResponse);

        // Verify prompt enhancement
        const callArgs = (firebaseAI.generateStructuredData as any).mock.calls[0];
        expect(callArgs[0]).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("You are a Logistics Engine") })]));
    });
});
