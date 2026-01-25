import { defineSecret } from "firebase-functions/params";

/**
 * Centralized Secret Definitions
 */
export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const googleMapsApiKey = defineSecret("GOOGLE_MAPS_API_KEY");
export const inngestEventKey = defineSecret("INNGEST_EVENT_KEY");
export const inngestSigningKey = defineSecret("INNGEST_SIGNING_KEY");

/**
 * Helper to safely retrieve the Gemini API Key.
 * Handles both production (secrets) and local development (environment variables).
 */
export function getGeminiApiKey(): string {
    // 1. Try Environment Variable (Local/Dev/Emulator)
    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (envKey && envKey.trim().length > 0) {
        return envKey;
    }

    // 2. Try Firebase Secret (Production)
    // For V1 functions, secrets are mounted as environment variables.
    // However, defineSecret().value() is the modern way to access them if initialized.
    try {
        const secret = geminiApiKey.value();
        if (secret && secret.trim().length > 0) {
            return secret;
        }
    } catch (e) {
        // Fallback to direct process.env check in case .value() fails in specific contexts
        const directEnv = process.env.GEMINI_API_KEY;
        if (directEnv && directEnv.trim().length > 0) {
            return directEnv;
        }
    }

    throw new Error("Gemini API Key not found. Please set GEMINI_API_KEY secret or environment variable.");
}
