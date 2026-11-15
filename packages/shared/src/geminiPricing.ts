/**
 * Conservative non-global standard rates for Gemini 3.8 Flash, USD per
 * million tokens. Uses the published standard rate rather than the temporary
 * introductory offer so reservations remain sufficient after that offer ends.
 */
export const GEMINI_38_FLASH_STANDARD_NON_GLOBAL_PRICING = {
    inputPerMillion: 1.65,
    outputPerMillion: 8.25,
} as const;
