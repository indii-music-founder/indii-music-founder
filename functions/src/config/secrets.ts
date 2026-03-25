import { defineSecret } from "firebase-functions/params";

/**
 * Centralized Secret Definitions
 */
export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const googleMapsApiKey = defineSecret("GOOGLE_MAPS_API_KEY");
export const inngestEventKey = defineSecret("INNGEST_EVENT_KEY");
export const inngestSigningKey = defineSecret("INNGEST_SIGNING_KEY");
export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
export const pandaDocApiKey = defineSecret("PANDADOC_API_KEY");
export const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");

// ---------------------------------------------------------------------------
// Founders Program
// ---------------------------------------------------------------------------
// Fine-grained GitHub PAT scoped to contents:write on this repo only.
// Used by activateFounderPass to commit new founder entries to src/config/founders.ts.
// Required secret in GCP Secret Manager: GITHUB_TOKEN_FOUNDERS
export const githubTokenFounders = defineSecret("GITHUB_TOKEN_FOUNDERS");

/**
 * Helper to safely retrieve the GitHub Token for the Founders Program.
 */
export function getGithubTokenFounders(): string {
    const envKey = process.env.GITHUB_TOKEN_FOUNDERS;
    if (envKey && envKey.trim().length > 0) return envKey;

    try {
        const secret = githubTokenFounders.value();
        if (secret && secret.trim().length > 0) return secret;
    } catch {
        if (process.env.GITHUB_TOKEN_FOUNDERS) return process.env.GITHUB_TOKEN_FOUNDERS;
    }

    throw new Error("GitHub Token for Founders Program not found. Please set GITHUB_TOKEN_FOUNDERS secret or environment variable.");
}

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

/**
 * Helper to safely retrieve the Stripe Secret Key.
 */
export function getStripeSecretKey(): string {
    const envKey = process.env.STRIPE_SECRET_KEY;
    if (envKey && envKey.trim().length > 0) return envKey;

    try {
        const secret = stripeSecretKey.value();
        if (secret && secret.trim().length > 0) return secret;
    } catch (e) {
        if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
    }

    throw new Error("Stripe Secret Key not found.");
}

/**
 * Helper to safely retrieve the Stripe Webhook Secret.
 */
export function getStripeWebhookSecret(): string {
    const envKey = process.env.STRIPE_WEBHOOK_SECRET;
    if (envKey && envKey.trim().length > 0) return envKey;

    try {
        const secret = stripeWebhookSecret.value();
        if (secret && secret.trim().length > 0) return secret;
    } catch (e) {
        if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
    }

    throw new Error("Stripe Webhook Secret not found.");
}

/**
 * Helper to safely retrieve the PandaDoc API Key.
 */
export function getPandaDocApiKey(): string {
    const envKey = process.env.PANDADOC_API_KEY;
    if (envKey && envKey.trim().length > 0) return envKey;

    try {
        const secret = pandaDocApiKey.value();
        if (secret && secret.trim().length > 0) return secret;
    } catch (e) {
        if (process.env.PANDADOC_API_KEY) return process.env.PANDADOC_API_KEY;
    }

    throw new Error("PandaDoc API Key not found. Please set PANDADOC_API_KEY secret or environment variable.");
}

// ---------------------------------------------------------------------------
// Growth Intelligence Engine — Platform Analytics OAuth Secrets
// ---------------------------------------------------------------------------
// Token exchange logic is in functions/src/analytics/platformTokenExchange.ts.
// Defined here for centralized reference and cross-function reuse.
//
// Required secrets in GCP Secret Manager:
//   - SPOTIFY_CLIENT_ID      (Spotify Developer Dashboard → App → Client ID)
//   - SPOTIFY_CLIENT_SECRET  (Spotify Developer Dashboard → App → Client Secret)
//   - TIKTOK_CLIENT_KEY      (TikTok for Developers → App → Client Key)
//   - TIKTOK_CLIENT_SECRET   (TikTok for Developers → App → Client Secret)
//   - META_APP_ID            (Meta Developer Console → App → App ID)
//   - META_APP_SECRET        (Meta Developer Console → App → App Secret)
export const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
export const spotifyClientSecret = defineSecret("SPOTIFY_CLIENT_SECRET");
export const tiktokClientKey = defineSecret("TIKTOK_CLIENT_KEY");
export const tiktokClientSecret = defineSecret("TIKTOK_CLIENT_SECRET");
export const metaAppId = defineSecret("META_APP_ID");
export const metaAppSecret = defineSecret("META_APP_SECRET");

// ---------------------------------------------------------------------------
// Email OAuth Secrets (Gmail / Outlook)
// ---------------------------------------------------------------------------
// Actual secret access is in functions/src/email/tokenManager.ts via defineSecret.
// Documented here for centralized reference.
//
// Required secrets in GCP Secret Manager:
//   - GOOGLE_OAUTH_CLIENT_ID      (Google Cloud Console → OAuth 2.0 Client ID)
//   - GOOGLE_OAUTH_CLIENT_SECRET  (Google Cloud Console → OAuth 2.0 Client Secret)
//   - MICROSOFT_CLIENT_ID         (Azure Portal → App Registration → Client ID)
//   - MICROSOFT_CLIENT_SECRET     (Azure Portal → App Registration → Client Secret)
