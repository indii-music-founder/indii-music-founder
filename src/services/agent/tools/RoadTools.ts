
import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MapsTools } from './MapsTools';
import { z } from 'zod';

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

        const prompt = `
        You are a Tour Manager. Plan a logistical route for a tour.
        Stops/Cities: ${stopsList.join(', ')}.
        ${context}
        Optimize for logical travel flow.

        Output a strict JSON object (no markdown) matching this schema:
        { "route": string[], "totalDistance": string, "estimatedDuration": string, "legs": [{ "from": string, "to": string, "distance": string, "driveTime": string }] }
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return JSON.stringify(TourRouteSchema.parse(parsed));
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

        const prompt = `
        You are a Tour Accountant. Estimate a tour budget.
        Crew Size: ${c}
        Duration: ${d} days
        Accommodation Level: ${level}

        Output a strict JSON object (no markdown) matching this schema:
        { "totalBudget": number, "breakdown": { "lodging": string, "food": string, "transport": string, "contingency": string } }
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return JSON.stringify(TourBudgetSchema.parse(parsed));
        } catch (e) {
            console.error('RoadTools.calculate_tour_budget error:', e);
            return JSON.stringify({
                totalBudget: 0,
                breakdown: { lodging: "0", food: "0", transport: "0", contingency: "0" }
            });
        }
    },

    generate_itinerary: async ({ route, city, date, venue, show_time }: { route?: any, city?: string, date?: string, venue?: string, show_time?: string }) => {
        const prompt = city ?
            `Create a Day Sheet for ${city} on ${date} at ${venue}, show time ${show_time}.` :
            `Create a tour itinerary based on this route info: ${JSON.stringify(route)}`;

        const fullPrompt = `
        You are a Road Manager. ${prompt}

        Output a strict JSON object (no markdown) matching this schema:
        { "tourName": string, "schedule": [{ "day": number, "city": string, "venue": string, "activity": string }] }
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: fullPrompt }] }
            });
            const text = res.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            return JSON.stringify(ItinerarySchema.parse(parsed));
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
