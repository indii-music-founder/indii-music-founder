import { onCall, HttpsError } from "firebase-functions/v2/https";

import { z } from "zod";
import { Client } from "@googlemaps/google-maps-services-js";
import { googleMapsApiKey } from "../config/secrets";
import { getVertexAIClient } from "./vertexClient";

/**
 * Helper for Vertex AI calls. Credentials come from the function runtime's
 * Application Default Credentials, never a Gemini Developer API key.
 */
async function generateWithGemini(prompt: string, schema = false): Promise<Record<string, unknown> | string> {
    const modelId = "gemini-2.5-pro";
    const response = await getVertexAIClient().models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: schema ? { responseMimeType: "application/json" } : undefined,
    });
    const text = response.text;
    if (!text) throw new Error("No content returned from Gemini");

    try {
        if (!schema) return text;
        // Clean up markdown code blocks if present
        let jsonStr = text;
        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            jsonStr = match[1];
        } else {
            const startIdx = text.indexOf('{');
            const endIdx = text.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                jsonStr = text.substring(startIdx, endIdx + 1);
            }
        }
        return JSON.parse(jsonStr.trim()) as Record<string, unknown>;
    } catch (_e) {
        console.error("Failed to parse JSON from Gemini:", text);
        throw new Error("Invalid JSON response from AI");
    }
}

// ----------------------------------------------------------------------------
// Validation Schemas
// ----------------------------------------------------------------------------

const ItineraryRequestSchema = z.object({
    locations: z.array(z.string()).min(1),
    dates: z.object({
        start: z.string(),
        end: z.string()
    })
});

const LogisticsCheckSchema = z.object({
    itinerary: z.object({
        stops: z.array(z.object({
            city: z.string(),
            date: z.string(),
            venue: z.string().optional()
        }))
    })
});

const FindPlacesSchema = z.object({
    location: z.string(),
    type: z.string().optional().default('gas_station'),
    radius: z.number().optional().default(5000) // meters
});

// ----------------------------------------------------------------------------
// Cloud Functions
// ----------------------------------------------------------------------------

export const generateItinerary = onCall(
    { enforceAppCheck: true, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

        const validation = ItineraryRequestSchema.safeParse(request.data);
        if (!validation.success) {
            throw new HttpsError("invalid-argument", validation.error.message);
        }

        const { locations, dates } = validation.data;

        // Use AI to generate a sensible itinerary order and details
        const prompt = `
        You are an expert Tour Manager. Create a logical tour itinerary.

        Inputs:
        - Locations to visit: ${locations.join(", ")}
        - Start Date: ${dates.start}
        - End Date: ${dates.end}

        Requirements:
        1. Order the locations logically to minimize travel time.
        2. Assign dates to each stop.
        3. Suggest a realistic venue for a band/artist in each city.
        4. Include "Travel Day" if distances are long.
        5. Set both "activity" and "type" fields to the same action value (e.g. "Show", "Travel", "Day Off").

        Return JSON format:
        {
            "stops": [
                { "city": "City, State", "date": "YYYY-MM-DD", "venue": "Venue Name", "activity": "Show", "type": "Show" }
            ],
            "totalDistanceMiles": number,
            "estimatedDurationDays": number
        }
        `;

        try {
            const itinerary = await generateWithGemini(prompt, true);
            return itinerary;
        } catch (error: unknown) {
            throw new HttpsError("internal", (error as Error).message);
        }
    },
);

export const checkLogistics = onCall(
    { enforceAppCheck: true, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

        const validation = LogisticsCheckSchema.safeParse(request.data);
        if (!validation.success) {
            throw new HttpsError("invalid-argument", validation.error.message);
        }

        const { itinerary } = validation.data;

        // Use AI to analyze the schedule for feasibility
        const prompt = `
        Analyze this tour itinerary for logistical feasibility.
        Itinerary: ${JSON.stringify(itinerary)}

        Check for:
        1. Unrealistic drive times between consecutive dates.
        2. Missing travel days for long distances (> 400 miles).
        3. Routing efficiency issues.

        Return JSON:
        {
            "isFeasible": boolean,
            "issues": string[],     // List specific problems (e.g. "Drive from A to B is 10 hours, but dates are consecutive")
            "suggestions": string[] // actionable fixes
        }
        `;

        try {
            const report = await generateWithGemini(prompt, true);
            return report;
        } catch (error: unknown) {
            throw new HttpsError("internal", (error as Error).message);
        }
    },
);

export const findPlaces = onCall(
    { enforceAppCheck: true, secrets: [googleMapsApiKey], memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

        const validation = FindPlacesSchema.safeParse(request.data);
        if (!validation.success) {
            throw new HttpsError("invalid-argument", validation.error.message);
        }

        const { location, type, radius } = validation.data;
        const client = new Client({});

        try {
            // 1. Geocode the location string to get LatLng
            const geocodeRes = await client.geocode({
                params: {
                    address: location,
                    key: googleMapsApiKey.value()
                }
            });

            if (geocodeRes.data.results.length === 0) {
                // Return HttpsError directly so the catch block doesn't wrap it in "internal"
                throw new HttpsError("not-found", "Location not found");
            }

            const locationCoords = geocodeRes.data.results[0].geometry.location;

            // 2. Search nearby
            const placesRes = await client.placesNearby({
                params: {
                    location: locationCoords,
                    radius: radius,
                    keyword: type, // e.g. 'gas_station', 'hotel'
                    key: googleMapsApiKey.value()
                }
            });

            // Map to simplified structure
            const places = placesRes.data.results.map(p => ({
                name: p.name,
                vicinity: p.vicinity,
                rating: p.rating,
                isOpen: p.opening_hours?.open_now,
                place_id: p.place_id,
                geometry: p.geometry
            })).slice(0, 10); // Limit results

            return { places };
        } catch (error: unknown) {
            console.error("Maps API Error:", error);
            // Trap 3 of 7 (see ISSUE-1243). The "Location not found" throw above
            // is raised inside this try specifically so it can pass through
            // here - the comment at that site says so. It tested the v1 class
            // while the throw is v2, so the pass-through never fired and a
            // real not-found surfaced as 'internal: Failed to fetch places'.
            if (error instanceof HttpsError) {
                throw error;
            }
            throw new HttpsError("internal", "Failed to fetch places");
        }
    },
);
