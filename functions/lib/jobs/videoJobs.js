"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerVideoJob = exports.generateVideoJob = void 0;
const client_1 = require("./inngest/client");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { config } from "../config";
// const corsHandler = cors({ origin: true });
// const genAI = new GoogleGenerativeAI(config.VITE_API_KEY);
exports.generateVideoJob = client_1.inngest.createFunction({ id: "generate-video" }, { event: "video/generate.requested" }, async ({ event, step }) => {
    const { prompt, duration, fps, resolution, aspectRatio, jobId, userId, orgId } = event.data;
    console.log(`Starting video job ${jobId} for user ${userId} in org ${orgId}`);
    console.log(`Config: ${duration}s @ ${fps}fps, ${resolution} (${aspectRatio})`);
    console.log(`Prompt: ${prompt}`);
    // 1. Update status to processing
    await step.run("update-status-processing", async () => {
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "processing",
            progress: 10,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    // 2. Generate Video (Simulated for now as Veo API is not public/standardized in SDK yet)
    // In a real scenario, this would call Vertex AI or Gemini Pro Vision if it supported video generation.
    // For this implementation, we will simulate a delay and return a placeholder or call the existing logic if adaptable.
    // Since the previous implementation used `AI.generateVideo` which called a backend function, 
    // we can assume we are moving that logic here.
    // However, the previous `generateVideo` in `AIService` called `functions/generateVideo`.
    // If that function exists, we should reuse its logic or call it.
    // But `functions/src/ai/gemini.ts` only has `generateContent` and `embedContent`.
    // It seems `generateVideo` was a placeholder or handled elsewhere.
    // Let's look at `VideoGenerationService.ts` again later.
    // For now, I will implement the job structure.
    const videoUrl = await step.run("generate-video-content", async () => {
        // Simulate generation delay
        await new Promise(resolve => setTimeout(resolve, 5000));
        // TODO: Replace with actual Veo/Vertex call
        // For now, return a placeholder video
        return "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    });
    // 3. Update status to completed
    await step.run("update-status-completed", async () => {
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "completed",
            progress: 100,
            videoUrl: videoUrl,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    return { jobId, videoUrl };
});
// Helper to validate org membership
const validateOrgMembership = async (uid, orgId) => {
    var _a;
    const orgDoc = await admin.firestore().collection("organizations").doc(orgId).get();
    if (!orgDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Organization not found');
    }
    const data = orgDoc.data();
    if (!((_a = data === null || data === void 0 ? void 0 : data.members) === null || _a === void 0 ? void 0 : _a.includes(uid))) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this organization');
    }
};
exports.triggerVideoJob = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { prompt, duration, fps, resolution, aspectRatio, jobId, orgId } = data;
    const userId = context.auth.uid;
    // 2. Org Validation
    if (orgId) {
        await validateOrgMembership(userId, orgId);
    }
    else {
        // Optional: Enforce orgId for all jobs, or allow personal jobs if orgId is missing
        // For now, we'll allow personal jobs if orgId is null/undefined, but log it
        console.log(`[triggerVideoJob] No orgId provided for user ${userId}. Treating as personal job.`);
    }
    try {
        await client_1.inngest.send({
            name: "video/generate.requested",
            data: { prompt, duration, fps, resolution, aspectRatio, userId, jobId, orgId },
        });
        // Create initial job document
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            status: "queued",
            progress: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            userId,
            orgId: orgId || 'personal', // Ensure consistent field
            prompt
        });
        return { jobId, status: "queued" };
    }
    catch (error) {
        console.error("Trigger Job Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=videoJobs.js.map