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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPlaces = exports.checkLogistics = exports.generateItinerary = exports.listGKEClusters = exports.imageResizing = exports.ragProxy = exports.generateContentStream = exports.generateSpeech = exports.analyzeAudio = exports.editImage = exports.generateImageV3 = exports.inngestApi = exports.renderVideo = exports.triggerLongFormVideoJob = exports.executeVideoJob = exports.triggerVideoJob = exports.getInngestClient = exports.getTelegramLinkStatus = exports.generateTelegramLinkCode = exports.telegramWebhook = exports.processRelayCommand = exports.flagVideosForArchival = exports.trackStorageQuotas = exports.cleanupOrphanedVideos = exports.analyticsRevokeToken = exports.analyticsRefreshToken = exports.analyticsExchangeToken = exports.emailRevokeToken = exports.emailRefreshToken = exports.emailExchangeToken = exports.pollTimelineMilestones = exports.deliverScheduledPosts = exports.processISWCMappingV2 = exports.pandadocWebhook = exports.pandadocGetSigningLink = exports.pandadocGetDocumentStatus = exports.pandadocSendDocument = exports.pandadocCreateDocument = exports.pandadocListTemplates = exports.verifyMechanicalLicense = exports.sendForDigitalSignature = exports.exportSplitSheet = exports.processDDEXAck = exports.pollDeliveryStatus = exports.requestTaxForms = exports.signEscrow = exports.initiateSplitEscrow = exports.createStripeConnectAccount = exports.createTransfer = exports.createStripeAccount = void 0;
exports.enrichFanData = exports.healthCheckWest1 = exports.healthCheck = exports.requestAccountDeletion = exports.exportUserData = exports.activateFounderPass = exports.stripeWebhook = exports.trackUsage = exports.getUsageStats = exports.getCustomerPortal = exports.resumeSubscription = exports.cancelSubscription = exports.generateInvoice = exports.createOneTimeCheckout = exports.createCheckoutSession = exports.getSubscription = exports.listBigQueryDatasets = exports.getBigQueryTableSchema = exports.executeBigQueryQuery = exports.restartGCEInstance = exports.listGCEInstances = exports.scaleGKENodePool = exports.getGKEClusterStatus = exports.createInfluencerBounty = exports.dispatchSocialPost = exports.executeCampaign = exports.calculateFuelLogistics = void 0;
// indiiOS Cloud Functions - V1.1
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
const video_1 = require("./lib/video");
const audio_1 = require("./lib/audio");
const long_form_video_1 = require("./lib/long_form_video");
const video_generation_1 = require("./lib/video_generation");
const video_generation_direct_1 = require("./lib/video_generation_direct");
const milestone_execution_1 = require("./timeline/milestone_execution");
const image_generation_1 = require("./lib/image_generation");
const audio_2 = require("./lib/audio");
const models_1 = require("./config/models");
const pricing_1 = require("./config/pricing");
const rateLimit_1 = require("./lib/rateLimit");
const image_resizing_1 = require("./lib/image_resizing");
// Vertex AI SDK
// import { VertexAI } from "@google-cloud/vertexai";
// Item 335: GoogleGenAI is loaded lazily inside the handler to reduce cold start time
// import { GoogleGenAI } from "@google/genai";
// Polyfill for v1 Firebase Functions migrating to modern Node/Gen 2
if (!process.env.GCLOUD_PROJECT) {
    process.env.GCLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "indiios-v-1-1";
}
// Initialize Firebase Admin
admin.initializeApp();
// Stripe Connect Functions
var connect_1 = require("./stripe/connect");
Object.defineProperty(exports, "createStripeAccount", { enumerable: true, get: function () { return connect_1.createStripeAccount; } });
Object.defineProperty(exports, "createTransfer", { enumerable: true, get: function () { return connect_1.createTransfer; } });
var createStripeConnectAccount_1 = require("./stripe/createStripeConnectAccount");
Object.defineProperty(exports, "createStripeConnectAccount", { enumerable: true, get: function () { return createStripeConnectAccount_1.createStripeConnectAccount; } });
// Stripe Split Escrow (Item 135)
var splitEscrow_1 = require("./stripe/splitEscrow");
Object.defineProperty(exports, "initiateSplitEscrow", { enumerable: true, get: function () { return splitEscrow_1.initiateSplitEscrow; } });
Object.defineProperty(exports, "signEscrow", { enumerable: true, get: function () { return splitEscrow_1.signEscrow; } });
var taxForms_1 = require("./stripe/taxForms");
Object.defineProperty(exports, "requestTaxForms", { enumerable: true, get: function () { return taxForms_1.requestTaxForms; } });
// Distribution Functions (Item 218: Delivery Status Polling)
var pollDeliveryStatus_1 = require("./distribution/pollDeliveryStatus");
Object.defineProperty(exports, "pollDeliveryStatus", { enumerable: true, get: function () { return pollDeliveryStatus_1.pollDeliveryStatus; } });
// Distribution Functions (Item 415: DDEX DSP Acknowledgement Processing)
var processDDEXAck_1 = require("./distribution/processDDEXAck");
Object.defineProperty(exports, "processDDEXAck", { enumerable: true, get: function () { return processDDEXAck_1.processDDEXAck; } });
// Legal Functions (Item 412: Split Sheet PDF Export)
var exportSplitSheet_1 = require("./legal/exportSplitSheet");
Object.defineProperty(exports, "exportSplitSheet", { enumerable: true, get: function () { return exportSplitSheet_1.exportSplitSheet; } });
var digitalSignature_1 = require("./legal/digitalSignature");
Object.defineProperty(exports, "sendForDigitalSignature", { enumerable: true, get: function () { return digitalSignature_1.sendForDigitalSignature; } });
var mechanicalLicense_1 = require("./legal/mechanicalLicense");
Object.defineProperty(exports, "verifyMechanicalLicense", { enumerable: true, get: function () { return mechanicalLicense_1.verifyMechanicalLicense; } });
// Legal Functions (Item 242: PandaDoc Proxy — API key secured server-side)
var pandadocProxy_1 = require("./legal/pandadocProxy");
Object.defineProperty(exports, "pandadocListTemplates", { enumerable: true, get: function () { return pandadocProxy_1.pandadocListTemplates; } });
Object.defineProperty(exports, "pandadocCreateDocument", { enumerable: true, get: function () { return pandadocProxy_1.pandadocCreateDocument; } });
Object.defineProperty(exports, "pandadocSendDocument", { enumerable: true, get: function () { return pandadocProxy_1.pandadocSendDocument; } });
Object.defineProperty(exports, "pandadocGetDocumentStatus", { enumerable: true, get: function () { return pandadocProxy_1.pandadocGetDocumentStatus; } });
Object.defineProperty(exports, "pandadocGetSigningLink", { enumerable: true, get: function () { return pandadocProxy_1.pandadocGetSigningLink; } });
// Legal Functions: PandaDoc Webhook (contract signed → career event → auto-pipeline)
var pandadocWebhook_1 = require("./legal/pandadocWebhook");
Object.defineProperty(exports, "pandadocWebhook", { enumerable: true, get: function () { return pandadocWebhook_1.pandadocWebhook; } });
// Publishing Functions: ISWC Mapper (PandaDoc → composition registration)
// Re-exported as V2 alias to avoid collision with the old HTTPS-triggered version
// that may still be deployed. Once the old `processISWCMapping` is deleted from GCP
// console (firebase functions:delete processISWCMapping), rename this back.
var iswcMapper_1 = require("./publishing/iswcMapper");
Object.defineProperty(exports, "processISWCMappingV2", { enumerable: true, get: function () { return iswcMapper_1.processISWCMapping; } });
// Social Functions (Item 226: Scheduled Post Background Delivery)
var deliverScheduledPosts_1 = require("./social/deliverScheduledPosts");
Object.defineProperty(exports, "deliverScheduledPosts", { enumerable: true, get: function () { return deliverScheduledPosts_1.deliverScheduledPosts; } });
// Timeline Orchestrator (Progressive Campaign Engine — polls every 15 min for due milestones)
var pollTimelineMilestones_1 = require("./timeline/pollTimelineMilestones");
Object.defineProperty(exports, "pollTimelineMilestones", { enumerable: true, get: function () { return pollTimelineMilestones_1.pollTimelineMilestones; } });
// Email OAuth Token Manager (Gmail / Outlook — server-side token exchange & refresh)
var tokenManager_1 = require("./email/tokenManager");
Object.defineProperty(exports, "emailExchangeToken", { enumerable: true, get: function () { return tokenManager_1.emailExchangeToken; } });
Object.defineProperty(exports, "emailRefreshToken", { enumerable: true, get: function () { return tokenManager_1.emailRefreshToken; } });
Object.defineProperty(exports, "emailRevokeToken", { enumerable: true, get: function () { return tokenManager_1.emailRevokeToken; } });
// Growth Intelligence Engine — Platform Analytics OAuth (Spotify, TikTok, Instagram)
var platformTokenExchange_1 = require("./analytics/platformTokenExchange");
Object.defineProperty(exports, "analyticsExchangeToken", { enumerable: true, get: function () { return platformTokenExchange_1.analyticsExchangeToken; } });
Object.defineProperty(exports, "analyticsRefreshToken", { enumerable: true, get: function () { return platformTokenExchange_1.analyticsRefreshToken; } });
Object.defineProperty(exports, "analyticsRevokeToken", { enumerable: true, get: function () { return platformTokenExchange_1.analyticsRevokeToken; } });
// Storage Maintenance (Scheduled — orphan cleanup, quota tracking, archival flagging)
var storageMaintenance_1 = require("./devops/storageMaintenance");
Object.defineProperty(exports, "cleanupOrphanedVideos", { enumerable: true, get: function () { return storageMaintenance_1.cleanupOrphanedVideos; } });
Object.defineProperty(exports, "trackStorageQuotas", { enumerable: true, get: function () { return storageMaintenance_1.trackStorageQuotas; } });
Object.defineProperty(exports, "flagVideosForArchival", { enumerable: true, get: function () { return storageMaintenance_1.flagVideosForArchival; } });
// Remote Relay — Server-Side Agent Processing (replaces desktop-browser-dependent relay)
var relayCommandProcessor_1 = require("./relay/relayCommandProcessor");
Object.defineProperty(exports, "processRelayCommand", { enumerable: true, get: function () { return relayCommandProcessor_1.processRelayCommand; } });
// Telegram Bot Adapter — Phase 2 Multi-Channel (bridges Telegram → Firestore relay)
var telegramWebhook_1 = require("./relay/telegramWebhook");
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramWebhook_1.telegramWebhook; } });
var telegramLink_1 = require("./relay/telegramLink");
Object.defineProperty(exports, "generateTelegramLinkCode", { enumerable: true, get: function () { return telegramLink_1.generateTelegramLinkCode; } });
Object.defineProperty(exports, "getTelegramLinkStatus", { enumerable: true, get: function () { return telegramLink_1.getTelegramLinkStatus; } });
// App Check enforcement flag — controls whether Firebase App Check tokens are validated.
// PRODUCTION ENABLEMENT (Item 247):
//   1. Set up reCAPTCHA Enterprise in GCP Console for your project.
//   2. Register your app in Firebase Console → App Check → reCAPTCHA Enterprise.
//   3. Add VITE_FIREBASE_APP_CHECK_KEY to your .env and CI secrets.
//   4. App Check is ENFORCED by default in production. To disable in local dev:
//      Set SKIP_APP_CHECK=true in your local .env or GCP Cloud Run environment.
//   5. Deploy: firebase deploy --only functions
//   CAUTION: Requires reCAPTCHA Enterprise configured in Firebase Console for all clients.
// Item 331: Default ENFORCE to true — opt-out via SKIP_APP_CHECK=true for dev environments.
const ENFORCE_APP_CHECK = process.env.SKIP_APP_CHECK !== 'true';
/**
 * Security Helper: Validate Organization Access
 *
 * Ensures the authenticated user is a member of the target organization.
 * Prevents IDOR/Injection attacks where users create jobs for orgs they don't belong to.
 */
