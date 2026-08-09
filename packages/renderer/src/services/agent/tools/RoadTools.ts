import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { MapsTools } from './MapsTools';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { auth, functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { setlistDraftService } from '@/services/touring/SetlistDraftService';
import { TouringService } from '@/services/touring/TouringService';

/**
 * Road Manager Tools
 * Logistics, routing, and budgeting for tours.
 */

// --- Validation Schemas ---

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}, 'Date must be a valid calendar date');

const RouteDraftResponseSchema = z.object({
    status: z.literal('route_draft'),
    authority: z.literal('user_inputs_only'),
    stops: z.array(z.object({
        city: z.string(),
        date: DateOnlySchema,
        venue: z.literal(''),
        activity: z.literal('Planning'),
        type: z.literal('Planning'),
        notes: z.literal(''),
    })).min(1),
    limitations: z.array(z.string()).min(1),
});

interface RouteDraftResponse {
    status: 'route_draft';
    authority: 'user_inputs_only';
    stops: Array<{
        city: string;
        date: string;
        venue: '';
        activity: 'Planning';
        type: 'Planning';
        notes: '';
    }>;
    limitations: string[];
}

const TechnicalRiderSchema = z.object({
    artistName: z.string(),
    stageSetup: z.string(),
    audioRequirements: z.string(),
    stagePlot: z.string(),
    inputList: z.array(z.object({
        channel: z.number(),
        instrument: z.string(),
        micOrDI: z.string(),
        notes: z.string().optional()
    })),
    monitorMix: z.string(),
    powerRequirements: z.string(),
    backlineProvided: z.array(z.string()).optional()
});

// --- Tools Implementation ---

