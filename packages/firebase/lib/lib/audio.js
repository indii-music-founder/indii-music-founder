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
exports.analyzeAudioFn = exports.AnalyzeAudioRequestSchema = exports.GenerateSpeechRequestSchema = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const zod_1 = require("zod");
const secrets_1 = require("../config/secrets");
const models_1 = require("../config/models");
const rateLimit_1 = require("./rateLimit");
exports.GenerateSpeechRequestSchema = zod_1.z.object({
    text: zod_1.z.string().min(1, "Text is required"),
    voice: zod_1.z.string().optional().default("en-US-Journey-F"),
    model: zod_1.z.string().optional().default("gemini-2.5-pro-tts"),
});
exports.AnalyzeAudioRequestSchema = zod_1.z.object({
    audioUrl: zod_1.z.string().url("Valid Audio URL (GCS or Public) is required"),
    mimeType: zod_1.z.string().optional().default("audio/mpeg"),
});
const SONIC_PROFILE_PROMPT = `Analyze this audio track and extract its sonic profile. 
Return ONLY a JSON object that adheres to the following schema:
{
  "bpm": number,
  "key": string,
  "mood": string,
  "texture": string,
  "instrumentation": string[],
  "vocalPresence": boolean,
  "intensity": number (1-10),
  "genre": string,
  "timestamp_markers": [{"time": string, "event": string}]
}`;
/**
 * Analyze Audio Ear (indii_audio_ear)
 *
 * Extracts SonicProfile metadata from an audio track.
 * Uses Gemini 3 Pro (Multimodal) for high-fidelity extraction.
 */
const analyzeAudioFn = () => functions
    .region("us-west1")
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [secrets_1.geminiApiKey],
    timeoutSeconds: 120,
    memory: "512MB"
})
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to analyze audio.");
    }
    // 1b. Item 327: Rate limit — audio analysis runs up to 30s per call
    await (0, rateLimit_1.enforceRateLimit)(context.auth.uid, "analyzeAudio", {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000, // 10 per hour
    });
    // 2. Validation
    const validation = exports.AnalyzeAudioRequestSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    const { audioUrl, mimeType } = validation.data;
    try {
        const apiKey = (0, secrets_1.getGeminiApiKey)();
        const modelId = models_1.FUNCTION_AI_MODELS.AUDIO.ANALYSIS;
        console.log(`[analyzeAudio] Using model: ${modelId} for track: ${audioUrl}`);
        let audioBase64;
        if (audioUrl.startsWith('gs://')) {
            const admin = await Promise.resolve().then(() => __importStar(require("firebase-admin")));
            const bucketRegex = /^gs:\/\/([^/]+)\/(.+)$/;
            const match = audioUrl.match(bucketRegex);
            if (!match)
                throw new Error("Invalid GCS URI format");
            const [, bucketName, fileName] = match;
            const [fileContents] = await admin.storage().bucket(bucketName).file(fileName).download();
            audioBase64 = fileContents.toString('base64');
        }
        else {
            const response = await fetch(audioUrl);
            const buffer = await response.arrayBuffer();
            audioBase64 = Buffer.from(buffer).toString('base64');
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                        role: "user",
                        parts: [
                            { text: SONIC_PROFILE_PROMPT },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: audioBase64
                                }
                            }
                        ]
                    }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} ${errText}`);
        }
        const result = await response.json();
        const analysisText = (_e = (_d = (_c = (_b = (_a = result.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
        if (!analysisText) {
            throw new Error("No analysis data returned from model.");
        }
        return JSON.parse(analysisText);
    }
    catch (error) {
        console.error("[analyzeAudio] Error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", error.message || "Audio analysis failed");
    }
});
exports.analyzeAudioFn = analyzeAudioFn;
//# sourceMappingURL=audio.js.map