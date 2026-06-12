import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadAgent } from './RoadAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/road/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

// Mock maps-related functions in RoadTools to prevent script loading timeouts
vi.mock('../tools/RoadTools', async (importOriginal) => {
    const original = await importOriginal<typeof import('../tools/RoadTools')>();
    return {
        ...original,
        RoadTools: {
            ...original.RoadTools,
            search_places: vi.fn().mockResolvedValue({ success: false, error: 'Maps/places bridge is unavailable' }),
            get_distance_matrix: vi.fn().mockResolvedValue({ success: false, error: 'Maps/places bridge is unavailable' }),
            get_place_details: vi.fn().mockResolvedValue({ success: false, error: 'Maps/places bridge is unavailable' }),
        }
    };
});

// Mock AutonomousIntelligence
vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    return {
        AutonomousIntelligence: {
            generateText: vi.fn().mockResolvedValue('Mock Text Response'),
            generateStructuredData: vi.fn().mockImplementation((prompt, schema) => {
                if (schema && schema.properties && schema.properties.route) {
                    return Promise.resolve({
                        route: ['New York', 'Chicago', 'Denver', 'Los Angeles'],
                        totalDistance: '2800 miles',
                        estimatedDuration: '42 hours',
                        legs: [
                            { from: 'New York', to: 'Chicago', distance: '800 miles', driveTime: '12 hours' },
                            { from: 'Chicago', to: 'Denver', distance: '1000 miles', driveTime: '15 hours' },
                            { from: 'Denver', to: 'Los Angeles', distance: '1000 miles', driveTime: '15 hours' }
                        ]
                    });
                }
                if (schema && schema.properties && schema.properties.tourName) {
                    return Promise.resolve({
                        tourName: 'Summer Rock Tour',
                        schedule: [
                            { day: 1, city: 'Detroit', venue: 'The Shelter', activity: 'Show' }
                        ]
                    });
                }
                return Promise.resolve({ total_estimated_budget: 5000 });
            })
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
        it('should call generateStructuredData and return success response', async () => {
            const args = {
                start_location: 'New York',
                end_location: 'Los Angeles',
                stops: ['Chicago', 'Denver']
            };
            
            const result = await RoadAgent.functions!.plan_tour_route(args);
            expect(result.success).toBe(true);
            expect(result.data?.legs.length).toBe(3);
            expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(AutonomousIntelligence.generateStructuredData).mockRejectedValueOnce(new Error('Generation failed'));
            
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
        it('should return budget data', async () => {
            const args = {
                duration_days: 10,
                crew_size: 5
            };

            const result = await RoadAgent.functions!.calculate_tour_budget(args);
            expect(result.success).toBe(true);
            expect(result.data?.totalBudget).toBeGreaterThan(0);
        });
    });

    describe('generate_itinerary', () => {
        it('should call generateStructuredData and return itinerary', async () => {
            const args = {
                tour_name: 'Summer Rock Tour',
                start_date: '2026-07-01',
                end_date: '2026-07-02',
                cities: ['Detroit']
            };

            const result = await RoadAgent.functions!.generate_itinerary(args);
            expect(result.success).toBe(true);
            expect(result.data?.tourName).toBe('Summer Rock Tour');
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
            expect(result.error).toContain('Maps/places bridge is unavailable');
        });
    });

    describe('get_distance_matrix', () => {
        it('should return error since provider is missing', async () => {
            const result = await RoadAgent.functions!.get_distance_matrix({ origins: ['Detroit'], destinations: ['Chicago'] });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Maps/places bridge is unavailable');
        });
    });
});
