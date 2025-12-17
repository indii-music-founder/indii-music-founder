import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Inngest } from "inngest";
import { defineSecret } from "firebase-functions/params";
import { serve } from "inngest/express";

// Initialize Firebase Admin
admin.initializeApp();

// Define Secrets
const inngestEventKey = defineSecret("INNGEST_EVENT_KEY");
const inngestSigningKey = defineSecret("INNGEST_SIGNING_KEY");

// Lazy Initialize Inngest Client
// We use a function factory or lazy initialization inside the handler to ensure secrets are available
const getInngestClient = () => {
    return new Inngest({
        id: "indii-os-functions",
        eventKey: inngestEventKey.value()
    });
};

/**
 * Trigger Video Generation Job
 * 
 * This callable function acts as the bridge between the Client App (Electron)
 * and the Asynchronous Worker Queue (Inngest).
 * 
 * Security: protected by Firebase Auth (onCall).
 */
export const triggerVideoJob = functions
    .runWith({
        secrets: [inngestEventKey],
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        // 1. Authentication Check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to trigger video generation."
            );
        }

        const userId = context.auth.uid;
        const { prompt, jobId, orgId, ...options } = data;

        if (!prompt || !jobId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing required fields: prompt or jobId."
            );
        }

        try {
            // 2. Publish Event to Inngest
            const inngest = getInngestClient();

            await inngest.send({
                name: "video/generate.requested",
                data: {
                    jobId: jobId,
                    userId: userId,
                    orgId: orgId || "personal", // Default to personal if missing
                    prompt: prompt,
                    options: options, // Pass through other options (aspect ratio, etc.)
                    timestamp: Date.now(),
                },
                user: {
                    id: userId,
                }
            });

            console.log(`[VideoJob] Triggered for JobID: ${jobId}, User: ${userId}`);

            return { success: true, message: "Video generation job queued." };

        } catch (error: any) {
            console.error("[VideoJob] Error triggering Inngest:", error);
            throw new functions.https.HttpsError(
                "internal",
                `Failed to queue video job: ${error.message}`
            );
        }
    });

/**
 * Inngest API Endpoint
 * 
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
export const inngestApi = functions
    .runWith({ secrets: [inngestSigningKey, inngestEventKey] })
    .https.onRequest((req, res) => {
        // Initialize client INSIDE the handler to ensure secrets are available
        const inngestClient = getInngestClient();

        // Placeholder for actual video generation functions
        const generateVideoFn = inngestClient.createFunction(
            { id: "generate-video-logic" },
            { event: "video/generate.requested" },
            async ({ event, step }) => {
                return { message: "Placeholder implementation restored." };
            }
        );

        // Create the serve handler dynamically
        const handler = serve({
            client: inngestClient,
            functions: [generateVideoFn],
            signingKey: inngestSigningKey.value(),
        });

        // Execute the handler
        return handler(req, res);
    });
