"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaAppSecret = exports.metaAppId = exports.tiktokClientSecret = exports.tiktokClientKey = exports.spotifyClientSecret = exports.spotifyClientId = exports.githubTokenFounders = exports.pandadocWebhookSecret = exports.telegramWebhookSecret = exports.telegramBotToken = exports.pandaDocApiKey = exports.stripeWebhookSecret = exports.stripeSecretKey = exports.inngestSigningKey = exports.inngestEventKey = exports.googleMapsApiKey = exports.geminiApiKey = void 0;
exports.getGithubTokenFounders = getGithubTokenFounders;
exports.getGeminiApiKey = getGeminiApiKey;
exports.getStripeSecretKey = getStripeSecretKey;
exports.getStripeWebhookSecret = getStripeWebhookSecret;
exports.getPandaDocApiKey = getPandaDocApiKey;
const params_1 = require("firebase-functions/params");
/**
 * Centralized Secret Definitions
 */
exports.geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
exports.googleMapsApiKey = (0, params_1.defineSecret)("GOOGLE_MAPS_API_KEY");
exports.inngestEventKey = (0, params_1.defineSecret)("INNGEST_EVENT_KEY");
exports.inngestSigningKey = (0, params_1.defineSecret)("INNGEST_SIGNING_KEY");
exports.stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
exports.stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
exports.pandaDocApiKey = (0, params_1.defineSecret)("PANDADOC_API_KEY");
exports.telegramBotToken = (0, params_1.defineSecret)("TELEGRAM_BOT_TOKEN");
exports.telegramWebhookSecret = (0, params_1.defineSecret)("TELEGRAM_WEBHOOK_SECRET");
exports.pandadocWebhookSecret = (0, params_1.defineSecret)("PANDADOC_WEBHOOK_SECRET");
// ---------------------------------------------------------------------------
// Founders Program
// ---------------------------------------------------------------------------
// Fine-grained GitHub PAT scoped to contents:write on this repo only.
// Used by activateFounderPass to commit new founder entries to src/config/founders.ts.
// Required secret in GCP Secret Manager: GITHUB_TOKEN_FOUNDERS
exports.githubTokenFounders = (0, params_1.defineSecret)("GITHUB_TOKEN_FOUNDERS");
/**
 * Helper to safely retrieve the GitHub Token for the Founders Program.
 */
function getGithubTokenFounders() {
    const envKey = process.env.GITHUB_TOKEN_FOUNDERS;
    if (envKey && envKey.trim().length > 0)
        return envKey;
    try {
        const secret = exports.githubTokenFounders.value();
        if (secret && secret.trim().length > 0)
            return secret;
    }
    catch (_a) {
        if (process.env.GITHUB_TOKEN_FOUNDERS)
            return process.env.GITHUB_TOKEN_FOUNDERS;
    }
    throw new Error("GitHub Token for Founders Program not found. Please set GITHUB_TOKEN_FOUNDERS secret or environment variable.");
}
/**
 * Helper to safely retrieve the Gemini API Key.
 * Handles both production (secrets) and local development (environment variables).
 */
function getGeminiApiKey() {
    // 1. Try Environment Variable (Local/Dev/Emulator)
    const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (envKey && envKey.trim().length > 0) {
        return envKey;
    }
    // 2. Try Firebase Secret (Production)
    // For V1 functions, secrets are mounted as environment variables.
    // However, defineSecret().value() is the modern way to access them if initialized.
    try {
        const secret = exports.geminiApiKey.value();
        if (secret && secret.trim().length > 0) {
            return secret;
        }
    }
    catch (e) {
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
function getStripeSecretKey() {
    const envKey = process.env.STRIPE_SECRET_KEY;
    if (envKey && envKey.trim().length > 0)
        return envKey;
    try {
        const secret = exports.stripeSecretKey.value();
        if (secret && secret.trim().length > 0)
            return secret;
    }
    catch (e) {
        if (process.env.STRIPE_SECRET_KEY)
            return process.env.STRIPE_SECRET_KEY;
    }
    throw new Error("Stripe Secret Key not found.");
}
/**
 * Helper to safely retrieve the Stripe Webhook Secret.
 */
function getStripeWebhookSecret() {
    const envKey = process.env.STRIPE_WEBHOOK_SECRET;
    if (envKey && envKey.trim().length > 0)
        return envKey;
    try {
        const secret = exports.stripeWebhookSecret.value();
        if (secret && secret.trim().length > 0)
            return secret;
    }
    catch (e) {
        if (process.env.STRIPE_WEBHOOK_SECRET)
            return process.env.STRIPE_WEBHOOK_SECRET;
    }
    throw new Error("Stripe Webhook Secret not found.");
}
/**
 * Helper to safely retrieve the PandaDoc API Key.
 */
function getPandaDocApiKey() {
    const envKey = process.env.PANDADOC_API_KEY;
    if (envKey && envKey.trim().length > 0)
        return envKey;
    try {
        const secret = exports.pandaDocApiKey.value();
        if (secret && secret.trim().length > 0)
            return secret;
    }
    catch (e) {
        if (process.env.PANDADOC_API_KEY)
            return process.env.PANDADOC_API_KEY;
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
exports.spotifyClientId = (0, params_1.defineSecret)("SPOTIFY_CLIENT_ID");
exports.spotifyClientSecret = (0, params_1.defineSecret)("SPOTIFY_CLIENT_SECRET");
exports.tiktokClientKey = (0, params_1.defineSecret)("TIKTOK_CLIENT_KEY");
exports.tiktokClientSecret = (0, params_1.defineSecret)("TIKTOK_CLIENT_SECRET");
exports.metaAppId = (0, params_1.defineSecret)("META_APP_ID");
exports.metaAppSecret = (0, params_1.defineSecret)("META_APP_SECRET");
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
//# sourceMappingURL=secrets.js.map