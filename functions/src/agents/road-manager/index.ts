
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client } from '@googlemaps/google-maps-services-js';

export class RoadManagerAgent {
    private model: any;
    private mapsClient: Client;
    private genAI: GoogleGenerativeAI;

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        this.mapsClient = new Client({});
    }

    private async calculateDistances(locations: string[]): Promise<string> {
        if (locations.length < 2) return "Not enough locations to calculate distance.";

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

        } catch (error) {
            console.error("Failed to calculate distances:", error);
            return "Travel data unavailable (API Error).";
        }
    }

    async generateItinerary(locations: string[], dates: { start: string, end: string }): Promise<any> {
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
        } catch (error) {
            console.error("Failed to parse itinerary:", text);
            return {
                tourName: "Error Generating Itinerary",
                stops: [],
                totalDistance: "0 km",
                estimatedBudget: "$0"
            };
        }
    }

    async checkLogistics(itinerary: any): Promise<any> {
        // Extract locations from itinerary to validate travel
        const locations = itinerary.stops.map((stop: any) => stop.city);
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
        } catch (error) {
            return {
                isFeasible: false,
                issues: ["Failed to parse logistics report"],
                suggestions: []
            };
        }
    }

    async findNearbyPlaces(location: string, type: string, keyword?: string): Promise<any> {
        try {
            // First, geocode the location string to get lat/lng
            const geocodeRes = await this.mapsClient.geocode({
                params: {
                    address: location,
                    key: process.env.GOOGLE_MAPS_API_KEY || ''
                }
            });

            if (geocodeRes.data.status !== 'OK' || !geocodeRes.data.results[0]) {
                throw new Error("Could not find location coordinates.");
            }

            const { lat, lng } = geocodeRes.data.results[0].geometry.location;

            // Search for places nearby
            const placesRes = await this.mapsClient.placesNearby({
                params: {
                    location: { lat, lng },
                    radius: 5000, // 5km radius
                    type: type as any,
                    keyword: keyword,
                    key: process.env.GOOGLE_MAPS_API_KEY || ''
                }
            });

            if (placesRes.data.status !== 'OK') {
                return { places: [], message: "No places found or API error." };
            }

            // Map results to a cleaner format
            const places = placesRes.data.results.map(place => ({
                name: place.name,
                address: place.vicinity,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                open_now: place.opening_hours?.open_now,
                geometry: place.geometry
            })).slice(0, 10); // Limit to top 10

            return { places, location: { lat, lng } };

        } catch (error) {
            console.error("Find Nearby Places Error:", error);
            throw new Error("Failed to find nearby places.");
        }
    }

    async calculateFuelLogistics(data: {
        milesDriven: number,
        fuelLevelPercent: number,
        tankSizeGallons: number,
        mpg: number,
        gasPricePerGallon: number
    }): Promise<any> {
        const { milesDriven, fuelLevelPercent, tankSizeGallons, mpg, gasPricePerGallon } = data;

        const currentFuelGallons = (fuelLevelPercent / 100) * tankSizeGallons;
        const rangeRemaining = currentFuelGallons * mpg;
        const fuelUsed = milesDriven / mpg;

        const gallonsToFill = tankSizeGallons - currentFuelGallons;
        const costToFill = gallonsToFill * gasPricePerGallon;

        // AI Commentary
        const prompt = `
            You are a gritty, experienced Road Manager.
            The band is on the road.
            Current Status:
            - Fuel Level: ${fuelLevelPercent}%
            - Range Remaining: ${rangeRemaining.toFixed(1)} miles
            - Cost to Fill Up: $${costToFill.toFixed(2)}
            - Miles Driven recently: ${milesDriven}

            Give a short, punchy assessment of the situation. Should they panic? Stop now? Keep driving?
            Be realistic but have some personality.
        `;

        const result = await this.model.generateContent(prompt);
        const commentary = result.response.text();

        return {
            rangeRemaining: Math.round(rangeRemaining),
            gallonsToFill: parseFloat(gallonsToFill.toFixed(2)),
            costToFill: parseFloat(costToFill.toFixed(2)),
            commentary: commentary.trim()
        };
    }
}

