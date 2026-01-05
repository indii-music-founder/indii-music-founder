import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { z } from "zod";
import { defineSecret } from "firebase-functions/params";
import { Client } from "@googlemaps/google-maps-services-js";

// Secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const googleMapsApiKey = defineSecret("GOOGLE_MAPS_API_KEY"); // Assumption: This secret exists or needs to be set.

// Helper for Gemini Calls (similar to generateImageV3 pattern)
async function generateWithGemini(prompt: string, schema?: any): Promise<any> {
    const modelId = "gemini-3-pro-preview";
    // We access the secret value inside the function execution
    const key = geminiApiKey.value();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;

    const body: any = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ["TEXT"],
        }
    };

    if (schema) {
        body.generationConfig.responseMimeType = "application/json";
        // Gemini 1.5 Pro / Flash supports responseSchema
        // For simpler "json_mode", we often just ask for JSON in prompt, but let's try strict schema if possible.
        // However, "gemini-3-pro-preview" capability for responseSchema needs verification.
        // Falling back to "return JSON" in prompt + text/json mimeType is safer for compatibility unless verified.
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No content returned from Gemini");

    try {
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "");
        return JSON.parse(jsonStr);
    } catch (e) {
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

const FuelLogisticsSchema = z.object({
    milesDriven: z.number().default(0),
    fuelLevelPercent: z.number().default(50),
    tankSizeGallons: z.number().default(15),
    mpg: z.number().default(8),
    gasPricePerGallon: z.number().default(3.50)
});

// ----------------------------------------------------------------------------
// Cloud Functions
// ----------------------------------------------------------------------------

export const generateItinerary = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");

        const validation = ItineraryRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError("invalid-argument", validation.error.message);
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

        Return JSON format:
        {
            "stops": [
                { "city": "City, State", "date": "YYYY-MM-DD", "venue": "Venue Name", "activity": "Show" }
            ],
            "totalDistanceMiles": number,
            "estimatedDurationDays": number
        }
        `;

        try {
            const itinerary = await generateWithGemini(prompt, true);
            return itinerary;
        } catch (error: any) {
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

export const checkLogistics = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");

        const validation = LogisticsCheckSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError("invalid-argument", validation.error.message);
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
        } catch (error: any) {
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

export const findPlaces = functions
    .runWith({ secrets: [googleMapsApiKey] })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");

        const validation = FindPlacesSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError("invalid-argument", validation.error.message);
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
                throw new functions.https.HttpsError("not-found", "Location not found");
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
                address: p.vicinity,
                rating: p.rating,
                isOpen: p.opening_hours?.open_now,
                place_id: p.place_id,
                geometry: p.geometry
            })).slice(0, 10); // Limit results

            return { places };
        } catch (error: any) {
            console.error("Maps API Error:", error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError("internal", "Failed to fetch places");
        }
    });

export const calculateFuelLogistics = functions
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");

        const validation = FuelLogisticsSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError("invalid-argument", validation.error.message);
        }

        const stats = validation.data;

        // Business Logic Calculation
        const currentFuelGallons = (stats.fuelLevelPercent / 100) * stats.tankSizeGallons;
        const rangeMiles = currentFuelGallons * stats.mpg;
        const fullTankRange = stats.tankSizeGallons * stats.mpg;
        const costToFill = (stats.tankSizeGallons - currentFuelGallons) * stats.gasPricePerGallon;

        return {
            currentRangeMiles: Math.floor(rangeMiles),
            fullTankRangeMiles: Math.floor(fullTankRange),
            costToFill: Number(costToFill.toFixed(2)),
            status: rangeMiles < 50 ? 'CRITICAL' : rangeMiles < 150 ? 'LOW' : 'OK'
        };
    });
