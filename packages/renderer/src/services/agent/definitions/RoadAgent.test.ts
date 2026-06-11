import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadAgent } from './RoadAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/road/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

// Mock AutonomousIntelligence
vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    return {
        AutonomousIntelligence: {
            generateText: vi.fn().mockResolvedValue('Mock Route Plan'),
            generateStructuredData: vi.fn().mockResolvedValue({ total_estimated_budget: 5000 })
        }
    };
});

describe('RoadAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct ID and metadata', () => {
        expect(RoadAgent.id).toBe('road');
        expect(RoadAgent.name).toBe('Road Director');
        expect(RoadAgent.category).toBe('department');
    });

    describe('plan_tour_route', () => {
        it('should call generateText and return success response', async () => {
            const args = {
                start_location: 'New York',
                end_location: 'Los Angeles',
                stops: ['Chicago', 'Denver']
            };
            
            const result = await RoadAgent.functions!.plan_tour_route(args);
            expect(result.success).toBe(true);
            expect(result.data?.route_plan).toBe('Mock Route Plan');
            expect(AutonomousIntelligence.generateText).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(AutonomousIntelligence.generateText).mockRejectedValueOnce(new Error('Generation failed'));
            
            const args = {
                start_location: 'New York',
                end_location: 'Los Angeles',
                stops: []
            };

            const result = await RoadAgent.functions!.plan_tour_route(args);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Generation failed');
        });
    });

    describe('calculate_tour_budget', () => {
        it('should call generateStructuredData and return budget data', async () => {
            const args = {
                duration_days: 10,
                crew_size: 5
            };

            const result = await RoadAgent.functions!.calculate_tour_budget(args);
            expect(result.success).toBe(true);
            expect(result.data?.total_estimated_budget).toBe(5000);
            expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValueOnce(new Error('Budget error'));

            const args = {
                duration_days: 10,
                crew_size: 5
            };

            const result = await RoadAgent.functions!.calculate_tour_budget(args);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Budget error');
        });
    });

    describe('generate_itinerary', () => {
        it('should call generateStructuredData and return itinerary', async () => {
            const mockItinerary = {
                tour_name: 'Summer Rock Tour',
                days: [
                    { date: '2026-07-01', city: 'Detroit', venue: 'The Shelter', activity: 'Show' }
                ]
            };
            vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValueOnce(mockItinerary);

            const args = {
                tour_name: 'Summer Rock Tour',
                start_date: '2026-07-01',
                end_date: '2026-07-02',
                cities: ['Detroit']
            };

            const result = await RoadAgent.functions!.generate_itinerary(args);
            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockItinerary);
            expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValueOnce(new Error('Itinerary error'));

            const args = {
                tour_name: 'Summer Rock Tour',
                start_date: '2026-07-01',
                end_date: '2026-07-02',
                cities: ['Detroit']
            };

            const result = await RoadAgent.functions!.generate_itinerary(args);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Itinerary error');
        });
    });

    describe('search_places', () => {
        it('should return error since provider is missing', async () => {
            const result = await RoadAgent.functions!.search_places({ query: 'hotels' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Place search requires a connected maps/venue provider');
        });
    });

    describe('get_distance_matrix', () => {
        it('should return error since provider is missing', async () => {
            const result = await RoadAgent.functions!.get_distance_matrix();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Distance matrix requires a connected maps provider');
        });
    });
});
