
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadTools } from '../RoadTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

describe('RoadTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('estimate_tour_budget uses deterministic math', async () => {
        // days=10, crew=5, standard (200 hotel, 60 food, 100 transport)
        // Hotel: 200 * 5 * 10 = 10000
        // Food: 60 * 5 * 10 = 3000
        // Transport: 1 vehicle (5/5) -> 100 * 1 * 10 = 1000
        // Crew Wages: 250 * 5 * 10 = 12500
        // Subtotal: 26500
        // Contingency: 2650
        // Total: 29150

        const result = await RoadTools.estimate_tour_budget({ days: 10, crew: 5, accommodation_level: 'standard' });

        expect(result.success).toBe(true);
        const parsed = result.data;

        expect(parsed.totalBudget).toBe(29150);
        expect(parsed.breakdown.lodging).toBe(10000);
        expect(parsed.breakdown.crew_costs).toBe(12500);
        expect(parsed.status).toBe('planning_estimate');
        expect(parsed.persisted).toBe(false);
        expect(parsed.limitations[0]).toContain('not vendor quotes or booked costs');
        expect(result.message).toContain('no quote or booking was created');
    });

    it('rejects invalid planning-estimate inputs instead of normalizing them into a false budget', async () => {
        const result = await RoadTools.estimate_tour_budget({
            days: -5,
            crew: 0,
            accommodation_level: 'standard',
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
    });

    it('requires explicit tour duration and crew inputs instead of inventing defaults', async () => {
        const result = await RoadTools.estimate_tour_budget({ accommodation_level: 'standard' });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
    });

    it('plan_tour_route preserves user order without fabricating routing facts', async () => {
        const result = await RoadTools.plan_tour_route({ locations: ["A", "B"] });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({
            status: 'route_draft',
            authority: 'user_inputs_only',
            route: ['A', 'B'],
            totalDistance: 'Not calculated',
            estimatedDuration: 'Not calculated',
            legs: [{ from: 'A', to: 'B', distance: 'Not calculated', driveTime: 'Not calculated' }],
        }));
        expect(AutonomousIntelligence.generateStructuredData).not.toHaveBeenCalled();
        expect(result.message).toContain('not verified');
    });

    it('returns an explicit unavailable error instead of fabricating route optimization', async () => {
        const result = await RoadTools.optimize_tour_route({ venues: ['A', 'B'] });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('ROUTE_PROVIDER_UNAVAILABLE');
        expect(AutonomousIntelligence.generateStructuredData).not.toHaveBeenCalled();
    });

    it('does not claim a logistics request was submitted without a provider', async () => {
        const result = await RoadTools.book_logistics({ item: 'hotel rooms', date: '2026-08-20' });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('LOGISTICS_PROVIDER_UNAVAILABLE');
        expect(result.error).toContain('Nothing was submitted or booked');
    });

    it('labels generated technical-rider content as an unsaved, unapproved draft', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValueOnce({
            artistName: 'Test Artist',
            stageSetup: 'Three performers',
            audioRequirements: 'House PA',
            stagePlot: 'Draft positions',
            inputList: [{ channel: 1, instrument: 'Vocal', micOrDI: 'Mic' }],
            monitorMix: 'Draft monitor mix',
            powerRequirements: 'To be confirmed',
        });

        const result = await RoadTools.generate_technical_rider({
            artistName: 'Test Artist',
            stageSetup: 'Three performers',
            audioRequirements: 'House PA',
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({
            status: 'draft_requires_review',
            persisted: false,
        }));
        expect(result.message).toContain('not saved, exported, approved, or sent');
    });

    it('does not infer a visa route or eligibility from citizenship and destination', async () => {
        const result = await RoadTools.generate_visa_checklist({
            artistCitizenship: 'Canada',
            tourDestination: 'United States',
            crewSize: 3,
            timelineDays: 20,
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({
            status: 'unverified_planning_checklist',
            crewSize: 3,
        }));
        expect(result.data).not.toHaveProperty('likelyVisa');
        expect(result.data).not.toHaveProperty('urgency');
        expect(result.data.limitations[0]).toContain('No immigration route');
        expect(result.message).toContain('no visa route or eligibility determination');
    });
});