const validateOrgAccess = async (userId, orgId) => {
    // 1. Personal workspace and default org are always allowed (scoped to user in logic)
    if (!orgId || orgId === 'personal' || orgId === 'org-default') {
        return;
    }
    // 2. Fetch Organization
    const orgRef = admin.firestore().collection('organizations').doc(orgId);
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Organization '${orgId}' not found.`);
    }
    const orgData = orgDoc.data();
    const members = (orgData === null || orgData === void 0 ? void 0 : orgData.members) || [];
    // 3. Verify Membership
    if (!members.includes(userId)) {
        console.warn(`[Security] User ${userId} attempted to access restricted org ${orgId}`);
        throw new functions.https.HttpsError("permission-denied", "You are not a member of this organization.");
    }
};
// Import Shared Secrets
const secrets_1 = require("./config/secrets");
// Lazy Initialize Inngest Client
const getInngestClient = () => {
    return new inngest_1.Inngest({
        id: "indii-os-functions",
        eventKey: secrets_1.inngestEventKey.value()
    });
};
exports.getInngestClient = getInngestClient;
/**
 * Security Helper: Enforce Admin Access
 *
 * Checks if the user has the 'admin' custom claim.
 * If not, logs a warning and throws Permission Denied.
 */
const requireAdmin = (context) => {
    // 1. Must be authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    // 2. Must have 'admin' custom claim
    // Note: If no admins exist yet, this securely defaults to deny-all.
    // Use the Firebase Admin SDK or a script to set `admin: true` on specific UIDs.
    if (!context.auth.token.admin) {
        console.warn(`[Security] Unauthorized access attempt by ${context.auth.uid} (missing admin claim)`);
        throw new functions.https.HttpsError("permission-denied", "Access denied: Admin privileges required.");
    }
};
/**
 * CORS Configuration
 *
 * SECURITY: Whitelist specific origins instead of allowing all.
 * This prevents unauthorized websites from calling our Cloud Functions.
 */
const getAllowedOrigins = () => {
    const origins = [
        'https://indiios-studio.web.app',
        'https://indiios-studio.firebaseapp.com',
        'https://indiios-v-1-1.web.app',
        'https://indiios-v-1-1.firebaseapp.com',
        'https://studio.indiios.com',
        'https://indiios.com',
        'app://.', // Electron app
        'http://localhost:4242' // Electron Studio (Vite)
    ];
    // Add localhost origins in emulator/development mode
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
        origins.push('http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:4242');
    }
    return origins;
};
const corsHandler = (0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        // We rely on ID Token verification (Bearer token) for actual security.
        if (!origin) {
            return callback(null, true);
        }
        // Check if origin is in whitelist
        if (origin && allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Reject unauthorized origins
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('CORS not allowed'));
    },
    credentials: true
});
const TIER_LIMITS = {
    free: {
        maxVideoDuration: 8 * 60, // 8 minutes
        maxVideoGenerationsPerDay: 5,
    },
    pro: {
        maxVideoDuration: 60 * 60, // 60 minutes
        maxVideoGenerationsPerDay: 50,
    },
    enterprise: {
        maxVideoDuration: 4 * 60 * 60, // 4 hours
        maxVideoGenerationsPerDay: 500,
    },
};
// Polling Constants
// const VIDEO_POLL_INTERVAL_SEC = 5;
// const VIDEO_MAX_POLL_ATTEMPTS = 60;
// ----------------------------------------------------------------------------
// Video Generation (Veo)
// ----------------------------------------------------------------------------
/**
 * Trigger Video Generation Job
 *
 * This callable function acts as the bridge between the Client App (Electron)
 * and the Asynchronous Worker Queue (Inngest).
 */
exports.triggerVideoJob = functions
    .region("us-west1")
    .runWith({
    timeoutSeconds: 60,
    memory: "2GB",
    enforceAppCheck: ENFORCE_APP_CHECK
})
    // Item 352: Explicit return type annotation
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to trigger video generation.");
    }
    const userId = context.auth.uid;
    // Rate limit: 10 video generation requests per minute
    await (0, rateLimit_1.enforceRateLimit)(userId, "triggerVideoJob", rateLimit_1.RATE_LIMITS.generation);
    // Construct input matching the schema
    const safeData = (typeof data === 'object' && data !== null) ? data : {};
    const inputData = Object.assign(Object.assign({}, safeData), { userId });
    // Zod Validation
    const validation = video_1.VideoJobSchema.safeParse(inputData);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    const { prompt, jobId, orgId } = inputData, options = __rest(inputData, ["prompt", "jobId", "orgId"]);
    // SECURITY: Verify Org Access
    await validateOrgAccess(userId, orgId);
    try {
        // Calculate estimated cost
        const estimatedCost = (0, pricing_1.estimateVideoCost)({
            model: options.model,
            durationSeconds: options.durationSeconds || options.duration,
            resolution: options.resolution,
            generateAudio: options.generateAudio
        });
        // 1. Create Initial Job Record in Firestore (Atomic Create to prevent overwrites)
        await admin.firestore().collection("videoJobs").doc(jobId).create({
            id: jobId,
            userId: userId,
            orgId: orgId || "personal",
            prompt: prompt,
            status: "queued",
            estimatedCost: estimatedCost,
            options: options,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 2. That's it — the Firestore document creation above will trigger
        //    executeVideoJob via Firestore onCreate. No self-invocation needed.
        console.log(`[VideoJob] Triggered for JobID: ${jobId}, User: ${userId}`);
        return { success: true, message: "Video generation job started." };
    }
    catch (error) {
        console.error("[VideoJob] Error triggering video generation:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue video job: ${error.message}`);
    }
});
/**
 * Execute Video Job (Long-Running)
 *
 * This is the actual video generation worker. It runs the full Vertex AI pipeline
 * directly, bypassing the broken Inngest callback system.
 *
 * Triggered automatically by Firestore onCreate when triggerVideoJob creates
 * a new document in the videoJobs collection.
 * 540s timeout (9 minutes) — enough for Vertex AI video generation + polling.
 */
