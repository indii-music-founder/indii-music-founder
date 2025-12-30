import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';

export const RoadTools = {
    plan_tour_route: async (args: { start_location: string, end_location: string, stops: string[], timeframe: string }) => {
        const prompt = `
        You are a Tour Manager. Plan a logistical route for a tour.

        Start: ${args.start_location}
        End: ${args.end_location}
        Stops/Cities: ${args.stops.join(', ')}
        Timeframe: ${args.timeframe}

        Optimize for logical travel flow.
        Output:
        1. Route Map (Ordered List of Cities)
        2. Distance/Drive Times between stops
        3. Recommended rest days
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
    },

    calculate_tour_budget: async (args: { crew_size: number, duration_days: number, accommodation_level: string }) => {
        const prompt = `
        You are a Tour Accountant. Estimate a tour budget.

        Crew Size: ${args.crew_size}
        Duration: ${args.duration_days} days
        Accommodation Level: ${args.accommodation_level} (e.g., Budget, Standard, Luxury)

        Estimate costs for:
        1. Transportation (Gas/Rentals)
        2. Accommodation
        3. Per Diems (Food)
        4. Production Costs
        5. Contingency (10%)
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
    },

    generate_itinerary: async (args: { city: string, date: string, venue: string, show_time: string }) => {
        const prompt = `
        You are a Road Manager. Create a Day Sheet (Itinerary).

        City: ${args.city}
        Date: ${args.date}
        Venue: ${args.venue}
        Show Time: ${args.show_time}

        Include standard slots for:
        - Load In
        - Soundcheck
        - Dinner
        - Doors Open
        - Set Time
        - Load Out
        - Hotel Check-in
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
    }

import { MapsTools } from './MapsTools';

export const plan_tour_route = async ({ locations }: { locations: string[] }) => {
    // In a real implementation, this would use the TSP solver or Maps API optimizations.
    // For now, we mock a sequence.
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
    const travelAvg = 200; // Gas/Transport daily avg

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
        },
        assumptions: {
            crewSize: crew,
            tourDays: days,
            perDiem: `$${perDiem}`
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
    // Expects route object from plan_tour_route
    // Mocking output
    return JSON.stringify({
        tourName: "Summer 2026 Tour",
        schedule: [
            { day: 1, city: "Chicago", venue: "The Riv", activity: "Load in 2PM" },
            { day: 2, city: "Detroit", venue: "Majestic", activity: "Travel day" }
        ]
    }, null, 2);
};

export const RoadTools = {
    plan_tour_route,
    calculate_tour_budget,
    book_logistics,
    generate_itinerary,
    // Re-export MapsTools for convenience if needed, though they are registered separately
    ...MapsTools
};
