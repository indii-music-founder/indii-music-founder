"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFuelLogistics = exports.findPlaces = exports.checkLogistics = exports.generateItinerary = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const zod_1 = require("zod");
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js");
const secrets_1 = require("../config/secrets");
// Helper for Gemini Calls (similar to generateImageV3 pattern)
async function generateWithGemini(prompt, schema) {
    var _a, _b, _c, _d, _e;
    const modelId = "gemini-2.5-pro";
    // We access the secret value inside the function execution
    const key = (0, secrets_1.getGeminiApiKey)();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ["TEXT"],
        }
    };
    if (schema) {
        body.generationConfig.responseMimeType = "application/json";
        // Gemini 3.1 Pro supports responseSchema for structured JSON output.
        // For simpler "json_mode", we often just ask for JSON in prompt.
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
    const text = (_e = (_d = (_c = (_b = (_a = result.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
    if (!text)
        throw new Error("No content returned from Gemini");
    try {
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "");
        return JSON.parse(jsonStr);
    }
    catch (e) {
        console.error("Failed to parse JSON from Gemini:", text);
        throw new Error("Invalid JSON response from AI");
    }
}
// ----------------------------------------------------------------------------
// Validation Schemas
// ----------------------------------------------------------------------------
const ItineraryRequestSchema = zod_1.z.object({
    locations: zod_1.z.array(zod_1.z.string()).min(1),
    dates: zod_1.z.object({
        start: zod_1.z.string(),
        end: zod_1.z.string()
    })
});
const LogisticsCheckSchema = zod_1.z.object({
    itinerary: zod_1.z.object({
        stops: zod_1.z.array(zod_1.z.object({
            city: zod_1.z.string(),
            date: zod_1.z.string(),
            venue: zod_1.z.string().optional()
        }))
    })
});
const FindPlacesSchema = zod_1.z.object({
    location: zod_1.z.string(),
    type: zod_1.z.string().optional().default('gas_station'),
    radius: zod_1.z.number().optional().default(5000) // meters
});
const FuelLogisticsSchema = zod_1.z.object({
    milesDriven: zod_1.z.number().default(0),
    fuelLevelPercent: zod_1.z.number().default(50),
    tankSizeGallons: zod_1.z.number().default(15),
    mpg: zod_1.z.number().default(8),
    gasPricePerGallon: zod_1.z.number().default(3.50)
});
// ----------------------------------------------------------------------------
// Cloud Functions
// ----------------------------------------------------------------------------
exports.generateItinerary = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', secrets: [secrets_1.geminiApiKey] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
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
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.checkLogistics = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', secrets: [secrets_1.geminiApiKey] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
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
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.findPlaces = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', secrets: [secrets_1.googleMapsApiKey] })
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const validation = FindPlacesSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", validation.error.message);
    }
    const { location, type, radius } = validation.data;
    const client = new google_maps_services_js_1.Client({});
    try {
        // 1. Geocode the location string to get LatLng
        const geocodeRes = await client.geocode({
            params: {
                address: location,
                key: secrets_1.googleMapsApiKey.value()
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
                key: secrets_1.googleMapsApiKey.value()
            }
        });
        // Map to simplified structure
        const places = placesRes.data.results.map(p => {
            var _a;
            return ({
                name: p.name,
                vicinity: p.vicinity,
                rating: p.rating,
                isOpen: (_a = p.opening_hours) === null || _a === void 0 ? void 0 : _a.open_now,
                place_id: p.place_id,
                geometry: p.geometry
            });
        }).slice(0, 10); // Limit results
        return { places };
    }
    catch (error) {
        console.error("Maps API Error:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to fetch places");
    }
});
exports.calculateFuelLogistics = functions
    .https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
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
//# sourceMappingURL=touring.js.map