exports.executeVideoJob = functions
    .region("us-west1")
    .runWith({
    enforceAppCheck: ENFORCE_APP_CHECK,
    timeoutSeconds: 540, // 9 minutes
    memory: "2GB"
})
    .firestore.document("videoJobs/{jobId}")
    .onCreate(async (snapshot, context) => {
    const jobId = context.params.jobId;
    const data = snapshot.data();
    // Only process documents with status "queued"
    if (data.status !== "queued") {
        console.log(`[executeVideoJob] Skipping job ${jobId} — status is "${data.status}", not "queued".`);
        return;
    }
    const userId = data.userId;
    const prompt = data.prompt;
    const orgId = data.orgId || "personal";
    const options = data.options || {};
    if (!userId || !prompt) {
        console.error(`[executeVideoJob] Missing required fields for job ${jobId}: userId=${userId}, prompt=${prompt}`);
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "failed",
            error: "Missing required fields: userId or prompt",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return;
    }
    console.log(`[executeVideoJob] Starting video generation for job ${jobId}`);
    // Run the generation
    try {
        await (0, video_generation_direct_1.generateVideoDirect)({
            jobId,
            userId,
            orgId,
            prompt,
            options
        });
    }
    catch (error) {
        // Error is already handled inside generateVideoDirect (Firestore updated to "failed")
        console.error(`[executeVideoJob] Unhandled error for ${jobId}:`, error);
    }
});
/**
 * Trigger Long Form Video Generation Job
 *
 * Handles multi-segment video generation (daisychaining) as a background process.
 */
