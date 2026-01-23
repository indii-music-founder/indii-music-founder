
import admin from "firebase-admin";
import { GoogleAuth } from "google-auth-library";
import { config } from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env") });

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "indiios-v-1-1",
        storageBucket: "indiios-alpha-electron" // Confirmed valid bucket via debug-buckets.ts
    });
}

const db = admin.firestore();

async function processJob(jobId: string, data: any) {
    console.log(`\n🚀 [Worker] Starting Job: ${jobId}`);

    try {
        await db.collection("videoJobs").doc(jobId).update({
            status: "processing",
            progress: 10,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        // IMPORTANT: Force project ID to prevent auth library from picking up wrong env var
        const projectId = "indiios-v-1-1";
        const accessToken = await client.getAccessToken();

        console.log(`[Worker] Using Project ID: ${projectId}`);
        const modelId = "veo-3.1-fast-generate-preview";
        const location = "us-central1";
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

        const requestBody = {
            instances: [{ prompt: data.prompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: data.options?.aspectRatio || "16:9",
                personGeneration: "allow_adult",
                // Veo 3.1 supports: 4, 6, or 8 seconds for text_to_video
                durationSeconds: data.options?.duration || 8
            }
        };

        console.log(`[Worker] Sending request to Vertex AI...`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`POST Failed (${response.status}): ${err}`);
        }

        const operation = await response.json() as any;
        console.log(`[Worker] Full Operation Object:`, JSON.stringify(operation, null, 2));
        const operationName = operation.name;
        console.log(`[Worker] Operation Created: ${operationName}`);

        let done = false;
        let attempts = 0;

        while (!done && attempts < 150) {
            attempts++;
            console.log(`[Worker] Polling attempt ${attempts} for ${operationName}...`);
            await new Promise(r => setTimeout(r, 5000));

            // Veo uses fetchPredictOperation endpoint (POST with operationName in body)
            // See: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
            const pollEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

            console.log(`[Worker] Calling fetchPredictOperation: ${pollEndpoint}`);
            const pollRes = await fetch(pollEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken.token}`
                },
                body: JSON.stringify({ operationName })
            });

            if (!pollRes.ok) {
                const errText = await pollRes.text();
                console.log(`[Worker] fetchPredictOperation failed (${pollRes.status}): ${errText}. Retrying...`);
                continue;
            }

            const pollData = await pollRes.json() as any;

            if (pollData.error) {
                throw new Error(`Operation Error: ${pollData.error.message}`);
            }

            if (pollData.done) {
                console.log(`[Worker] Generation complete!`);

                // Debug logging
                const fs = await import('fs');
                // Don't log full base64 to console/file if possible, it's huge. 
                // But we already did.

                const response = pollData.response;
                let finalUrl = "";

                // Check for URI-based output
                const uriOutput =
                    response?.video?.uri ||
                    response?.videos?.[0]?.uri ||
                    response?.generatedSamples?.[0]?.video?.uri ||
                    response?.predictions?.[0]?.video?.uri ||
                    response?.predictions?.[0]?.uri ||
                    response?.outputs?.[0]?.videoUri;

                // Check for Base64 output (Veo Fast often returns this)
                const base64Output =
                    response?.videos?.[0]?.bytesBase64Encoded ||
                    response?.video?.bytesBase64Encoded;

                if (uriOutput) {
                    finalUrl = uriOutput;
                    if (finalUrl.startsWith('gs://')) {
                        const bucket = finalUrl.split('/')[2];
                        const path = finalUrl.split('/').slice(3).join('/');
                        finalUrl = `https://storage.googleapis.com/${bucket}/${path}`;
                        // Or signed URL if private, but for now assume public/accessible
                    }
                } else if (base64Output) {
                    console.log(`[Worker] Received Base64 video. Uploading to Storage...`);
                    const bucket = admin.storage().bucket();
                    const fileName = `videos/generated/${jobId}.mp4`;
                    const file = bucket.file(fileName);
                    const buffer = Buffer.from(base64Output, 'base64');

                    await file.save(buffer, {
                        metadata: {
                            contentType: 'video/mp4',
                        },
                        public: true // Make public for easy frontend access in dev
                    });

                    // Construct public URL
                    // publicUrl() method might depend on config, manual construction is safer for Firebase Storage
                    finalUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    // Or download token based: https://firebasestorage.googleapis.com/v0/b/...

                    // Actually, let's use the file.publicUrl() if available or the standard GCS public link
                    try {
                        const [url] = await file.getSignedUrl({
                            action: 'read',
                            expires: '03-01-2500'
                        });
                        finalUrl = url;
                    } catch (e) {
                        console.warn("Could not get signed URL, using direct link", e);
                        // Fallback
                        finalUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
                    }
                    console.log(`[Worker] Uploaded to: ${finalUrl}`);
                } else {
                    console.log("[Worker] Response Body Structure:", Object.keys(response || {}));
                    throw new Error("Video generation succeeded but no URI or Base64 found in response.");
                }

                await db.collection("videoJobs").doc(jobId).update({
                    status: "completed",
                    videoUrl: finalUrl,
                    progress: 100,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`[Worker] Job ${jobId} SUCCESS: ${finalUrl}`);
                done = true;
            } else {
                const prog = Math.min(95, 10 + (attempts * 1));
                await db.collection("videoJobs").doc(jobId).update({
                    progress: prog,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                process.stdout.write(`.${prog}%`);
            }
        }

        if (!done) throw new Error("Timed out after 10 minutes.");

    } catch (err: any) {
        console.error(`\n❌ [Worker] Job ${jobId} FAILED:`, err.message);
        await db.collection("videoJobs").doc(jobId).update({
            status: "failed",
            error: err.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

console.log("🛠️ [Video Worker] Monitoring videoJobs...");

// Also catch existing queued jobs on startup
db.collection("videoJobs").where("status", "==", "queued").get().then(q => {
    q.forEach(doc => processJob(doc.id, doc.data()));
});

db.collection("videoJobs")
    .where("status", "==", "queued")
    .onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                processJob(change.doc.id, change.doc.data());
            }
        });
    });
