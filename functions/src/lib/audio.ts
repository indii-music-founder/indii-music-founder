import * as functions from "firebase-functions/v1";
import { z } from "zod";
import { getGeminiApiKey, geminiApiKey } from "../config/secrets";
import { FUNCTION_AI_MODELS } from "../config/models";
import { enforceRateLimit, RATE_LIMITS } from "./rateLimit";

export const GenerateSpeechRequestSchema = z.object({
    text: z.string().min(1, "Text is required"),
    voice: z.string().optional().default("en-US-Journey-F"),
    model: z.string().optional().default("gemini-2.5-pro-tts"),
});

export const AnalyzeAudioRequestSchema = z.object({
    audioUrl: z.string().url("Valid Audio URL (GCS or Public) is required"),
    mimeType: z.string().optional().default("audio/mpeg"),
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
export const analyzeAudioFn = () => functions
    .region("us-west1")
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        memory: "512MB"
    })
    .https.onCall(async (data: unknown, context) => {
        // 1. Auth Check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to analyze audio."
            );
        }

        // 1b. Item 327: Rate limit — audio analysis runs up to 30s per call
        await enforceRateLimit(context.auth.uid, "analyzeAudio", {
            maxRequests: 10,
            windowMs: 60 * 60 * 1000, // 10 per hour
        });

        // 2. Validation
        const validation = AnalyzeAudioRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
            );
        }
        const { audioUrl, mimeType } = validation.data;

        try {
            const apiKey = getGeminiApiKey();
            const modelId = FUNCTION_AI_MODELS.AUDIO.ANALYSIS;

            console.log(`[analyzeAudio] Using model: ${modelId} for track: ${audioUrl}`);

            let audioBase64: string;
            if (audioUrl.startsWith('gs://')) {
                const admin = await import("firebase-admin");
                const bucketRegex = /^gs:\/\/([^/]+)\/(.+)$/;
                const match = audioUrl.match(bucketRegex);

                if (!match) throw new Error("Invalid GCS URI format");

                const [, bucketName, fileName] = match;
                const [fileContents] = await admin.storage().bucket(bucketName).file(fileName).download();
                audioBase64 = fileContents.toString('base64');
            } else {
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
            const analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!analysisText) {
                throw new Error("No analysis data returned from model.");
            }

            return JSON.parse(analysisText);

        } catch (error: any) {
            console.error("[analyzeAudio] Error:", error);
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError("internal", error.message || "Audio analysis failed");
        }
    });