exports.triggerLongFormVideoJob = functions
    .region("us-west1")
    .runWith({
    secrets: [secrets_1.inngestEventKey],
    timeoutSeconds: 60,
    memory: "2GB",
    enforceAppCheck: ENFORCE_APP_CHECK
})
    // Item 352: Explicit return type annotation
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated for long form generation.");
    }
    const userId = context.auth.uid;
    // Rate limit: 10 long-form video requests per minute
    await (0, rateLimit_1.enforceRateLimit)(userId, "triggerLongFormVideoJob", rateLimit_1.RATE_LIMITS.generation);
    // Zod Validation
    const safeData = (typeof data === 'object' && data !== null) ? data : {};
    const inputData = Object.assign(Object.assign({}, safeData), { userId });
    const validation = long_form_video_1.LongFormVideoJobSchema.safeParse(inputData);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    // Destructure validated data
    const { prompts, jobId, orgId, totalDuration, startImage, options } = validation.data;
    // SECURITY: Verify Org Access
    await validateOrgAccess(userId, orgId);
    // Additional validation
    if (prompts.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Prompts array must not be empty.");
    }
    try {
        // ------------------------------------------------------------------
        // Quota Enforcement (Server-Side)
        // ------------------------------------------------------------------
        let userTier = 'free';
        if (orgId && orgId !== 'personal') {
            const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get();
            if (orgDoc.exists) {
                const orgData = orgDoc.data();
                userTier = (orgData === null || orgData === void 0 ? void 0 : orgData.plan) || 'free';
            }
        }
        const limits = TIER_LIMITS[userTier];
        const durationNum = parseFloat((totalDuration || 0).toString());
        // FIX #4: GOD MODE via admin claim or environment config (no hardcoded email)
        const godModeEmails = (process.env.GOD_MODE_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
        const isGodMode = ((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin) === true ||
            godModeEmails.includes(((_d = (_c = context.auth) === null || _c === void 0 ? void 0 : _c.token) === null || _d === void 0 ? void 0 : _d.email) || '');
        // 2. Validate Duration Limit
        if (!isGodMode && durationNum > limits.maxVideoDuration) {
            throw new functions.https.HttpsError("resource-exhausted", `Video duration ${durationNum}s exceeds ${userTier} tier limit of ${limits.maxVideoDuration}s.`);
        }
        // Daily Usage Check
        const today = new Date().toISOString().split('T')[0];
        const usageRef = admin.firestore().collection('users').doc(userId).collection('usage').doc(today);
        await admin.firestore().runTransaction(async (transaction) => {
            var _a;
            const usageDoc = await transaction.get(usageRef);
            const currentUsage = usageDoc.exists ? (((_a = usageDoc.data()) === null || _a === void 0 ? void 0 : _a.videosGenerated) || 0) : 0;
            if (!isGodMode && currentUsage >= limits.maxVideoGenerationsPerDay) {
                throw new functions.https.HttpsError("resource-exhausted", `Daily video generation limit reached for ${userTier} tier (${limits.maxVideoGenerationsPerDay}/day).`);
            }
            // Increment Usage Optimistically
            if (!usageDoc.exists) {
                transaction.set(usageRef, { videosGenerated: 1, date: today, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            else {
                transaction.update(usageRef, { videosGenerated: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
        });
        // ------------------------------------------------------------------
        // 4. Create Parent Job Record
        // Calculate estimated cost for long-form (sum of segments)
        // SENTRY FIX (PR #1200): Use DEFAULT_SEGMENT_DURATION_SECONDS (5s) instead of hardcoded 8s to prevent cost inflation.
        const estimatedCostPerSegment = (0, pricing_1.estimateVideoCost)({
            model: options.model,
            durationSeconds: 5, // Aligned with DEFAULT_SEGMENT_DURATION_SECONDS in long_form_video.ts
            resolution: options.resolution,
            generateAudio: options.generateAudio
        });
        const totalEstimatedCost = parseFloat((estimatedCostPerSegment * prompts.length).toFixed(4));
        // 1. Create Parent Job Record (Atomic Create)
        await admin.firestore().collection("videoJobs").doc(jobId).create({
            id: jobId,
            userId: userId,
            orgId: orgId || "personal",
            prompt: prompts[0], // Main prompt
            status: "queued",
            isLongForm: true,
            totalSegments: prompts.length,
            completedSegments: 0,
            estimatedCost: totalEstimatedCost,
            options: options,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 5. Publish Event to Inngest for Long Form
        const inngest = (0, exports.getInngestClient)();
        await inngest.send({
            name: "video/long_form.requested",
            data: {
                jobId,
                userId,
                orgId: orgId || "personal",
                prompts,
                totalDuration,
                startImage,
                options,
                timestamp: Date.now(),
            },
            user: { id: userId }
        });
        return { success: true, message: "Long form video generation started." };
    }
    catch (error) {
        console.error("[LongFormVideoJob] Error:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", `Failed to queue long form job: ${error.message}`);
    }
});
/**
 * Render Video Composition (Stitching)
 *
 * Receives a project composition from the frontend editor, flattens it,
 * and queues a stitching job via Inngest.
 */
exports.renderVideo = functions
    .region("us-west1")
    .runWith({
    secrets: [secrets_1.inngestEventKey],
    timeoutSeconds: 60,
    memory: "2GB",
    enforceAppCheck: ENFORCE_APP_CHECK
})
    // Item 352: Explicit return type annotation
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to render video.");
    }
    const userId = context.auth.uid;
    const safeData = (typeof data === 'object' && data !== null) ? data : {};
    const { compositionId, inputProps } = safeData;
    const project = inputProps === null || inputProps === void 0 ? void 0 : inputProps.project;
    if (!project || !project.tracks || !project.clips) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid project data. Missing tracks or clips.");
    }
    const jobId = compositionId || `render_${Date.now()}`;
    try {
        // 1. Flatten Tracks to Segment List
        // Simple logic: sort clips by startFrame.
        // Note: This MVP implementation assumes sequential non-overlapping clips
        // or prioritizes the first track for stitching.
        // Google Transcoder Stitching requires a list of inputs.
        // Filter only video clips
        const videoClips = project.clips
            .filter((c) => c.type === 'video')
            .sort((a, b) => a.startFrame - b.startFrame);
        if (videoClips.length === 0) {
            throw new functions.https.HttpsError("failed-precondition", "No video clips found in project to render.");
        }
        const segmentUrls = videoClips.map((c) => c.src);
        // 2. Create Job Record (Atomic Create)
        await admin.firestore().collection("videoJobs").doc(jobId).create({
            id: jobId,
            userId: userId,
            orgId: "personal",
            status: "queued",
            type: "render_stitch",
            clipCount: videoClips.length,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 3. Trigger Stitching via Inngest
        const inngest = (0, exports.getInngestClient)();
        await inngest.send({
            name: "video/stitch.requested",
            data: {
                jobId: jobId,
                userId: userId,
                segmentUrls: segmentUrls,
                options: {
                    resolution: `${project.width}x${project.height}`,
                    aspectRatio: project.width > project.height ? "16:9" : "9:16" // Rough approximation
                }
            },
            user: { id: userId }
        });
        return { success: true, renderId: jobId, message: "Render job queued." };
    }
    catch (error) {
        console.error("[RenderVideo] Error:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue render job: ${error.message}`);
    }
});
/**
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
exports.inngestApi = functions
    .runWith({
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.inngestSigningKey, secrets_1.inngestEventKey, secrets_1.geminiApiKey],
    timeoutSeconds: 540 // 9 minutes
})
    .https.onRequest(async (req, res) => {
    const inngestClient = (0, exports.getInngestClient)();
    // 1. Single Video Generation Logic using Veo
    const generateVideo = (0, video_generation_1.generateVideoFn)(inngestClient, secrets_1.geminiApiKey);
    // 2. Long Form Video Generation Logic (Daisychaining)
    const generateLongFormVideo = (0, long_form_video_1.generateLongFormVideoFn)(inngestClient, secrets_1.geminiApiKey);
    // 3. Stitching Function (Server-Side using Google Transcoder)
    const stitchVideo = (0, long_form_video_1.stitchVideoFn)(inngestClient);
    // Timeline Orchestrator: Autonomous milestone execution
    const executeMilestone = (0, milestone_execution_1.executeMilestoneFn)(inngestClient);
    const handler = (0, express_1.serve)({
        client: inngestClient,
        functions: [generateVideo, generateLongFormVideo, stitchVideo, executeMilestone],
        signingKey: secrets_1.inngestSigningKey.value(),
    });
    return handler(req, res);
});
// ----------------------------------------------------------------------------
// Image Generation (Gemini)
// ----------------------------------------------------------------------------
// Image Generation v3 (Nano Banana Pro / Gemini 3 Pro Image)
// Deployed to us-west1 for Model Availability
// Image Generation v3 (Nano Banana Pro / Gemini 3 Pro Image)
// Deployed to us-west1 for Model Availability
exports.generateImageV3 = (0, image_generation_1.generateImageV3Fn)();
exports.editImage = (0, image_generation_1.editImageFn)();
exports.analyzeAudio = (0, audio_2.analyzeAudioFn)();
exports.generateSpeech = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, secrets: [secrets_1.geminiApiKey], timeoutSeconds: 60, memory: "512MB" })
    // Item 352: Explicit return type annotation
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    // Rate limit: 10 speech generation requests per minute
    await (0, rateLimit_1.enforceRateLimit)(context.auth.uid, "generateSpeech", rateLimit_1.RATE_LIMITS.generation);
    const validation = audio_1.GenerateSpeechRequestSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", validation.error.message);
    }
    const { text, voice, model } = validation.data;
    try {
        console.log(`[generateSpeech] Generating speech with model: ${model}`);
        const modelId = model || models_1.FUNCTION_AI_MODELS.SPEECH.GENERATION;
        const apiKey = (0, secrets_1.getGeminiApiKey)();
        // Use REST API for precise control over TTS config
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voice
                            }
                        }
                    }
                }
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini TTS API Error: ${response.status} ${errText}`);
        }
        const result = await response.json();
        // Extract audio data (inlineData)
        const part = (_d = (_c = (_b = (_a = result.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0];
        const audioContent = (_e = part === null || part === void 0 ? void 0 : part.inlineData) === null || _e === void 0 ? void 0 : _e.data;
        if (!audioContent) {
            console.error("[generateSpeech] Unexpected response structure:", JSON.stringify(result));
            throw new Error("No audio content returned from API");
        }
        return { audioContent };
    }
    catch (error) {
        console.error("[generateSpeech] Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Speech generation failed");
    }
});
exports.generateContentStream = functions
    .runWith({
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.geminiApiKey],
    timeoutSeconds: 300
})
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, e_1, _b, _c;
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        // Verify Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).send('Unauthorized');
            return;
        }
        const idToken = authHeader.substring(7).trim(); // 'Bearer '.length === 7
        if (!idToken) {
            res.status(401).send('Unauthorized: Missing token');
            return;
        }
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch (error) {
            res.status(403).send('Forbidden: Invalid Token');
            return;
        }
        try {
            const { model, contents, config } = req.body;
            const modelId = model || "gemini-2.5-pro";
            // SECURITY: Strict Model Allowlist (Anti-SSRF / Cost Control)
            // Only allow approved models for streaming text generation.
            // See src/core/config/ai-models.ts for the master list.
            const ALLOWED_MODELS = [
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-pro-preview",
            ];
            if (!ALLOWED_MODELS.includes(modelId)) {
                console.warn(`[Security] Blocked unauthorized model access: ${modelId}`);
                res.status(400).send('Invalid or unauthorized model ID.');
                return;
            }
            // Initialize SDK Client (dynamic import — Item 335: reduces cold start)
            const { GoogleGenAI } = await Promise.resolve().then(() => __importStar(require("@google/genai")));
            const client = new GoogleGenAI({ apiKey: (0, secrets_1.getGeminiApiKey)() });
            // Generate Content Stream
            const result = await client.models.generateContentStream({
                model: modelId,
                contents: contents, // SDK accepts standard Content format
                config: config
            });
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            try {
                // Iterate over SDK Stream
                for (var _d = true, result_1 = __asyncValues(result), result_1_1; result_1_1 = await result_1.next(), _a = result_1_1.done, !_a; _d = true) {
                    _c = result_1_1.value;
                    _d = false;
                    const chunk = _c;
                    const text = chunk.text;
                    if (text) {
                        res.write(JSON.stringify({ text }) + '\n');
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = result_1.return)) await _b.call(result_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            res.end();
        }
        catch (error) {
            console.error("[generateContentStream] Error:", error);
            if (!res.headersSent) {
                res.status(500).send(error.message);
            }
            else {
                res.end();
            }
        }
    });
});
exports.ragProxy = functions
    .runWith({
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [secrets_1.geminiApiKey],
    timeoutSeconds: 60
})
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).send('Unauthorized');
            return;
        }
        const idToken = authHeader.substring(7).trim(); // 'Bearer '.length === 7
        if (!idToken) {
            res.status(401).send('Unauthorized: Missing token');
            return;
        }
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch (error) {
            res.status(403).send('Forbidden: Invalid Token');
            return;
        }
        try {
            // SECURITY: Block Method Override Headers to prevent bypassing method checks
            // Express might handle X-HTTP-Method-Override automatically, so strict method checking is key.
            // 1. BLOCK DELETE (Data Integrity / Anti-Griefing)
            // Prevents users from deleting files that might belong to others in the shared project.
            if (req.method === 'DELETE') {
                res.status(403).send('Forbidden: Method not allowed');
                return;
            }
            const baseUrl = 'https://generativelanguage.googleapis.com';
            const targetPath = req.path;
            const allowedPrefixes = [
                '/v1beta/files',
                '/v1beta/models',
                '/upload/v1beta/files',
                '/v1beta/fileSearchStores', // RAG: File Search Store management (create, list, importFile)
                '/v1beta/operations' // RAG: Async operation polling for importFile completions
            ];
            // 2. BLOCK LIST ALL FILES (Privacy / Anti-IDOR)
            // Prevents users from listing all files uploaded to the shared project.
            // Exception: Getting metadata for a SPECIFIC file is allowed (path has extra segments).
            // Path must NOT be exactly '/v1beta/files' if method is GET.
            if (req.method === 'GET' && req.path === '/v1beta/files') {
                res.status(403).send('Forbidden: Listing files is disabled for security');
                return;
            }
            const isAllowed = allowedPrefixes.some(prefix => req.path === prefix || req.path.startsWith(prefix + '/'));
            if (!isAllowed) {
                res.status(403).send('Forbidden: Path not allowed');
                return;
            }
            const queryString = req.url.split('?')[1] || '';
            const targetUrl = `${baseUrl}${targetPath}?key=${(0, secrets_1.getGeminiApiKey)()}${queryString ? `&${queryString}` : ''}`;
            const fetchOptions = {
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: (req.method !== 'GET' && req.method !== 'HEAD') ?
                    (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body)
                    : undefined
            };
            const response = await fetch(targetUrl, fetchOptions);
            const data = await response.text();
            res.status(response.status);
            try {
                res.send(JSON.parse(data));
            }
            catch (_a) {
                res.send(data);
            }
        }
        catch (error) {
            res.status(500).send({ error: error.message });
        }
    });
});
// ----------------------------------------------------------------------------
// DevOps Tools - GKE & GCE Management
// ----------------------------------------------------------------------------
const gkeService = __importStar(require("./devops/gkeService"));
const gceService = __importStar(require("./devops/gceService"));
const bigqueryService = __importStar(require("./analytics/bigqueryService"));
const touringService = __importStar(require("./lib/touring"));
const marketingService = __importStar(require("./lib/marketing"));
exports.imageResizing = {
    generateThumbnail: image_resizing_1.generateThumbnail
};
/**
 * List GKE Clusters
 */
exports.listGKEClusters = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (_data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await gkeService.listClusters(projectId);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// ----------------------------------------------------------------------------
// Road Manager (Touring)
// ----------------------------------------------------------------------------
exports.generateItinerary = touringService.generateItinerary;
exports.checkLogistics = touringService.checkLogistics;
exports.findPlaces = touringService.findPlaces;
exports.calculateFuelLogistics = touringService.calculateFuelLogistics;
// Marketing
exports.executeCampaign = marketingService.executeCampaign;
exports.dispatchSocialPost = marketingService.dispatchSocialPost;
exports.createInfluencerBounty = marketingService.createInfluencerBounty;
/**
 * Get GKE Cluster Status
 */
exports.getGKEClusterStatus = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await gkeService.getClusterStatus(projectId, data.location, data.clusterName);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Scale GKE Node Pool
 */
exports.scaleGKENodePool = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await gkeService.scaleNodePool(projectId, data.location, data.clusterName, data.nodePoolName, data.nodeCount);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * List GCE Instances
 */
exports.listGCEInstances = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (_data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await gceService.listInstances(projectId);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Restart GCE Instance
 */
exports.restartGCEInstance = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await gceService.resetInstance(projectId, data.zone, data.instanceName);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// ----------------------------------------------------------------------------
// BigQuery Analytics
// ----------------------------------------------------------------------------
/**
 * Execute BigQuery Query
 */
exports.executeBigQueryQuery = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data, context) => {
    requireAdmin(context);
    // SECURITY: Raw SQL execution is disabled for production safety.
    // Developers should implement specific, parameterized query endpoints.
    throw new functions.https.HttpsError('failed-precondition', 'Raw SQL execution is disabled in this environment for security reasons.');
});
/**
 * Get BigQuery Table Schema
 */
exports.getBigQueryTableSchema = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await bigqueryService.getTableSchema(projectId, data.datasetId, data.tableId);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * List BigQuery Datasets
 */
exports.listBigQueryDatasets = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (_data, context) => {
    requireAdmin(context);
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!projectId) {
        throw new functions.https.HttpsError('failed-precondition', 'GCP Project ID not configured.');
    }
    try {
        return await bigqueryService.listDatasets(projectId);
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
// ----------------------------------------------------------------------------
// Subscription Functions (Gen 2)
// ----------------------------------------------------------------------------
const getSubscription_1 = require("./subscription/getSubscription");
Object.defineProperty(exports, "getSubscription", { enumerable: true, get: function () { return getSubscription_1.getSubscription; } });
const createCheckoutSession_1 = require("./subscription/createCheckoutSession");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return createCheckoutSession_1.createCheckoutSession; } });
const createOneTimeCheckout_1 = require("./subscription/createOneTimeCheckout");
Object.defineProperty(exports, "createOneTimeCheckout", { enumerable: true, get: function () { return createOneTimeCheckout_1.createOneTimeCheckout; } });
const generateInvoice_1 = require("./subscription/generateInvoice");
Object.defineProperty(exports, "generateInvoice", { enumerable: true, get: function () { return generateInvoice_1.generateInvoice; } });
const cancelSubscription_1 = require("./subscription/cancelSubscription");
Object.defineProperty(exports, "cancelSubscription", { enumerable: true, get: function () { return cancelSubscription_1.cancelSubscription; } });
const resumeSubscription_1 = require("./subscription/resumeSubscription");
Object.defineProperty(exports, "resumeSubscription", { enumerable: true, get: function () { return resumeSubscription_1.resumeSubscription; } });
const getCustomerPortal_1 = require("./subscription/getCustomerPortal");
Object.defineProperty(exports, "getCustomerPortal", { enumerable: true, get: function () { return getCustomerPortal_1.getCustomerPortal; } });
const getUsageStats_1 = require("./subscription/getUsageStats");
Object.defineProperty(exports, "getUsageStats", { enumerable: true, get: function () { return getUsageStats_1.getUsageStats; } });
const trackUsage_1 = require("./subscription/trackUsage");
Object.defineProperty(exports, "trackUsage", { enumerable: true, get: function () { return trackUsage_1.trackUsage; } });
const webhookHandler_1 = require("./stripe/webhookHandler");
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return webhookHandler_1.stripeWebhook; } });
const activateFounderPass_1 = require("./subscription/activateFounderPass");
Object.defineProperty(exports, "activateFounderPass", { enumerable: true, get: function () { return activateFounderPass_1.activateFounderPass; } });
// ----------------------------------------------------------------------------
// Health Check Endpoint
// ----------------------------------------------------------------------------
/**
 * GDPR Data Export - Returns all user data as a JSON bundle.
 *
 * Collects data from: user profile, projects, history, brand assets,
 * knowledge base entries, and metadata. Does NOT include binary files
 * (images/audio stored in Cloud Storage) - those URLs are included.
 */
exports.exportUserData = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120, memory: "512MB" })
    // Item 352: Explicit return type annotation
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const userId = context.auth.uid;
    const db = admin.firestore();
    const exportData = {
        exportedAt: new Date().toISOString(),
        userId,
        email: context.auth.token.email || null,
    };
    // User profile
    try {
        const profileSnap = await db.collection("users").doc(userId).get();
        exportData.profile = profileSnap.exists ? profileSnap.data() : null;
    }
    catch (_a) {
        exportData.profile = null;
    }
    // Projects
    try {
        const projectsSnap = await db.collection("users").doc(userId).collection("projects").get();
        exportData.projects = projectsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    }
    catch (_b) {
        exportData.projects = [];
    }
    // History
    try {
        const historySnap = await db.collection("users").doc(userId).collection("history").get();
        exportData.history = historySnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    }
    catch (_c) {
        exportData.history = [];
    }
    // Organizations the user belongs to
    try {
        const orgsSnap = await db.collection("organizations")
            .where(`members.${userId}`, "!=", null)
            .get();
        exportData.organizations = orgsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    }
    catch (_d) {
        exportData.organizations = [];
    }
    // Knowledge base
    try {
        const kbSnap = await db.collection("users").doc(userId).collection("knowledge").get();
        exportData.knowledgeBase = kbSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    }
    catch (_e) {
        exportData.knowledgeBase = [];
    }
    functions.logger.info(`[GDPR] Data export completed for user ${userId}`);
    return exportData;
});
/**
 * GDPR Account Deletion Request - Queues deletion of all user data.
 * Marks the account for deletion and returns a confirmation token.
 * Actual deletion happens asynchronously via a scheduled function.
 */
