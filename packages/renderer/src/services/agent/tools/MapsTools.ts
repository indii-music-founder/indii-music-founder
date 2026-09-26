import { z } from 'zod';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { auth, functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Maps agent tools.
 *
 * History: these tools used to fail closed with MAPS_BROWSER_DISABLED while the
 * page surfaces already worked through secured Cloud Functions. They are now
 * wired through the SAME secured backend proxies (`findPlaces`,
 * `computeDistanceMatrix`) so specialist chats (road, hospitality, event) can
 * perform real place searches and real distance calculations. The browser
 * never holds a Maps key: every call is authenticated, App Check-enforced, and
 * the key stays in Cloud Functions secrets.
 *
 * `get_place_details` remains honestly unavailable: no place-details backend
 * proxy is deployed. Its declaration says so (ERROR_LEDGER 2026-08-09: tool
 * declarations are runtime contracts, not marketing copy).
 */

const SearchPlacesArgsSchema = z.object({
    query: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(100).optional(),
});

const DistanceMatrixArgsSchema = z.object({
    origins: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
    destinations: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
});

const PlacesResponseSchema = z.object({
    places: z.array(z.object({
        name: z.string(),
        vicinity: z.string().optional(),
        rating: z.number().optional(),
        isOpen: z.boolean().optional(),
        place_id: z.string().optional(),
        geometry: z.object({
            location: z.object({ lat: z.number(), lng: z.number() }),
        }).optional(),
    })).max(10),
});

interface CallableErrorShape {
    code?: string;
    message?: string;
}

/** Maps a firebase/functions callable failure onto an honest tool error. */
function callableErrorToToolError(error: unknown, fallbackCode: string, fallbackMessage: string) {
    const shape = (error ?? {}) as CallableErrorShape;
    // The JS SDK prefixes HttpsError codes with "functions/".
    const code = typeof shape.code === 'string' ? shape.code.replace(/^functions\//, '') : undefined;
    if (code === 'unauthenticated') {
        return toolError('Sign in before using Maps tools. The Maps proxy requires an authenticated session.', 'AUTH_REQUIRED');
    }
    if (code === 'not-found') {
        return toolError('Location not found by the geocoder. Provide a more specific city or address.', 'LOCATION_NOT_FOUND');
    }
    if (code === 'permission-denied') {
        return toolError(shape.message || 'The Maps provider denied this request for the configured key.', 'MAPS_PROVIDER_DENIED');
    }
    if (code === 'resource-exhausted') {
        return toolError(shape.message || 'Maps quota exceeded; retry later.', 'MAPS_QUOTA_EXCEEDED');
    }
    if (code === 'invalid-argument') {
        return toolError(shape.message || 'The Maps provider rejected the request as invalid.', 'MAPS_INVALID_REQUEST');
    }
    return toolError(fallbackMessage, fallbackCode);
}

function requireUserId(): string | null {
    return auth.currentUser?.uid ?? null;
}

const PLACE_DETAILS_UNAVAILABLE = toolError(
    'No place-details backend proxy is deployed, so place details are unavailable. '
    + 'Use search_places for name, vicinity, rating, and coordinates instead of inventing details.',
    'PLACE_DETAILS_UNAVAILABLE',
);

export const MapsTools = {
    search_places: wrapTool('search_places', async (rawArgs: { query?: string, type?: string }) => {
        if (!requireUserId()) {
            return toolError('Sign in before searching places. The Maps proxy requires an authenticated session.', 'AUTH_REQUIRED');
        }

        const parsed = SearchPlacesArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
            return toolError('A place search needs a non-empty query (max 200 characters) and an optional place type.', 'INVALID_SEARCH_ARGUMENTS');
        }

        try {
            const findPlaces = httpsCallable(functions, 'findPlaces');
            // findPlaces geocodes `location` and runs a keyword nearby search.
            // Without an explicit type, the full query is the keyword — that is
            // how free-text searches like "Jazz clubs in Chicago" stay truthful.
            const response = await findPlaces({
                location: parsed.data.query,
                type: parsed.data.type ?? parsed.data.query,
            });
            const validated = PlacesResponseSchema.parse(response.data);
            return toolSuccess({
                query: parsed.data.query,
                places: validated.places,
                count: validated.places.length,
                limitations: ['Results come from a Google Places nearby search around the geocoded query center.'],
            }, validated.places.length > 0
                ? `Found ${validated.places.length} place(s) via the Maps backend.`
                : 'The Maps backend returned no matching places.');
        } catch (error: unknown) {
            return callableErrorToToolError(error, 'PLACES_SEARCH_FAILED', 'Failed to search places through the Maps backend.');
        }
    }),

    get_place_details: wrapTool('get_place_details', async () => PLACE_DETAILS_UNAVAILABLE),

    get_distance_matrix: wrapTool('get_distance_matrix', async (rawArgs: { origins?: string[], destinations?: string[] }) => {
        if (!requireUserId()) {
            return toolError('Sign in before requesting distances. The Maps proxy requires an authenticated session.', 'AUTH_REQUIRED');
        }

        const parsed = DistanceMatrixArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
            return toolError('Distance lookups need 1-10 origins and 1-10 destinations (max 100 origin-destination pairs).', 'INVALID_DISTANCE_ARGUMENTS');
        }

        try {
            const computeDistanceMatrix = httpsCallable(functions, 'computeDistanceMatrix');
            const response = await computeDistanceMatrix({
                origins: parsed.data.origins,
                destinations: parsed.data.destinations,
            });
            const result = response.data as {
                rows?: Array<Array<{ status?: string, distanceText?: string, durationText?: string }>>;
                limitations?: string[];
            };
            const rows = result.rows ?? [];
            const failedElements = rows.flat().filter((element) => element.status !== 'OK').length;
            const message = failedElements > 0
                ? `Distance matrix returned with ${failedElements} unresolvable leg(s); see per-leg statuses.`
                : 'Distance matrix returned Google driving estimates for every leg.';
            return toolSuccess({
                origins: parsed.data.origins,
                destinations: parsed.data.destinations,
                rows,
                limitations: result.limitations ?? [],
            }, message);
        } catch (error: unknown) {
            return callableErrorToToolError(error, 'DISTANCE_MATRIX_FAILED', 'Failed to compute distances through the Maps backend.');
        }
    }),
} satisfies Record<string, AnyToolFunction>;
