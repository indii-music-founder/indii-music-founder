import { describe, it, expect } from 'vitest';
import {
    ItinerarySchema,
    VehicleStatsSchema
} from './TouringService';

describe('Touring Schemas', () => {
    describe('ItinerarySchema', () => {
        it('should validate valid itinerary', () => {
            const data = {
                userId: 'user1',
                tourName: 'World Tour',
                stops: [
                    {
                        date: '2023-01-01',
                        city: 'New York',
                        venue: 'MSG',
                        activity: 'Concert',
                        notes: 'Sold out',
                        type: 'Show',
                        distance: 0
                    }
                ],
                totalDistance: '1000 miles',
                estimatedBudget: '$50,000'
            };
            const result = ItinerarySchema.parse(data);
            expect(result.stops).toHaveLength(1);
        });

        it('should fail if stops are missing required fields', () => {
             const data = {
                userId: 'user1',
                tourName: 'World Tour',
                stops: [
                    {
                        // Missing city, venue, etc
                        date: '2023-01-01',
                    }
                ],
                totalDistance: '1000 miles',
                estimatedBudget: '$50,000'
            };
            expect(() => ItinerarySchema.parse(data)).toThrow();
        });
    });

    describe('VehicleStatsSchema', () => {
        it('should validate stats', () => {
            const data = {
                userId: 'user1',
                milesDriven: 1000,
                fuelLevelPercent: 50,
                tankSizeGallons: 20,
                mpg: 25,
                gasPricePerGallon: 3.50
            };
            const result = VehicleStatsSchema.parse(data);
            expect(result.milesDriven).toBe(1000);
        });
    });
});