export const RoadTools = {
    plan_tour_route: wrapTool('plan_tour_route', async ({ locations, start_location, end_location, stops, timeframe }: { locations?: string[], start_location?: string, end_location?: string, stops?: string[], timeframe?: string }) => {
        const rawStops = locations ?? (
            start_location && end_location
                ? [start_location, ...(stops ?? []), end_location]
                : []
        );
        const route = z.array(z.string().trim().min(1).max(120)).min(2).max(50).parse(rawStops);
        const legs = route.slice(0, -1).map((from, index) => ({
            from,
            to: route[index + 1],
            distance: 'Not calculated',
            driveTime: 'Not calculated',
        }));

        return toolSuccess({
            status: 'route_draft',
            authority: 'user_inputs_only',
            route,
            timeframe: timeframe || null,
            totalDistance: 'Not calculated',
            estimatedDuration: 'Not calculated',
            legs,
            limitations: [
                'Waypoints remain in the order entered by the user.',
                'Road routing, distance, drive time, traffic, venue availability, and audience reach are not calculated.',
            ],
        }, `Route draft created with ${legs.length} leg${legs.length === 1 ? '' : 's'}; routing and drive times are not verified.`);
    }),

    estimate_tour_budget: wrapTool('estimate_tour_budget', async ({ days, crew, crew_size, duration_days, accommodation_level }: { days?: number, crew?: number, crew_size?: number, duration_days?: number, accommodation_level?: string }) => {
        const inputs = z.object({
            days: z.number().int().min(1).max(365),
            crew: z.number().int().min(1).max(500),
            level: z.enum(['budget', 'standard', 'luxury']),
        }).parse({
            days: days ?? duration_days,
            crew: crew ?? crew_size,
            level: (accommodation_level ?? 'standard').toLowerCase(),
        });
        const d = inputs.days;
        const c = inputs.crew;
        const level = inputs.level;

        // Deterministic Rates (USD)
        const rates = {
            budget: { hotel: 100, per_diem: 40, transport: 50 },
            standard: { hotel: 200, per_diem: 60, transport: 100 },
            luxury: { hotel: 500, per_diem: 100, transport: 300 }
        };

        const rate = rates[level];

        // Math Calculations
        const lodgingCost = rate.hotel * c * d;
        const foodCost = rate.per_diem * c * d;
        const vehicles = Math.ceil(c / 5);
        const transportCost = rate.transport * vehicles * d;

        // Estimated crew wages. Replace with crew quotes before booking.
        const crewWages = 250 * c * d;

        const subtotal = lodgingCost + foodCost + transportCost + crewWages;
        const contingency = Math.round(subtotal * 0.10); // 10% contingency
        const total = subtotal + contingency;

        const result = {
            status: 'planning_estimate',
            currency: 'USD',
            totalBudget: total,
            breakdown: {
                lodging: lodgingCost,
                food: foodCost,
                transport: transportCost,
                crew_costs: crewWages,
                contingency: contingency
            },
            assumptions: {
                hotelPerPersonPerDay: rate.hotel,
                perDiemPerPersonPerDay: rate.per_diem,
                transportPerVehiclePerDay: rate.transport,
                crewWagePerPersonPerDay: 250,
                peoplePerVehicle: 5,
                contingencyPercent: 10,
            },
            limitations: [
                'This is a planning estimate from fixed default assumptions, not vendor quotes or booked costs.',
                'Fuel, tolls, taxes, insurance, equipment, flights, and market-specific pricing are not included unless represented by the listed defaults.',
            ],
            persisted: false,
        };

        return toolSuccess(result, `Planning estimate calculated for ${d} days and ${c} crew at the ${level} assumption level; no quote or booking was created.`);
    }),

    draft_tour_itinerary: wrapTool('draft_tour_itinerary', async ({ tour_name, start_date, end_date, cities }: { tour_name: string, start_date: string, end_date: string, cities: string[] }) => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            return toolError('Sign in before saving a route draft.', 'AUTH_REQUIRED');
        }

        const validatedInput = z.object({
            tour_name: z.string().trim().min(1).max(200),
            start_date: DateOnlySchema,
            end_date: DateOnlySchema,
            cities: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
        }).refine(input => input.start_date <= input.end_date, {
            path: ['end_date'],
            message: 'End date must be on or after start date',
        }).parse({ tour_name, start_date, end_date, cities });

        const compileRouteDraft = httpsCallable(functions, 'generateItinerary');
        const response = await compileRouteDraft({
            locations: validatedInput.cities,
            dates: { start: validatedInput.start_date, end: validatedInput.end_date },
        });
        const draft = RouteDraftResponseSchema.parse(response.data) as RouteDraftResponse;
        const matchesInput = draft.stops.length === validatedInput.cities.length
            && draft.stops.every((stop, index) => (
                stop.city === validatedInput.cities[index]
                && stop.date >= validatedInput.start_date
                && stop.date <= validatedInput.end_date
            ));
        if (!matchesInput) {
            return toolError('Route draft service changed the submitted cities or date range.', 'UNTRUSTED_ROUTE_DRAFT');
        }

        await TouringService.saveItinerary({
            userId,
            tourName: validatedInput.tour_name,
            stops: draft.stops,
            totalDistance: 'Not calculated',
        });

        return toolSuccess({
            ...draft,
            tourName: validatedInput.tour_name,
            totalDistance: 'Not calculated',
            persisted: true,
        }, `Route draft saved for ${validatedInput.tour_name}; routing, distance, drive time, and venue availability are not verified.`);
    }),

    book_logistics: wrapTool('book_logistics', async () => toolError(
        'No logistics provider or booking integration is connected. Nothing was submitted or booked.',
        'LOGISTICS_PROVIDER_UNAVAILABLE',
    )),

    ...MapsTools,

    optimize_tour_route: wrapTool('optimize_tour_route', async (args: { venues: string[] }) => {
        void args;
        return toolError(
            'Verified route optimization is unavailable because the Maps distance provider is disabled. No route order or audience reach was generated.',
            'ROUTE_PROVIDER_UNAVAILABLE',
        );
    }),

    generate_technical_rider: wrapTool('generate_technical_rider', async (args: { artistName: string; stageSetup: string; audioRequirements: string }) => {
        const validatedInput = z.object({
            artistName: z.string().trim().min(1).max(200),
            stageSetup: z.string().trim().min(1).max(4_000),
            audioRequirements: z.string().trim().min(1).max(4_000),
        }).parse(args);

        // Item 132: Use Gemini to generate structured rider with stage plot
        const riderId = `RIDER-${Date.now().toString(36).toUpperCase()}`;
        const schema = zodToJsonSchema(TechnicalRiderSchema);

        const prompt = `
        You are helping prepare an unverified technical-rider draft for human review.
        Draft a proposed rider and stage plot for the following artist without claiming
        that any venue, engineer, crew member, or artist has approved it:

        Artist: ${validatedInput.artistName}
        Stage Setup: ${validatedInput.stageSetup}
        Audio Requirements: ${validatedInput.audioRequirements}

        Include:
        1. Full stage plot description with positions
        2. Proposed input list (channel, instrument, mic/DI, notes)
        3. Monitor mix requirements
        4. Power requirements (amps, circuits)
        5. Any backline that should be provided by venue
        `;

        const data = await AutonomousIntelligence.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = TechnicalRiderSchema.parse(data);

        return toolSuccess({
            ...validated,
            riderId,
            status: 'draft_requires_review',
            persisted: false,
            limitations: [
                'This AI-generated draft has not been approved by the artist, crew, venue, or engineer.',
                'No PDF was created and no venue received this rider.',
            ],
        }, `Technical rider draft generated for ${validatedInput.artistName} (Ref: ${riderId}); it was not saved, exported, approved, or sent.`);
    }),

    generate_visa_checklist: wrapTool('generate_visa_checklist', async (args: {
        artistCitizenship: string;
        tourDestination: string;
        crewSize?: number;
        timelineDays: number;
    }) => {
        const validated = z.object({
            artistCitizenship: z.string().trim().min(2).max(120),
            tourDestination: z.string().trim().min(2).max(120),
            crewSize: z.number().int().min(1).max(500).default(1),
            timelineDays: z.number().int().min(0).max(3650),
        }).parse({ ...args, crewSize: args.crewSize ?? 1 });

        return toolSuccess({
            checklistId: `visa-${Date.now().toString(36)}`,
            status: 'unverified_planning_checklist',
            artistCitizenship: validated.artistCitizenship,
            tourDestination: validated.tourDestination,
            crewSize: validated.crewSize,
            timelineDays: validated.timelineDays,
            possibleDocumentsToConfirm: [
                'Passport scans for all traveling personnel',
                'Confirmed itinerary and venue contracts',
                'Artist biography and press proof',
                'Letters of invitation or engagement',
                'Crew role list and payment responsibilities',
            ],
            nextStep: 'Confirm the current work-authorization route, eligibility, deadlines, fees, and required evidence with the destination government and qualified immigration counsel.',
            limitations: [
                'No immigration route, eligibility, urgency, filing deadline, or approval likelihood was determined.',
                'Requirements can depend on nationality, work type, compensation, travel history, and current law.',
            ],
        }, `Unverified travel-document planning checklist created for ${validated.crewSize} traveler(s); no visa route or eligibility determination was made.`);
    }),

    log_live_setlist_for_pro: wrapTool('log_live_setlist_for_pro', async (args: { venue: string; date: string; tracks: string[] }) => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            return toolError('Sign in before saving a setlist draft.', 'AUTH_REQUIRED');
        }

        const validatedInput = z.object({
            venue: z.string().trim().min(1).max(300),
            date: DateOnlySchema,
            tracks: z.array(z.string().trim().min(1).max(300)).min(1).max(200),
        }).safeParse(args);
        if (!validatedInput.success) {
            return toolError('A venue, valid calendar date in YYYY-MM-DD format, and 1-200 named tracks are required.', 'INVALID_SETLIST_DRAFT');
        }

        let setlistId: string;
        try {
            setlistId = await setlistDraftService.create({
                userId,
                venue: validatedInput.data.venue,
                date: validatedInput.data.date,
                city: '',
                attendance: 0,
                category: 'unclassified',
                songs: validatedInput.data.tracks.map((title, index) => ({
                    id: `track-${index + 1}`,
                    title,
                    originalArtist: '',
                    type: 'other',
                })),
            });
        } catch {
            return toolError('Setlist draft could not be saved.', 'PERSISTENCE_ERROR');
        }

        return toolSuccess({
            setlistId,
            venue: validatedInput.data.venue,
            date: validatedInput.data.date,
            tracksLogged: validatedInput.data.tracks.length,
            tracks: validatedInput.data.tracks,
            submissionStatus: 'draft (manual filing required)',
            note: 'Setlist saved to your account as a draft. It was not submitted to a PRO and no royalty amount was calculated.'
        }, `Setlist saved as a manual-filing draft for ${validatedInput.data.venue} on ${validatedInput.data.date} (${validatedInput.data.tracks.length} tracks). It was not submitted to a PRO.`);
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases for historical reasons if needed
export const {
    plan_tour_route,
    estimate_tour_budget,
    draft_tour_itinerary,
    optimize_tour_route,
    generate_technical_rider,
    generate_visa_checklist,
    log_live_setlist_for_pro
} = RoadTools;
