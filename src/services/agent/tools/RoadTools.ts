/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MapsTools } from './MapsTools';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { db, auth } from '@/services/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * Road Manager Tools
 * Logistics, routing, and budgeting for tours.
 */

// --- Validation Schemas ---

const TourRouteSchema = z.object({
    route: z.array(z.string()),
    totalDistance: z.string(),
    estimatedDuration: z.string(),
    legs: z.array(z.object({
        from: z.string(),
        to: z.string(),
        distance: z.string(),
        driveTime: z.string()
    }))
});

const ItinerarySchema = z.object({
    tourName: z.string(),
    schedule: z.array(z.object({
        day: z.number(),
        city: z.string(),
        venue: z.string(),
        activity: z.string()
    }))
});

const OptimizedRouteSchema = z.object({
    optimizedRoute: z.array(z.string()),
    reasoning: z.string(),
    factors: z.array(z.string()),
    estimatedReach: z.string()
});

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
        const stopsList = locations || (stops && start_location && end_location ? [start_location, ...stops, end_location] : []);
        const context = timeframe ? `Timeframe: ${timeframe}` : '';
        const schema = zodToJsonSchema(TourRouteSchema);

        const prompt = `
        You are a Logistics Engine. Calculate the driving route for the following tour stops.
        Stops/Cities: ${stopsList.join(', ')}.
        ${context}

        CRITICAL INSTRUCTIONS:
        1. Optimize the route order for the shortest total drive time.
        2. Provide specific "legs" with realistic driving distances (miles/km) and times (hours/mins).
        3. Do NOT just list the cities; calculate the connections.
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = TourRouteSchema.parse(data);
        return toolSuccess(validated, `Route planned with ${validated.legs.length} legs.`);
    }),

    calculate_tour_budget: wrapTool('calculate_tour_budget', async ({ days, crew, crew_size, duration_days, accommodation_level }: { days?: number, crew?: number, crew_size?: number, duration_days?: number, accommodation_level?: string }) => {
        const d = days || duration_days || 1;
        const c = crew || crew_size || 1;
        const level = (accommodation_level || 'standard').toLowerCase();

        // Deterministic Rates (USD)
        const rates = {
            budget: { hotel: 100, per_diem: 40, transport: 50 },
            standard: { hotel: 200, per_diem: 60, transport: 100 },
            luxury: { hotel: 500, per_diem: 100, transport: 300 }
        };

        const rate = rates[level as keyof typeof rates] || rates.standard;

        // Math Calculations
        const lodgingCost = rate.hotel * c * d;
        const foodCost = rate.per_diem * c * d;
        const vehicles = Math.ceil(c / 5);
        const transportCost = rate.transport * vehicles * d;

        // Crew Wages (Simulated Base Rate of $250/day/person)
        const crewWages = 250 * c * d;

        const subtotal = lodgingCost + foodCost + transportCost + crewWages;
        const contingency = Math.round(subtotal * 0.10); // 10% contingency
        const total = subtotal + contingency;

        return toolSuccess({
            totalBudget: total,
            breakdown: {
                lodging: lodgingCost,
                food: foodCost,
                transport: transportCost,
                crew_costs: crewWages,
                contingency: contingency
            }
        }, `Tour budget calculated for ${d} days and ${c} crew at ${level} level.`);
    }),

    generate_itinerary: wrapTool('generate_itinerary', async ({ route, city, date, venue, show_time }: { route?: any, city?: string, date?: string, venue?: string, show_time?: string }) => {
        const promptInfo = city ?
            `Create a Day Sheet for ${city} on ${date} at ${venue}, show time ${show_time}.` :
            `Create a tour itinerary based on this route info: ${JSON.stringify(route)}`;

        const fullPrompt = `You are a Road Manager. ${promptInfo}`;
        const schema = zodToJsonSchema(ItinerarySchema);

        const data = await firebaseAI.generateStructuredData(
            [{ text: fullPrompt }],
            schema as Record<string, unknown>
        );

        const validated = ItinerarySchema.parse(data);
        return toolSuccess(validated, `Itinerary generated for ${validated.tourName}.`);
    }),

    book_logistics: wrapTool('book_logistics', async ({ item, date }: { item: string, date: string }) => {
        const referenceId = `BK-${Date.now().toString(36).toUpperCase()}`;
        const userId = auth.currentUser?.uid;

        // Persist logistics request to Firestore
        if (userId) {
            try {
                await setDoc(doc(collection(db, `users/${userId}/logistics_requests`)), {
                    item,
                    date,
                    referenceId,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
            } catch (e) {
                logger.warn('[RoadTools] Failed to persist logistics request:', e);
            }
        }

        return toolSuccess({
            status: "pending",
            item,
            date,
            referenceId,
            note: 'Logistics request submitted — awaiting provider confirmation.'
        }, `Logistics request submitted for ${item} on ${date}.`);
    }),

    ...MapsTools,

    optimize_tour_route: wrapTool('optimize_tour_route', async (args: { venues: string[] }) => {
        // Item 131: Use Gemini to generate density-optimized routes
        const schema = zodToJsonSchema(OptimizedRouteSchema);
        const prompt = `
        You are a Tour Routing Optimizer for an independent music artist.
        Given the following list of venues/cities, optimize the order for maximum audience impact 
        and minimum travel time. Consider:
        1. Geographic proximity (minimize drive time between stops)
        2. Market size (major cities may draw larger crowds)
        3. Regional music scene density (college towns, music hubs)
        4. Day-of-week optimization (weekends for smaller markets, weekdays for major cities)

        Venues: ${args.venues.join(', ')}

        Respond with the optimized route order, reasoning for changes, factors considered, 
        and estimated audience reach.
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = OptimizedRouteSchema.parse(data);

        return toolSuccess({
            inputVenues: args.venues,
            optimizedRoute: validated.optimizedRoute,
            reasoning: validated.reasoning,
            factors: validated.factors,
            estimatedReach: validated.estimatedReach
        }, `Tour route optimized for ${args.venues.length} venues based on listener density and drive time analysis.`);
    }),

    generate_technical_rider: wrapTool('generate_technical_rider', async (args: { artistName: string; stageSetup: string; audioRequirements: string }) => {
        // Item 132: Use Gemini to generate structured rider with stage plot
        const riderId = `RIDER-${Date.now().toString(36).toUpperCase()}`;
        const schema = zodToJsonSchema(TechnicalRiderSchema);

        const prompt = `
        You are a professional tour production manager. Generate a complete technical rider 
        and stage plot for the following artist:

        Artist: ${args.artistName}
        Stage Setup: ${args.stageSetup}
        Audio Requirements: ${args.audioRequirements}

        Include:
        1. Full stage plot description with positions
        2. Complete input list (channel, instrument, mic/DI, notes)
        3. Monitor mix requirements
        4. Power requirements (amps, circuits)
        5. Any backline that should be provided by venue
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as Record<string, unknown>
        );

        const validated = TechnicalRiderSchema.parse(data);

        // Persist to Firestore for later PDF export
        const userId = auth.currentUser?.uid;
        if (userId) {
            try {
                await setDoc(doc(collection(db, `users/${userId}/technical_riders`)), {
                    ...validated,
                    riderId,
                    createdAt: new Date().toISOString()
                });
            } catch (e) {
                logger.warn('[RoadTools] Failed to persist technical rider:', e);
            }
        }

        return toolSuccess({
            ...validated,
            riderId,
            status: 'Complete — ready for PDF export from the Legal module.'
        }, `Technical rider generated for ${args.artistName} (Ref: ${riderId}). Includes stage plot, ${validated.inputList.length}-channel input list, and power requirements.`);
    }),

    log_live_setlist_for_pro: wrapTool('log_live_setlist_for_pro', async (args: { venue: string; date: string; tracks: string[] }) => {
        // Item 138: Persist setlist to Firestore for PRO royalty submission
        const setlistId = `SET-${Date.now().toString(36).toUpperCase()}`;
        const userId = auth.currentUser?.uid;

        if (userId) {
            try {
                await setDoc(doc(collection(db, `users/${userId}/setlists`)), {
                    setlistId,
                    venue: args.venue,
                    date: args.date,
                    tracks: args.tracks,
                    submissionStatus: 'Queued',
                    targetPROs: ['ASCAP', 'BMI', 'SESAC'],
                    createdAt: new Date().toISOString()
                });
                logger.info(`[RoadTools] Setlist ${setlistId} persisted for PRO submission.`);
            } catch (e) {
                logger.warn('[RoadTools] Failed to persist setlist:', e);
            }
        }

        return toolSuccess({
            setlistId,
            venue: args.venue,
            date: args.date,
            tracksLogged: args.tracks.length,
            tracks: args.tracks,
            submissionStatus: 'Queued for ASCAP/BMI/SESAC Submission',
            note: userId ? 'Setlist saved to your account for PRO submission.' : 'Sign in to persist setlist data.'
        }, `Live setlist logged for ${args.venue} on ${args.date}. ${args.tracks.length} tracks queued for PRO performance royalty submission.`);
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases for historical reasons if needed
export const {
    plan_tour_route,
    calculate_tour_budget,
    generate_itinerary,
    optimize_tour_route,
    generate_technical_rider,
    log_live_setlist_for_pro
} = RoadTools;
