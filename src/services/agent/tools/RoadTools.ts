
import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MapsTools } from './MapsTools';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

const TourBudgetSchema = z.object({
    totalBudget: z.number(),
    breakdown: z.object({
        lodging: z.string(),
        food: z.string(),
        transport: z.string(),
        contingency: z.string()
    })
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

export const RoadTools = {
    plan_tour_route: async ({ locations, start_location, end_location, stops, timeframe }: { locations?: string[], start_location?: string, end_location?: string, stops?: string[], timeframe?: string }) => {
        // Adapt input to support both simple list and detailed object
        const stopsList = locations || (stops && start_location && end_location ? [start_location, ...stops, end_location] : []);
        const context = timeframe ? `Timeframe: ${timeframe}` : '';
        const schema = zodToJsonSchema(TourRouteSchema);

        const prompt = `
        You are a Tour Manager. Plan a logistical route for a tour.
        Stops/Cities: ${stopsList.join(', ')}.
        ${context}
        Optimize for logical travel flow.
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(TourRouteSchema.parse(data));
        } catch (e) {
            console.error('RoadTools.plan_tour_route error:', e);
            return JSON.stringify({
                route: stopsList,
                totalDistance: "Unknown",
                estimatedDuration: "Unknown",
                legs: []
            });
        }
    },

    calculate_tour_budget: async ({ days, crew, crew_size, duration_days, accommodation_level }: { days?: number, crew?: number, crew_size?: number, duration_days?: number, accommodation_level?: string }) => {
        const d = days || duration_days || 1;
        const c = crew || crew_size || 1;
        const level = accommodation_level || 'standard';
        const schema = zodToJsonSchema(TourBudgetSchema);

        const prompt = `
        You are a Tour Accountant. Estimate a tour budget.
        Crew Size: ${c}
        Duration: ${d} days
        Accommodation Level: ${level}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(TourBudgetSchema.parse(data));
        } catch (e) {
            console.error('RoadTools.calculate_tour_budget error:', e);
            return JSON.stringify({
                totalBudget: 0,
                breakdown: { lodging: "0", food: "0", transport: "0", contingency: "0" }
            });
        }
    },

    generate_itinerary: async ({ route, city, date, venue, show_time }: { route?: any, city?: string, date?: string, venue?: string, show_time?: string }) => {
        const promptInfo = city ?
            `Create a Day Sheet for ${city} on ${date} at ${venue}, show time ${show_time}.` :
            `Create a tour itinerary based on this route info: ${JSON.stringify(route)}`;

        const fullPrompt = `You are a Road Manager. ${promptInfo}`;
        const schema = zodToJsonSchema(ItinerarySchema);

        try {
            const data = await AI.generateStructuredData<any>(fullPrompt, schema as any);
            return JSON.stringify(ItinerarySchema.parse(data));
        } catch (e) {
            console.error('RoadTools.generate_itinerary error:', e);
            return JSON.stringify({
                tourName: "Tour",
                schedule: []
            });
        }
    },

    book_logistics: async ({ item, date }: { item: string, date: string }) => {
        return JSON.stringify({
            status: "confirmed",
            item,
            date,
            confirmationCode: `BK-${Math.floor(Math.random() * 10000)}`,
            vendor: "Global Logistics Co."
        });
    },

    ...MapsTools
};

// Aliases for backwards compatibility or specific agent signatures
export const plan_tour_route = RoadTools.plan_tour_route;
export const calculate_tour_budget = RoadTools.calculate_tour_budget;
export const generate_itinerary = RoadTools.generate_itinerary;
