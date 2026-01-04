import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MapsTools } from './MapsTools';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

// --- Tools Implementation ---

export const RoadTools: Record<string, AnyToolFunction> = {
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
            schema as any
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
            schema as any
        );

        const validated = ItinerarySchema.parse(data);
        return toolSuccess(validated, `Itinerary generated for ${validated.tourName}.`);
    }),

    book_logistics: wrapTool('book_logistics', async ({ item, date }: { item: string, date: string }) => {
        return toolSuccess({
            status: "confirmed",
            item,
            date,
            confirmationCode: `BK-${Math.floor(Math.random() * 10000)}`,
            vendor: "Global Logistics Co."
        }, `Logistics booked for ${item} on ${date}.`);
    }),

    ...MapsTools
};

// Aliases for historical reasons if needed
export const {
    plan_tour_route,
    calculate_tour_budget,
    generate_itinerary
} = RoadTools;
