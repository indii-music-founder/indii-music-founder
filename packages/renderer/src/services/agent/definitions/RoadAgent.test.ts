import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadAgent } from './RoadAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

const callableMocks = vi.hoisted(() => ({
    findPlaces: vi.fn(),
    computeDistanceMatrix: vi.fn(),
}));

// Name-routed callable mocks (ERROR_LEDGER 2026-08-06): each endpoint always
// returns its own response regardless of call order.
vi.mock('firebase/functions', () => ({
    httpsCallable: (_functionsInstance: unknown, name: string) => {
        if (name === 'findPlaces') return callableMocks.findPlaces;
        if (name === 'computeDistanceMatrix') return callableMocks.computeDistanceMatrix;
        throw new Error(`Unexpected callable: ${name}`);
    },
}));

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/road/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

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

    it('declares web extraction as a read-only public URL operation', () => {
        const declaration = RoadAgent.tools[0]?.functionDeclarations
            .find(tool => tool.name === 'web_extract');
        expect(declaration?.parameters).toEqual(expect.objectContaining({
            properties: expect.objectContaining({
                url: expect.objectContaining({ type: 'STRING' }),
            }),
            required: ['url'],
        }));
        expect(declaration?.parameters.properties).not.toHaveProperty('action');
    });

    it('declares bounded read-only public-page extraction', () => {
        const declaration = RoadAgent.tools[0]?.functionDeclarations
            .find(tool => tool.name === 'web_extract');
        expect(declaration?.parameters).toMatchObject({
            required: ['url'],
            properties: { url: { type: 'STRING' } },
        });
        expect(declaration?.description).toContain('cannot log in, click, type, or submit forms');
    });

    it('declares maps capabilities exactly as they run through the secured proxies', () => {
        const declarations = RoadAgent.tools[0]?.functionDeclarations ?? [];
        // search_places and get_distance_matrix are live through the secured
        // backend proxies; their declarations must advertise that (no "Unavailable").
        for (const name of ['search_places', 'get_distance_matrix']) {
            const declaration = declarations.find(tool => tool.name === name);
            expect(declaration?.description).not.toContain('Unavailable');
            expect(declaration?.description).toContain('secured Maps backend proxy');
        }
        // get_place_details has no backend proxy; it must stay honestly labeled.
        const placeDetails = declarations.find(tool => tool.name === 'get_place_details');
        expect(placeDetails?.description).toContain('Unavailable');
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
        it('reaches the secured findPlaces proxy and returns live places', async () => {
            callableMocks.findPlaces.mockResolvedValue({
                data: {
                    places: [
                        { name: 'The Shelter', vicinity: '431 E Congress St, Detroit', geometry: { location: { lat: 42.331, lng: -83.045 } } },
                    ],
                },
            });

            const result = await RoadAgent.functions!.search_places({ query: 'Jazz clubs in Chicago' });
            expect(result.success).toBe(true);
            expect(callableMocks.findPlaces).toHaveBeenCalledWith({
                location: 'Jazz clubs in Chicago',
                type: 'Jazz clubs in Chicago',
            });
            expect((result.data as { count: number }).count).toBe(1);
        });
    });

    describe('get_distance_matrix', () => {
        it('reaches the secured computeDistanceMatrix proxy and returns real estimates', async () => {
            callableMocks.computeDistanceMatrix.mockResolvedValue({
                data: {
                    scope: 'distance_matrix',
                    rows: [[{ status: 'OK', distanceMiles: 283.7, distanceText: '283.7 mi', durationMinutes: 262, durationText: '4 hours 22 mins' }]],
                    limitations: ['Distances and durations are Google driving estimates without live traffic.'],
                },
            });

            const result = await RoadAgent.functions!.get_distance_matrix({ origins: ['Detroit'], destinations: ['Chicago'] });
            expect(result.success).toBe(true);
            expect(callableMocks.computeDistanceMatrix).toHaveBeenCalledWith({ origins: ['Detroit'], destinations: ['Chicago'] });
            const rows = (result.data as { rows: Array<Array<{ distanceMiles: number }>> }).rows;
            expect(rows[0]![0]!.distanceMiles).toBe(283.7);
        });
    });
});
