"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoadManagerAgent = void 0;
const generative_ai_1 = require("@google/generative-ai");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
class RoadManagerAgent {
    constructor() {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        this.mapsClient = new google_maps_services_js_1.Client({});
    }
    async calculateDistances(locations) {
        if (locations.length < 2)
            return "Not enough locations to calculate distance.";
        try {
            const origins = locations.slice(0, -1);
            const destinations = locations.slice(1);
            const response = await this.mapsClient.distancematrix({
                params: {
                    origins: origins,
                    destinations: destinations,
                    key: process.env.GOOGLE_MAPS_API_KEY || ''
                }
            });
            if (response.data.status !== 'OK') {
                console.error("Google Maps API Error:", response.data.error_message);
                return "Could not fetch travel data.";
            }
            let travelInfo = "Travel Estimates:\n";
            // Note: Distance Matrix returns a grid. For a sequential tour A->B->C, 
            // we want A->B, B->C. 
            // The API returns rows (origins) x elements (destinations).
            // This simple implementation assumes a direct sequence and might need refinement for complex matrices,
            // but for A->B, B->C logic:
            const rows = response.data.rows;
            for (let i = 0; i < rows.length; i++) {
                const element = rows[i].elements[i]; // Diagonal for sequential pairs
                if (element && element.status === 'OK') {
                    travelInfo += `${origins[i]} to ${destinations[i]}: ${element.distance.text}, ${element.duration.text}\n`;
                }
            }
            return travelInfo;
        }
        catch (error) {
            console.error("Failed to calculate distances:", error);
            return "Travel data unavailable (API Error).";
        }
    }
    async generateItinerary(locations, dates) {
        const travelData = await this.calculateDistances(locations);
        const prompt = `
            You are an expert Road Manager for a touring band. Plan a detailed itinerary for a tour.
            
            Locations: ${locations.join(', ')}
            Dates: ${dates.start} to ${dates.end}

            Real-world Travel Data:
            ${travelData}

            Consider travel time between cities, load-in/load-out times, and rest days.
            
            Provide a JSON response with the following structure:
            {
                "tourName": string,
                "stops": [
                    {
                        "date": string,
                        "city": string,
                        "venue": string (suggest a realistic venue),
                        "activity": string (e.g., "Travel", "Show", "Rest Day"),
                        "notes": string
                    }
                ],
                "totalDistance": string,
                "estimatedBudget": string
            }
        `;
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        try {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        }
        catch (error) {
            console.error("Failed to parse itinerary:", text);
            return {
                tourName: "Error Generating Itinerary",
                stops: [],
                totalDistance: "0 km",
                estimatedBudget: "$0"
            };
        }
    }
    async checkLogistics(itinerary) {
        // Extract locations from itinerary to validate travel
        const locations = itinerary.stops.map((stop) => stop.city);
        const travelData = await this.calculateDistances(locations);
        const prompt = `
            You are a meticulous Road Manager. Review the following tour itinerary for logistical issues (e.g., impossible travel times, missing rest days, venue conflicts).

            Real-world Travel Data to verify against:
            ${travelData}

            Itinerary:
            ${JSON.stringify(itinerary)}

            Provide a JSON response with:
            {
                "isFeasible": boolean,
                "issues": string[],
                "suggestions": string[]
            }
        `;
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        try {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        }
        catch (error) {
            return {
                isFeasible: false,
                issues: ["Failed to parse logistics report"],
                suggestions: []
            };
        }
    }
}
exports.RoadManagerAgent = RoadManagerAgent;
//# sourceMappingURL=index.js.map