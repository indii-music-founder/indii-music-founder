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

    it('declares and authorizes the persisted setlist-draft tool for real Road chat', () => {
        const declarations = RoadAgent.tools[0]?.functionDeclarations ?? [];
        expect(RoadAgent.authorizedTools).toContain('log_live_setlist_for_pro');
        expect(Object.keys(RoadAgent.functions ?? {})).toContain('log_live_setlist_for_pro');
        expect(declarations.find(tool => tool.name === 'log_live_setlist_for_pro')).toEqual(
            expect.objectContaining({
                description: expect.stringContaining('does not submit to a PRO'),
                parameters: expect.objectContaining({ required: ['venue', 'date', 'tracks'] }),
            }),
        );
    });

    it('declares only browser operations implemented by the Electron bridge', () => {
        const declaration = RoadAgent.tools[0]?.functionDeclarations
            .find(tool => tool.name === 'browser_tool');
        expect(declaration?.parameters.properties.action.enum).toEqual([
            'navigate', 'extract', 'capture', 'click', 'type', 'scroll', 'wait',
        ]);
        expect(declaration?.description).toContain('does not verify routing');
    });

    it('labels disabled Maps operations as unavailable at the declared Road chat boundary', () => {
        const declarations = RoadAgent.tools[0]?.functionDeclarations ?? [];
        for (const name of ['search_places', 'get_place_details', 'get_distance_matrix']) {
            expect(declarations.find(tool => tool.name === name)?.description).toContain('Unavailable');
        }
    });

    it('declares and authorizes the unapproved technical-rider draft on real Road chat', () => {
        const declaration = RoadAgent.tools[0]?.functionDeclarations
            .find(tool => tool.name === 'generate_technical_rider');
        expect(RoadAgent.authorizedTools).toContain('generate_technical_rider');
        expect(Object.keys(RoadAgent.functions ?? {})).toContain('generate_technical_rider');
        expect(declaration).toEqual(expect.objectContaining({
            description: expect.stringContaining('unsaved, unapproved'),
            parameters: expect.objectContaining({
                required: ['artistName', 'stageSetup', 'audioRequirements'],
            }),
        }));
    });

    describe('plan_tour_route', () => {
        it('creates an ordered route draft without model-generated distances', async () => {
            const args = {
                start_location: 'New York',
                end_location: 'Los Angeles',
                stops: ['Chicago', 'Denver']
            };
            
            const result = await RoadAgent.functions!.plan_tour_route(args);
            expect(result.success).toBe(true);
            expect(result.data?.legs.length).toBe(3);
            expect(result.data?.route).toEqual(['New York', 'Chicago', 'Denver', 'Los Angeles']);
            expect(result.data?.totalDistance).toBe('Not calculated');
            expect(result.data?.estimatedDuration).toBe('Not calculated');
            expect(AutonomousIntelligence.generateStructuredData).not.toHaveBeenCalled();
        });

        it('rejects an incomplete route rather than inventing stops', async () => {
            const result = await RoadAgent.functions!.plan_tour_route({ locations: [] });
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });
    });

    describe('estimate_tour_budget', () => {
        it('should return budget data', async () => {
            const args = {
                duration_days: 10,
                crew_size: 5
            };

            const result = await RoadAgent.functions!.estimate_tour_budget(args);
            expect(result.success).toBe(true);
            expect(result.data?.totalBudget).toBeGreaterThan(0);
        });
    });

    describe('draft_tour_itinerary', () => {
        it('keeps the declared, authorized, and executable arguments aligned', () => {
            const declaration = RoadAgent.tools[0]?.functionDeclarations
                .find(tool => tool.name === 'draft_tour_itinerary');
            expect(RoadAgent.authorizedTools).toContain('draft_tour_itinerary');
            expect(Object.keys(RoadAgent.functions ?? {})).toContain('draft_tour_itinerary');
            expect(declaration).toEqual(expect.objectContaining({
                description: expect.stringContaining('Does not calculate routing'),
                parameters: expect.objectContaining({
                    required: ['tour_name', 'start_date', 'end_date', 'cities'],
                }),
            }));
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