exports.requestAccountDeletion = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120, memory: "256MB" })
    // Item 352: Explicit return type annotation
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const userId = context.auth.uid;
    const db = admin.firestore();
    // Step 1 — Record the deletion request (audit trail)
    await db.collection("_deletion_requests").doc(userId).set({
        userId,
        email: context.auth.token.email || null,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "processing",
    });
    functions.logger.info(`[GDPR] Starting account deletion for user ${userId}`);
    const errors = [];
    let deletedDocs = 0;
    // Step 2 — Delete user subcollections
    const subcollections = [
        'releases', 'tracks', 'contracts', 'campaigns', 'analytics',
        'splitSheets', 'generatedImages', 'generatedVideos', 'notifications',
        'invoices', 'auditLogs', 'fanPurchases', 'contacts', 'projects',
        'history', 'knowledge',
    ];
    for (const sub of subcollections) {
        try {
            const snap = await db.collection('users').doc(userId).collection(sub).limit(500).get();
            if (!snap.empty) {
                const batch = db.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                deletedDocs += snap.size;
            }
        }
        catch (err) {
            errors.push(`${sub}: ${err}`);
        }
    }
    // Step 3 — Delete user root document
    try {
        await db.collection('users').doc(userId).delete();
    }
    catch (err) {
        errors.push(`profile: ${err}`);
    }
    // Step 4 — Delete Firebase Auth account (signs user out of all devices)
    try {
        await admin.auth().deleteUser(userId);
        functions.logger.info(`[GDPR] Auth account deleted for ${userId}`);
    }
    catch (err) {
        errors.push(`auth: ${err}`);
    }
    functions.logger.info(`[GDPR] Deletion complete for ${userId}. docs=${deletedDocs} errors=${errors.length}`);
    return {
        success: errors.length === 0,
        deletedDocs,
        errors,
        deletedAt: new Date().toISOString(),
    };
});
/**
 * Health check endpoint for uptime monitoring.
 * Returns service status and basic diagnostics.
 */
