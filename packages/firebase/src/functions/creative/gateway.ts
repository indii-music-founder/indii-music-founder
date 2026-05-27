import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

// Initialize the GenAI client using Application Default Credentials (ADC) for Vertex AI.
// This fully adheres to the secure proxy architecture (no client keys, strictly GCP context).
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || '',
  location: process.env.VITE_VERTEX_LOCATION || 'us-central1',
});

const db = admin.firestore();
const storage = admin.storage();

// --- ZOD SCHEMAS ENFORCING THIN CLIENT PROTOCOL ---
// We explicitly forbid raw base64 strings from being sent over the wire.
// Clients MUST upload assets directly to Cloud Storage and pass the gs:// URI.
const BaseMediaRequest = z.object({
  prompt: z.string().min(1),
  referenceUri: z.string().startsWith('gs://').optional(),
});

const GenerateImageSchema = BaseMediaRequest.extend({
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
});

const GenerateVideoSchema = BaseMediaRequest.extend({
  firstFrameUri: z.string().startsWith('gs://').optional(),
  lastFrameUri: z.string().startsWith('gs://').optional(),
});

const GenerateAudioSchema = BaseMediaRequest.extend({
  durationSeconds: z.number().min(5).max(120).default(30),
});

/**
 * Helper: Upload a raw buffer to Cloud Storage and return the gs:// URI
 */
async function uploadToStorage(userId: string, buffer: Buffer, extension: string): Promise<string> {
  const bucket = storage.bucket();
  const filename = `creative/${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
  const file = bucket.file(filename);
  await file.save(buffer, {
    resumable: false,
    contentType: extension === 'mp4' ? 'video/mp4' : extension === 'wav' ? 'audio/wav' : 'image/jpeg'
  });
  return `gs://${bucket.name}/${filename}`;
}

/**
 * generateImageV3 - Routes to gemini-3-pro-image-preview
 */
export const generateImageV3 = onCall({ timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateImageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Payload validation failed. Ensure no base64 is passed and only gs:// URIs are used.');
  }

  const { prompt } = parsed.data;
  const userId = request.auth.uid;
  const jobId = db.collection('creative_jobs').doc().id;
  
  await db.collection('creative_jobs').doc(jobId).set({
    id: jobId,
    userId,
    status: 'processing',
    type: 'image',
    prompt,
    createdAt: new Date().toISOString()
  });

  try {
    // Generate image using Gemini 3 Multimodal capabilities
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
      }
    });

    // Extract the raw image bytes from the response
    // For Gemini 3 returning images, it comes back in parts as inlineData
    let base64Image = '';
    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      base64Image = response.candidates[0].content.parts[0].inlineData.data;
    } else {
       throw new Error("No image data returned from model");
    }
    
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Strict Thin Client adherence: Save directly to Cloud Storage
    const outputUri = await uploadToStorage(userId, buffer, 'jpg');
    
    await db.collection('creative_jobs').doc(jobId).update({
      status: 'completed',
      resultUri: outputUri,
      completedAt: new Date().toISOString()
    });

    // Return only the lightweight URI to the client
    return { jobId, resultUri: outputUri };
  } catch (error: any) {
    await db.collection('creative_jobs').doc(jobId).update({
      status: 'failed',
      error: error.message
    });
    throw new HttpsError('internal', error.message);
  }
});

/**
 * generateVideoV3 - Routes to Veo 3.1
 */
export const generateVideoV3 = onCall({ timeoutSeconds: 540 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateVideoSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid payload. Base64 forbidden.');

  const { prompt } = parsed.data;
  const userId = request.auth.uid;
  const jobId = db.collection('creative_jobs').doc().id;
  
  await db.collection('creative_jobs').doc(jobId).set({
    id: jobId,
    userId,
    status: 'processing',
    type: 'video',
    prompt,
    createdAt: new Date().toISOString()
  });

  try {
    // Simulate Veo API call (Google Gen AI SDK / Vertex Video generation)
    // The model would be 'veo-3.1-generate-preview'
    const response = await ai.models.generateContent({
      model: 'veo-3.1-generate-preview',
      contents: prompt,
      config: {
        responseModalities: ["VIDEO"]
      }
    });

    let base64Video = '';
    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      base64Video = response.candidates[0].content.parts[0].inlineData.data;
    } else {
      throw new Error("No video data returned from Veo");
    }

    const buffer = Buffer.from(base64Video, 'base64');
    const outputUri = await uploadToStorage(userId, buffer, 'mp4');
    
    await db.collection('creative_jobs').doc(jobId).update({
      status: 'completed',
      resultUri: outputUri,
      completedAt: new Date().toISOString()
    });

    return { jobId, resultUri: outputUri };
  } catch (error: any) {
    await db.collection('creative_jobs').doc(jobId).update({ status: 'failed', error: error.message });
    throw new HttpsError('internal', error.message);
  }
});

/**
 * generateAudioV3 - Routes to NB2
 */
export const generateAudioV3 = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateAudioSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid payload.');

  const { prompt } = parsed.data;
  const userId = request.auth.uid;
  const jobId = db.collection('creative_jobs').doc().id;
  
  await db.collection('creative_jobs').doc(jobId).set({
    id: jobId,
    userId,
    status: 'processing',
    type: 'audio',
    prompt,
    createdAt: new Date().toISOString()
  });

  try {
    // Simulate NB2 audio generation
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // or audio equivalent model
      contents: prompt,
      config: {
        responseModalities: ["AUDIO"]
      }
    });

    let base64Audio = '';
    if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      base64Audio = response.candidates[0].content.parts[0].inlineData.data;
    } else {
      throw new Error("No audio data returned");
    }

    const buffer = Buffer.from(base64Audio, 'base64');
    const outputUri = await uploadToStorage(userId, buffer, 'wav');
    
    await db.collection('creative_jobs').doc(jobId).update({
      status: 'completed',
      resultUri: outputUri,
      completedAt: new Date().toISOString()
    });

    return { jobId, resultUri: outputUri };
  } catch (error: any) {
    await db.collection('creative_jobs').doc(jobId).update({ status: 'failed', error: error.message });
    throw new HttpsError('internal', error.message);
  }
});
