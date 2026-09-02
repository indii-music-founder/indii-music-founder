import { onCall, HttpsError } from "firebase-functions/v2/https";

import { z } from "zod";
// Google Maps Client is loaded lazily inside findPlaces to reduce cold start time
// import { Client } from "@googlemaps/google-maps-services-js";
import { googleMapsApiKey } from "../config/secrets";

// ----------------------------------------------------------------------------
// Validation Schemas
// ----------------------------------------------------------------------------

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function isValidDateOnly(value: string): boolean {
    if (!DATE_ONLY_PATTERN.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

const DateOnlySchema = z.string()
    .regex(DATE_ONLY_PATTERN, "Date must use YYYY-MM-DD")
    .refine(isValidDateOnly, "Date must be a valid calendar date");

const ItineraryRequestSchema = z.object({
    locations: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
    dates: z.object({
        start: DateOnlySchema,
        end: DateOnlySchema
    }).strict()
}).strict().superRefine(({ dates }, context) => {
    if (dates.start > dates.end) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dates', 'end'],
            message: "End date must be on or after start date",
        });
    }
});

const ScheduleCheckSchema = z.object({
    itinerary: z.object({
        stops: z.array(z.object({
            city: z.string().trim().min(1).max(120),
            date: DateOnlySchema,
            venue: z.string().max(200).optional()
        })).min(1).max(200)
    })
});

const FindPlacesSchema = z.object({
    location: z.string(),
    type: z.string().optional().default('gas_station'),
    radius: z.number().optional().default(5000) // meters
});

export interface RouteDraft {
    status: 'route_draft';
    authority: 'user_inputs_only';
    stops: Array<{
        city: string;
        date: string;
        venue: '';
        activity: 'Planning';
        type: 'Planning';
        notes: '';
    }>;
    limitations: string[];
}

export interface ScheduleReview {
    scope: 'schedule_only';
    hasConflicts: boolean;
    issues: string[];
    suggestions: string[];
    summary: string;
    limitations: string[];
}

function parseDateOnlyUtc(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnlyUtc(value: Date): string {
    return [
        value.getUTCFullYear(),
        String(value.getUTCMonth() + 1).padStart(2, '0'),
        String(value.getUTCDate()).padStart(2, '0'),
    ].join('-');
}

/** Builds a draft from user inputs without inventing route or venue facts. */
export function compileRouteDraft(input: unknown): RouteDraft {
    const { locations, dates } = ItineraryRequestSchema.parse(input);
    const start = parseDateOnlyUtc(dates.start);
    const durationDays = Math.round((parseDateOnlyUtc(dates.end).getTime() - start.getTime()) / DAY_MS);
    const stops = locations.map((city, index) => {
        const dayOffset = locations.length === 1
            ? 0
            : Math.round((index * durationDays) / (locations.length - 1));
        return {
            city,
            date: formatDateOnlyUtc(new Date(start.getTime() + dayOffset * DAY_MS)),
            venue: '' as const,
            activity: 'Planning' as const,
            type: 'Planning' as const,
            notes: '' as const,
        };
    });

    return {
        status: 'route_draft',
        authority: 'user_inputs_only',
        stops,
        limitations: [
            'Waypoints remain in the order entered by the user.',
            'Road routing, distance, drive time, traffic, venue availability, and budget are not calculated.',
        ],
    };
}

/** Reviews saved dates only; it is not an operational-feasibility verdict. */
export function reviewSchedule(input: unknown): ScheduleReview {
    const { itinerary } = ScheduleCheckSchema.parse(input);
    const issues: string[] = [];
    let hasDateOrderConflict = false;
    let hasSameDayCityConflict = false;

    itinerary.stops.forEach((stop, index) => {
        const previous = itinerary.stops[index - 1];
        if (previous && stop.date < previous.date) {
            hasDateOrderConflict = true;
            issues.push(`Stop ${index + 1} (${stop.city}) is dated before stop ${index} (${previous.city}).`);
        }
    });

    const citiesByDate = new Map<string, Map<string, string>>();
    itinerary.stops.forEach((stop) => {
        const cities = citiesByDate.get(stop.date) ?? new Map<string, string>();
        cities.set(stop.city.toLowerCase(), stop.city);
        citiesByDate.set(stop.date, cities);
    });
    citiesByDate.forEach((cities, date) => {
        if (cities.size > 1) {
            hasSameDayCityConflict = true;
            issues.push(`${date} contains stops in multiple cities: ${Array.from(cities.values()).join(', ')}.`);
        }
    });

    const suggestions: string[] = [];
    if (hasDateOrderConflict) {
        suggestions.push('Reorder the stops or correct their dates so the schedule is chronological.');
    }
    if (hasSameDayCityConflict) {
        suggestions.push('Confirm same-day multi-city plans or assign the stops to different dates.');
    }

    return {
        scope: 'schedule_only',
        hasConflicts: issues.length > 0,
        issues,
        suggestions,
        summary: issues.length > 0
            ? `${issues.length} schedule conflict${issues.length === 1 ? '' : 's'} found within the limited check scope.`
            : 'No date-order or same-day multi-city conflicts were found within the limited check scope.',
        limitations: [
            'This check covers date order and same-day multi-city conflicts only.',
            'Road distance, drive time, traffic, venue availability, staffing, and operational feasibility are not verified.',
        ],
    };
}

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

        return compileRouteDraft(validation.data);
    },
);

export const checkLogistics = onCall(
    { enforceAppCheck: true, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

        const validation = ScheduleCheckSchema.safeParse(request.data);
        if (!validation.success) {
            throw new HttpsError("invalid-argument", validation.error.message);
        }

        return reviewSchedule(validation.data);
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
        const { Client } = await import("@googlemaps/google-maps-services-js");
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
            // The "Location not found" throw above is raised inside this try
            // specifically so it can pass through here rather than surfacing as
            // 'internal: Failed to fetch places'; the comment at that site says
            // so. Reference renamed from functions.https.HttpsError under
            // ISSUE-1243 — cosmetic, since v1 and v2 share one HttpsError class.
            if (error instanceof HttpsError) {
                throw error;
            }
            throw new HttpsError("internal", "Failed to fetch places");
        }
    },
);
