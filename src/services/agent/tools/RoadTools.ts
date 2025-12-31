import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MapsTools } from './MapsTools';

/**
 * Road Manager Tools
 * Logistics, routing, and budgeting for tours.
 */

// --- Standalone Implementations ---

export const plan_tour_route_ai = async (args: { start_location: string, end_location: string, stops: string[], timeframe: string }) => {
    const prompt = `
    You are a Tour Manager. Plan a logistical route for a tour.
    Start: ${args.start_location}
    End: ${args.end_location}
    Stops/Cities: ${args.stops.join(', ')}
    Timeframe: ${args.timeframe}
    Optimize for logical travel flow.
    `;
    try {
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Failed to plan tour route.";
    } catch (e) {
        return "Error planning tour route.";
    }
};

export const calculate_tour_budget_ai = async (args: { crew_size: number, duration_days: number, accommodation_level: string }) => {
    const prompt = `
    You are a Tour Accountant. Estimate a tour budget.
    Crew Size: ${args.crew_size}
    Duration: ${args.duration_days} days
    Accommodation Level: ${args.accommodation_level}
    `;
    try {
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Failed to calculate tour budget.";
    } catch (e) {
        return "Error calculating tour budget.";
    }
};

export const generate_itinerary_ai = async (args: { city: string, date: string, venue: string, show_time: string }) => {
    const prompt = `
    You are a Road Manager. Create a Day Sheet (Itinerary).
    City: ${args.city}
    Date: ${args.date}
    Venue: ${args.venue}
    Show Time: ${args.show_time}
    `;
    try {
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Failed to generate itinerary.";
    } catch (e) {
        return "Error generating itinerary.";
    }
};

export const plan_tour_route = async ({ locations }: { locations: string[] }) => {
    return JSON.stringify({
        route: locations,
        totalDistance: "1200 miles",
        estimatedDuration: "18 days",
        legs: locations.map((loc, i) => {
            if (i === locations.length - 1) return null;
            return {
                from: loc,
                to: locations[i + 1],
                distance: "300 miles",
                driveTime: "5 hours"
            };
        }).filter(Boolean)
    }, null, 2);
};

export const calculate_tour_budget = async ({ days, crew }: { days: number, crew: number }) => {
    const perDiem = 50;
    const hotelAvg = 150;
    const travelAvg = 200;

    const lodging = days * crew * hotelAvg;
    const food = days * crew * perDiem;
    const transport = days * travelAvg;
    const contingency = (lodging + food + transport) * 0.1;

    return JSON.stringify({
        totalBudget: lodging + food + transport + contingency,
        breakdown: {
            lodging: `$${lodging}`,
            food: `$${food}`,
            transport: `$${transport}`,
            contingency: `$${contingency}`
        }
    }, null, 2);
};

export const book_logistics = async ({ item, date }: { item: string, date: string }) => {
    return JSON.stringify({
        status: "confirmed",
        item,
        date,
        confirmationCode: `BK-${Math.floor(Math.random() * 10000)}`,
        vendor: "Global Logistics Co."
    }, null, 2);
};

export const generate_itinerary = async ({ route }: { route: any }) => {
    return JSON.stringify({
        tourName: "Summer 2026 Tour",
        schedule: [
            { day: 1, city: "Chicago", venue: "The Riv", activity: "Load in 2PM" },
            { day: 2, city: "Detroit", venue: "Majestic", activity: "Travel day" }
        ]
    }, null, 2);
};

// --- Unified Object ---

export const RoadTools = {
    plan_tour_route_ai,
    calculate_tour_budget_ai,
    generate_itinerary_ai,
    plan_tour_route,
    calculate_tour_budget,
    book_logistics,
    generate_itinerary,
    ...MapsTools
};