exports.healthCheck = functions
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 60, memory: "256MB" })
    .https.onRequest(async (_req, res) => {
    const status = {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "0.1.0-beta.2",
        region: process.env.FUNCTION_REGION || "us-central1",
    };
    // Check Firestore connectivity
    try {
        await admin.firestore().collection("_health").doc("ping").set({
            lastCheck: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        status.firestore = "connected";
    }
    catch (_a) {
        status.firestore = "error";
        status.status = "degraded";
    }
    const httpStatus = status.status === "ok" ? 200 : 503;
    res.status(httpStatus).json(status);
});
/**
 * Health Check (Secondary Region: us-west1)
 * Part of PRODUCTION_100 Item 12 (Multi-region Deployment)
 */
exports.healthCheckWest1 = functions
    .region("us-west1")
    .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 60, memory: "256MB" })
    .https.onRequest(async (_req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        region: "us-west1",
        purpose: "Multi-region Failover Check"
    });
});
/**
 * Fan Data Enrichment Service
 * Process batches of fans to append demographic, psychographic, and interest markers.
 * Integration points: Clearbit, Apollo via AI fallback.
 */
exports.enrichFanData = functions
    .region("us-west1")
    .runWith({
    timeoutSeconds: 300,
    memory: "1GB",
    enforceAppCheck: ENFORCE_APP_CHECK
})
    // Item 352: Explicit return type annotation
    .https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Unauthorized: User session required for data enrichment.");
    }
    const { fans, provider, orgId } = data;
    if (!fans || !Array.isArray(fans)) {
        throw new functions.https.HttpsError("invalid-argument", "Missing fan data array.");
    }
    // 2. Validate Org Access
    await validateOrgAccess(context.auth.uid, orgId);
    console.info(`[FanEnrichment] Processing ${fans.length} records via ${provider || 'AI_FALLBACK'}`);
    // 3. Enrichment Logic
    // In production, this calls Clearbit/Apollo API. 
    // For Alpha, we use high-fidelity mock enrichment based on industry benchmarks.
    const results = fans.map((fan) => {
        const emailDomain = fan.email.split('@')[1] || '';
        const isCorporate = !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(emailDomain);
        // Heuristic-based enrichment
        return Object.assign(Object.assign({}, fan), { location: fan.city || (isCorporate ? 'San Francisco, CA' : 'Los Angeles, CA'), ageRange: isCorporate ? '35-44' : '18-24', incomeBracket: isCorporate ? '$120k-$200k' : '$40k-$65k', topGenre: fan.topGenre || (isCorporate ? 'Jazz' : 'Electronic'), interests: isCorporate ? ['Investing', 'Tech'] : ['Live Events', 'Gaming'], lastEnriched: new Date().toISOString() });
    });
    return {
        results,
        metadata: {
            provider: provider || 'AI_FALLBACK',
            count: results.length,
            timestamp: new Date().toISOString()
        }
    };
});
//# sourceMappingURL=index.js.map