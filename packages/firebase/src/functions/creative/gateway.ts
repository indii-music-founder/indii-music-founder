import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { getGeminiApiKey, geminiApiKey } from '../../config/secrets';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GoogleGenAI,
  VideoGenerationReferenceType,
  type GenerateVideosOperation,
  type Image,
  type Video,
  type VideoGenerationReferenceImage,
} from "@google/genai";

type MediaKind = 'image' | 'video' | 'audio';
type GatewayErrorCode = 'invalid-argument' | 'permission-denied' | 'failed-precondition' | 'not-found' | 'resource-exhausted' | 'deadline-exceeded' | 'unavailable' | 'internal';

interface GeminiInlineData {
  data?: string;
  mimeType?: string;
}

interface GeminiContentPart {
  text?: string;
  thought?: boolean;
  inlineData?: GeminiInlineData;
}

interface GeminiCandidate {
  finishReason?: string;
  safetyRatings?: unknown[];
  content?: {
    parts?: GeminiContentPart[];
  };
}

interface GeminiContentResponse {
  candidates?: GeminiCandidate[];
}

const IMAGE_MODEL_IDS = {
  fast: 'gemini-3.1-flash-image-preview',
  pro: 'gemini-3-pro-image-preview',
  legacy: 'gemini-2.5-flash-image',
} as const;

const VIDEO_MODEL_IDS = {
  fast: 'veo-3.1-fast-generate-preview',
  pro: 'veo-3.1-generate-preview',
  lite: 'veo-3.1-lite-generate-preview',
} as const;

const OMNI_FLASH_MODEL_ID = process.env.GEMINI_OMNI_FLASH_MODEL || process.env.VITE_GEMINI_OMNI_FLASH_MODEL || '';
const VIDEO_POLL_INTERVAL_MS = Number(process.env.VIDEO_POLL_INTERVAL_MS || '10000');
const VIDEO_MAX_POLLS = Number(process.env.VIDEO_MAX_POLLS || '54');

// Helper to resolve the GenAI client using Google AI Studio (API Key) or Vertex AI (ADC).
// This fully adheres to the secure proxy architecture, preferring global preview models.
function getAiClient(forceVertex = false): GoogleGenAI {
  let apiKey: string | null = null;
  try {
    apiKey = getGeminiApiKey();
  } catch (error) {
    if (!forceVertex) {
      console.warn('[creativeGateway] Gemini API key unavailable; falling back to Vertex AI ADC.', error);
    }
  }

  if (apiKey && !apiKey.includes("PLACEHOLDER") && !forceVertex) {
    return new GoogleGenAI({ apiKey });
  }

  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || '';
  if (!project) {
    throw new HttpsError('failed-precondition', 'Google AI credentials are not configured for media generation.');
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location: process.env.VITE_VERTEX_LOCATION || 'us-central1',
  });
}

// Defer firestore and storage initialization until first use (for test compatibility)
function getDb() {
  return admin.firestore();
}

function getStorage() {
  return admin.storage();
}

// --- ZOD SCHEMAS ENFORCING THIN CLIENT PROTOCOL ---
// We explicitly forbid raw base64 strings from being sent over the wire.
// Clients MUST upload assets directly to Cloud Storage and pass the gs:// URI.
const BaseMediaRequest = z.object({
  prompt: z.string().min(1),
  referenceUri: z.string().startsWith('gs://').optional(),
});

const GenerateImageSchema = BaseMediaRequest.extend({
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
  model: z.enum(['lite', 'fast', 'pro', 'legacy']).default('fast'),
  imageSize: z.enum(['512', '0.5K', '1K', '2K', '4K', '1k', '2k', '4k']).optional(),
  thinkingLevel: z.enum(['none', 'minimal', 'low', 'medium', 'high']).optional(),
  useGoogleSearch: z.boolean().optional(),
  useGrounding: z.boolean().optional(),
});

const GenerateVideoSchema = BaseMediaRequest.extend({
  firstFrameUri: z.string().startsWith('gs://').optional(),
  lastFrameUri: z.string().startsWith('gs://').optional(),
  referenceUris: z.array(z.string().startsWith('gs://')).max(3).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3']).default('16:9'),
  model: z.enum(['lite', 'fast', 'pro']).default('fast'),
  resolution: z.enum(['720p', '1080p', '4k', '1280x720', '1920x1080', '3840x2160']).default('720p'),
  durationSeconds: z.number().min(4).max(8).default(6),
  personGeneration: z.enum(['allow_adult', 'dont_allow', 'allow_all']).optional(),
  negativePrompt: z.string().max(1000).optional(),
  seed: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional(),
  enhancePrompt: z.boolean().optional(),
});

const GenerateOmniRemixSchema = z.object({
  prompt: z.string().min(1),
  referenceVideoUri: z.string().startsWith('gs://'),
  audioUri: z.string().startsWith('gs://').optional(),
  referenceUris: z.array(z.string().startsWith('gs://')).max(8).optional(),
  pipelineMode: z.enum(['pure-omni', 'hybrid-veo']).default('pure-omni'),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
  durationSeconds: z.number().min(4).max(12).default(8),
  posePreservation: z.number().min(0).max(1).optional(),
  beatPulse: z.number().min(0).max(1).optional(),
  characterXRay: z.boolean().optional(),
  synthIdEnabled: z.boolean().optional(),
  activePosePreset: z.string().max(64).optional(),
  selectedLanguage: z.string().max(16).optional(),
  lyricsText: z.string().max(2000).optional(),
  typographyStyle: z.enum(['cyberpunk', 'kinetic-neon', 'liquid-gold', 'minimal-infographic']).optional(),
  visualizerColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

const GenerateAudioSchema = BaseMediaRequest.extend({
  durationSeconds: z.number().min(5).max(120).default(30),
});

/**
 * Helper: Upload a raw buffer to Cloud Storage and return the gs:// URI
 */
async function uploadToStorage(userId: string, buffer: Buffer, extension: string, contentType?: string): Promise<string> {
  const bucket = getStorage().bucket();
  const filename = `creative/${userId}/${Date.now()}_${crypto.randomUUID().split('-')[0]}.${extension}`;
  const file = bucket.file(filename);
  await file.save(buffer, {
    resumable: false,
    contentType: contentType || (extension === 'mp4' ? 'video/mp4' : extension === 'wav' ? 'audio/wav' : 'image/jpeg')
  });
  return `gs://${bucket.name}/${filename}`;
}

async function safeDbSet(jobId: string, data: Record<string, unknown>) {
  try {
    await getDb().collection('creative_jobs').doc(jobId).set(data);
  } catch (e) {
    console.warn(`[creativeGateway] Firestore set failed (non-blocking):`, e);
  }
}

async function safeDbUpdate(jobId: string, data: Record<string, unknown>) {
  try {
    await getDb().collection('creative_jobs').doc(jobId).update(data);
  } catch (e) {
    console.warn(`[creativeGateway] Firestore update failed (non-blocking):`, e);
  }
}

function normalizeImageSize(imageSize?: string): '512' | '1K' | '2K' | '4K' | undefined {
  if (!imageSize) return undefined;
  if (imageSize === '0.5K') return '512';
  if (imageSize.toLowerCase() === '1k') return '1K';
  if (imageSize.toLowerCase() === '2k') return '2K';
  if (imageSize.toLowerCase() === '4k') return '4K';
  return '1K';
}

function normalizeThinkingLevel(thinkingLevel?: string): 'Minimal' | 'High' | undefined {
  if (!thinkingLevel || thinkingLevel === 'none') return undefined;
  if (thinkingLevel === 'high' || thinkingLevel === 'medium') return 'High';
  return 'Minimal';
}

function resolveImageModel(model: z.infer<typeof GenerateImageSchema>['model']): string {
  if (model === 'pro') return IMAGE_MODEL_IDS.pro;
  if (model === 'legacy' || model === 'lite') return IMAGE_MODEL_IDS.legacy;
  return IMAGE_MODEL_IDS.fast;
}

function resolveVideoModel(model: z.infer<typeof GenerateVideoSchema>['model']): string {
  if (model === 'pro') return VIDEO_MODEL_IDS.pro;
  if (model === 'lite') return VIDEO_MODEL_IDS.lite;
  return VIDEO_MODEL_IDS.fast;
}

function resolveOmniFlashModel(): string {
  if (!OMNI_FLASH_MODEL_ID) {
    console.warn('[creativeGateway] GEMINI_OMNI_FLASH_MODEL is not set. Falling back to veo-3.1-fast-generate-preview.');
    return 'veo-3.1-fast-generate-preview';
  }
  return OMNI_FLASH_MODEL_ID;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeVideoAspectRatio(aspectRatio: z.infer<typeof GenerateVideoSchema>['aspectRatio']): '16:9' | '9:16' {
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

function normalizeVideoResolution(
  resolution: z.infer<typeof GenerateVideoSchema>['resolution'],
  model: z.infer<typeof GenerateVideoSchema>['model'],
): '720p' | '1080p' | '4k' {
  const normalized = resolution === '1280x720'
    ? '720p'
    : resolution === '1920x1080'
      ? '1080p'
      : resolution === '3840x2160'
        ? '4k'
        : resolution;

  if (model === 'lite' && normalized === '4k') return '1080p';
  return normalized;
}

function normalizeVideoDuration(durationSeconds: number, resolution: string, hasFrameInput: boolean): 4 | 6 | 8 {
  if (resolution !== '720p' || hasFrameInput) return 8;
  if (durationSeconds <= 4) return 4;
  if (durationSeconds <= 6) return 6;
  return 8;
}

function normalizeVideoSeed(seed?: number | string): number | undefined {
  if (seed === undefined || seed === '') return undefined;
  const parsed = typeof seed === 'string' ? Number(seed) : seed;
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function normalizePersonGeneration(
  personGeneration: z.infer<typeof GenerateVideoSchema>['personGeneration'],
  hasFrameInput: boolean,
): 'dont_allow' | 'allow_adult' | undefined {
  if (hasFrameInput) return 'allow_adult';
  if (personGeneration === 'dont_allow') return 'dont_allow';
  if (personGeneration === 'allow_adult' || personGeneration === 'allow_all') return 'allow_adult';
  return undefined;
}

function toImage(gcsUri?: string): Image | undefined {
  return gcsUri ? { gcsUri } : undefined;
}

function toReferenceImages(referenceUris?: string[]): VideoGenerationReferenceImage[] | undefined {
  const references = (referenceUris ?? []).slice(0, 3).map(uri => ({
    image: { gcsUri: uri },
    referenceType: VideoGenerationReferenceType.ASSET,
  }));
  return references.length > 0 ? references : undefined;
}

function buildOmniPrompt(data: z.infer<typeof GenerateOmniRemixSchema>): string {
  const directives = [
    `Pipeline: ${data.pipelineMode}`,
    `Pose preservation: ${Math.round((data.posePreservation ?? 0.8) * 100)}%`,
    `Beat motion pulse: ${Math.round((data.beatPulse ?? 0.5) * 100)}%`,
    `Character X-Ray continuity: ${data.characterXRay ? 'enabled' : 'disabled'}`,
    `Pose preset: ${data.activePosePreset || 'performance continuity'}`,
    data.lyricsText ? `Kinetic lyrics: "${data.lyricsText}" using ${data.typographyStyle || 'minimal-infographic'} typography` : undefined,
    data.selectedLanguage ? `Dubbing language target: ${data.selectedLanguage}` : undefined,
    data.visualizerColor ? `Visualizer color cue: ${data.visualizerColor}` : undefined,
    data.audioUri ? 'Use the supplied audio reference for beat sync and motion timing.' : undefined,
  ].filter(Boolean);

  return [
    data.prompt,
    'Preserve performer identity, scene continuity, physical plausibility, and temporal coherence across the full clip.',
    ...directives,
  ].join('\n');
}

function extractInlineMedia(response: unknown, kind: MediaKind): { data: string; mimeType: string } {
  // Support for new Gemini 3 native generatedImages array (e.g. from unified responses)
  if (kind === 'image' && (response as any)?.generatedImages?.[0]?.image?.imageBytes) {
    return {
      mimeType: (response as any).generatedImages[0].image.mimeType || 'image/jpeg',
      data: (response as any).generatedImages[0].image.imageBytes
    };
  }

  const result = response as GeminiContentResponse;
  const candidates = result.candidates ?? [];
  const parts = candidates.flatMap(candidate => candidate.content?.parts ?? []);
  const matchingParts = parts.filter(part => {
    const mimeType = part.inlineData?.mimeType;
    return !!part.inlineData?.data && (!mimeType || mimeType.startsWith(`${kind}/`));
  });
  const mediaParts = matchingParts.length > 0 ? matchingParts : parts.filter(part => !!part.inlineData?.data);
  const finalParts = mediaParts.filter(part => !part.thought);
  const selectableParts = finalParts.length > 0 ? finalParts : mediaParts;
  const selectedPart = selectableParts[selectableParts.length - 1];

  if (selectedPart?.inlineData?.data) {
    return {
      data: selectedPart.inlineData.data,
      mimeType: selectedPart.inlineData.mimeType || `${kind}/jpeg`,
    };
  }

  const finishReasons = candidates.map(candidate => candidate.finishReason).filter(Boolean).join(', ') || 'unknown';
  const textPreview = parts
    .map(part => part.text)
    .filter(Boolean)
    .join(' ')
    .slice(0, 180);

  throw new Error(
    `Invalid response: No ${kind} data returned from Gemini. Finish reason: ${finishReasons}${textPreview ? `. Text response: ${textPreview}` : ''}`
  );
}

function extensionForMime(mimeType: string, fallback: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'video/mp4') return 'mp4';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  if (normalized === 'audio/mpeg') return 'mp3';
  return fallback;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const candidate = record.message || record.error || record.details || record.cause;
    if (typeof candidate === 'string') return candidate;
    try {
      return JSON.stringify(record);
    } catch {
      return String(error);
    }
  }
  return 'Unknown Google generation error';
}

function toGatewayError(error: unknown, context: string): HttpsError {
  if (error instanceof HttpsError) return error;

  const message = errorMessage(error);
  const status = typeof (error as { status?: unknown })?.status === 'number'
    ? (error as { status: number }).status
    : undefined;
  const errorRecord = (error && typeof error === 'object') ? error as Record<string, unknown> : {};
  const errorCode = typeof errorRecord.code === 'string' ? errorRecord.code : undefined;
  const errorStatus = typeof errorRecord.status === 'string' ? errorRecord.status : undefined;
  const combined = [
    message,
    errorCode,
    errorStatus,
    typeof errorRecord.reason === 'string' ? errorRecord.reason : undefined,
  ].filter(Boolean).join(' ');
  const lower = combined.toLowerCase();

  let code: GatewayErrorCode = 'internal';
  let publicMessage = message;

  if (
    lower.includes('prepayment credits are depleted') ||
    lower.includes('billing#prepay') ||
    (lower.includes('ai studio') && lower.includes('billing'))
  ) {
    code = 'resource-exhausted';
    publicMessage = 'Google AI Studio prepayment credits are depleted for this Gemini API project. Add credits or switch the app to a funded project before trying image generation again.';
  } else if (status === 400 || lower.includes('invalid') || lower.includes('bad request') || lower.includes('safety') || lower.includes('policy') || lower.includes('blocked') || lower.includes('unsupported') || lower.includes('not supported')) {
    code = 'invalid-argument';
    publicMessage = `Google rejected the image generation settings: ${message}`;
  }
  else if (status === 401 || status === 403 || lower.includes('api key') || lower.includes('permission') || lower.includes('auth')) code = 'permission-denied';
  else if (status === 404 || lower.includes('not found') || lower.includes('not available')) code = 'failed-precondition';
  else if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) code = 'resource-exhausted';
  else if (status === 503 || status === 504 || lower.includes('timeout') || lower.includes('deadline') || lower.includes('overloaded')) code = 'deadline-exceeded';
  else if (status === 500 || lower.includes('internal error') || lower.includes('internal server error')) {
    code = 'unavailable';
    publicMessage = 'Google Gemini returned a temporary internal error while generating the image. Try again; if it repeats, switch image model/settings or check Google AI Studio status for this project.';
  }

  if (lower.includes('is not configured') || lower.includes('api key unavailable') || lower.includes('model not found') || lower.includes('model is not available')) {
      code = 'failed-precondition';
  }

  return new HttpsError(code, `${context}: ${publicMessage}`, { status, cause: message, providerCode: errorCode, providerStatus: errorStatus });
}

async function pollVideoOperation(ai: GoogleGenAI, operation: GenerateVideosOperation, jobId: string): Promise<GenerateVideosOperation> {
  let currentOperation = operation;
  let attempts = 0;

  while (!currentOperation.done && attempts < VIDEO_MAX_POLLS) {
    attempts += 1;
    await sleep(VIDEO_POLL_INTERVAL_MS);
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });

    await safeDbUpdate(jobId, {
      progress: Math.min(95, Math.round((attempts / VIDEO_MAX_POLLS) * 95)),
      updatedAt: new Date().toISOString(),
    });
  }

  if (!currentOperation.done) {
    throw new Error(`Veo generation timed out after ${attempts} polling attempts.`);
  }

  return currentOperation;
}

function extractGeneratedVideo(operation: GenerateVideosOperation): Video {
  const raiCount = operation.response?.raiMediaFilteredCount ?? 0;
  const generatedVideos = operation.response?.generatedVideos ?? [];

  if (operation.error) {
    const errorText = JSON.stringify(operation.error);
    throw new Error(`Veo operation failed: ${errorText}`);
  }

  if (raiCount > 0 && generatedVideos.length === 0) {
    const reasons = operation.response?.raiMediaFilteredReasons?.join(', ') || 'content policy violation';
    throw new Error(`Video was blocked by safety filters: ${reasons}`);
  }

  const video = generatedVideos[0]?.video;
  if (!video) {
    throw new Error('Veo completed but returned no video asset.');
  }

  return video;
}

async function fetchVideoUri(uri: string): Promise<Buffer> {
  let apiKey: string | null = null;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || null;
  }

  const fetchUri = apiKey && !uri.includes('key=')
    ? `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`
    : uri;
  const response = await fetch(fetchUri);
  if (!response.ok) {
    throw new Error(`Failed to download generated video URI: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function downloadGeneratedVideo(ai: GoogleGenAI, video: Video, jobId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (video.videoBytes) {
    return { buffer: Buffer.from(video.videoBytes, 'base64'), mimeType: video.mimeType || 'video/mp4' };
  }

  const downloadPath = join(tmpdir(), `${jobId}_${Date.now()}.mp4`);
  try {
    await ai.files.download({ file: video, downloadPath });
    return { buffer: await readFile(downloadPath), mimeType: video.mimeType || 'video/mp4' };
  } catch (downloadError) {
    if (video.uri) {
      return { buffer: await fetchVideoUri(video.uri), mimeType: video.mimeType || 'video/mp4' };
    }
    throw downloadError;
  } finally {
    await rm(downloadPath, { force: true }).catch(() => undefined);
  }
}

/**
 * generateImageV3 - Routes to gemini-3-pro-image-preview
 */
export const generateImageV3 = onCall({ timeoutSeconds: 120, memory: '1GiB', secrets: [geminiApiKey], enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateImageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Payload validation failed. Ensure no base64 is passed and only gs:// URIs are used.');
  }

  const { prompt, aspectRatio, model, imageSize, thinkingLevel, useGoogleSearch, useGrounding } = parsed.data;
  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;
  
  await safeDbSet(jobId, {
    id: jobId,
    userId,
    status: 'processing',
    type: 'image',
    prompt,
    createdAt: new Date().toISOString()
  });

  try {
    const ai = getAiClient();
    const modelId = resolveImageModel(model);
    const normalizedThinkingLevel = normalizeThinkingLevel(thinkingLevel);
    const normalizedImageSize = normalizeImageSize(imageSize);
    const config: Record<string, unknown> = {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio,
        ...(normalizedImageSize ? { imageSize: normalizedImageSize } : {}),
      },
    };

    if (normalizedThinkingLevel && model === 'fast') {
      config.thinkingConfig = { thinkingLevel: normalizedThinkingLevel };
    }
    if (useGoogleSearch || useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    // Generate image using Gemini 3 Multimodal capabilities
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
    });

    const image = extractInlineMedia(response, 'image');
    
    const buffer = Buffer.from(image.data, 'base64');
    
    // Strict Thin Client adherence: Save directly to Cloud Storage
    const outputUri = await uploadToStorage(userId, buffer, extensionForMime(image.mimeType, 'jpg'), image.mimeType);
    
    await safeDbUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
      completedAt: new Date().toISOString()
    });

    // Return only the lightweight URI to the client
    return { jobId, resultUri: outputUri };
  } catch (error: unknown) {
    // COMPREHENSIVE DEBUG LOGGING
    console.error(`[generateImageV3] CRITICAL FAILURE: Unhandled exception caught.`);
    console.error(`[generateImageV3] RAW ERROR:`, error);
    if (error && typeof error === 'object') {
      console.error(`[generateImageV3] ERROR KEYS:`, Object.keys(error));
      console.error(`[generateImageV3] ERROR MESSAGE:`, (error as Error).message);
      console.error(`[generateImageV3] ERROR STACK:`, (error as Error).stack);
      try {
        console.error(`[generateImageV3] STRINGIFIED:`, JSON.stringify(error, null, 2));
      } catch {
        console.error(`[generateImageV3] STRINGIFIED: (failed to stringify)`);
      }
    }

    await safeDbUpdate(jobId, {
      status: 'failed',
      error: errorMessage(error)
    });
    throw toGatewayError(error, 'Image generation failed');
  }
});

/**
 * generateVideoV3 - Routes to Veo 3.1 via the long-running generateVideos API.
 */
export const generateVideoV3 = onCall({ timeoutSeconds: 540, secrets: [geminiApiKey] , enforceAppCheck: true}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateVideoSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid video payload. Base64 forbidden; use gs:// URIs for reference media.');

  const {
    prompt,
    referenceUri,
    firstFrameUri,
    lastFrameUri,
    referenceUris,
    aspectRatio,
    model,
    resolution,
    durationSeconds,
    personGeneration,
    negativePrompt,
    seed,
    enhancePrompt,
  } = parsed.data;
  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;
  const normalizedResolution = normalizeVideoResolution(resolution, model);
  const hasFrameInput = !!firstFrameUri || !!referenceUri || !!lastFrameUri;
  const normalizedDuration = normalizeVideoDuration(durationSeconds, normalizedResolution, hasFrameInput);
  const modelId = resolveVideoModel(model);
  
  await safeDbSet(jobId, {
    id: jobId,
    userId,
    status: 'processing',
    type: 'video',
    prompt,
    model: modelId,
    progress: 0,
    createdAt: new Date().toISOString()
  });

  try {
    const ai = getAiClient();
    const image = toImage(firstFrameUri || referenceUri);
    const referenceImages = toReferenceImages(referenceUris);
    const config: Record<string, unknown> = {
      numberOfVideos: 1,
      aspectRatio: normalizeVideoAspectRatio(aspectRatio),
      durationSeconds: normalizedDuration,
      resolution: normalizedResolution,
      ...(negativePrompt ? { negativePrompt } : {}),
      ...(normalizeVideoSeed(seed) !== undefined ? { seed: normalizeVideoSeed(seed) } : {}),
      ...(enhancePrompt !== undefined ? { enhancePrompt } : {}),
      ...(normalizePersonGeneration(personGeneration, hasFrameInput) ? { personGeneration: normalizePersonGeneration(personGeneration, hasFrameInput) } : {}),
      ...(lastFrameUri ? { lastFrame: toImage(lastFrameUri) } : {}),
      ...(referenceImages ? { referenceImages } : {}),
    };

    let operation = await ai.models.generateVideos({
      model: modelId,
      prompt,
      ...(image ? { image } : {}),
      config: config as Parameters<typeof ai.models.generateVideos>[0]['config'],
    });

    operation = await pollVideoOperation(ai, operation, jobId);
    const video = extractGeneratedVideo(operation);
    const downloadedVideo = await downloadGeneratedVideo(ai, video, jobId);
    const outputUri = await uploadToStorage(
      userId,
      downloadedVideo.buffer,
      extensionForMime(downloadedVideo.mimeType, 'mp4'),
      downloadedVideo.mimeType,
    );
    
    await safeDbUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
      progress: 100,
      metadata: {
        model: modelId,
        aspectRatio: normalizeVideoAspectRatio(aspectRatio),
        resolution: normalizedResolution,
        durationSeconds: normalizedDuration,
        mimeType: downloadedVideo.mimeType,
        hasFirstFrame: !!image,
        referenceCount: referenceImages?.length ?? 0,
      },
      completedAt: new Date().toISOString()
    });

    return { jobId, resultUri: outputUri };
  } catch (error: unknown) {
    await safeDbUpdate(jobId, { status: 'failed', error: errorMessage(error) });
    throw toGatewayError(error, 'Video generation failed');
  }
});

/**
 * generateOmniRemixV3 - Contract for Gemini Omni Flash video-to-video remixing.
 *
 * Google has announced Gemini Omni Flash for video creation/editing in Gemini app,
 * Flow, and Shorts, with API access rolling out later. This callable is wired so
 * the UI can use the real backend path as soon as the API model ID is configured.
 */
export const generateOmniRemixV3 = onCall({ timeoutSeconds: 540, secrets: [geminiApiKey] , enforceAppCheck: true}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');

  const parsed = GenerateOmniRemixSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid Omni payload. Upload media to Cloud Storage and pass gs:// URIs only.');
  }

  const data = parsed.data;
  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;

  if (!process.env.GEMINI_OMNI_FLASH_MODEL && !process.env.VITE_GEMINI_OMNI_FLASH_MODEL) {
    throw new HttpsError('failed-precondition', 'Omni remix failed: Gemini Omni Flash is not configured.');
  }

  const modelId = resolveOmniFlashModel();

  await safeDbSet(jobId, {
    id: jobId,
    userId,
    status: 'processing',
    type: 'omni-video',
    prompt: data.prompt,
    model: modelId,
    progress: 0,
    metadata: {
      pipelineMode: data.pipelineMode,
      hasAudioReference: !!data.audioUri,
      referenceCount: data.referenceUris?.length ?? 0,
      synthIdRequested: data.synthIdEnabled ?? true,
    },
    createdAt: new Date().toISOString()
  });

  try {
    const ai = getAiClient();
    const referenceImages = toReferenceImages(data.referenceUris);
    const config: Record<string, unknown> = {
      numberOfVideos: 1,
      aspectRatio: data.aspectRatio,
      durationSeconds: normalizeVideoDuration(data.durationSeconds > 8 ? 8 : data.durationSeconds, '1080p', true),
      resolution: '1080p',
      enhancePrompt: true,
      ...(referenceImages ? { referenceImages } : {}),
    };

    let operation = await ai.models.generateVideos({
      model: modelId,
      video: { uri: data.referenceVideoUri, mimeType: 'video/mp4' },
      prompt: buildOmniPrompt(data),
      config: config as Parameters<typeof ai.models.generateVideos>[0]['config'],
    });

    operation = await pollVideoOperation(ai, operation, jobId);
    const video = extractGeneratedVideo(operation);
    const downloadedVideo = await downloadGeneratedVideo(ai, video, jobId);
    const outputUri = await uploadToStorage(
      userId,
      downloadedVideo.buffer,
      extensionForMime(downloadedVideo.mimeType, 'mp4'),
      downloadedVideo.mimeType,
    );

    await safeDbUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
      progress: 100,
      metadata: {
        model: modelId,
        pipelineMode: data.pipelineMode,
        aspectRatio: data.aspectRatio,
        durationSeconds: config.durationSeconds,
        mimeType: downloadedVideo.mimeType,
        hasAudioReference: !!data.audioUri,
        referenceCount: referenceImages?.length ?? 0,
        synthIdRequested: data.synthIdEnabled ?? true,
      },
      completedAt: new Date().toISOString()
    });

    return { jobId, resultUri: outputUri };
  } catch (error: unknown) {
    await safeDbUpdate(jobId, { status: 'failed', error: errorMessage(error) });
    throw toGatewayError(error, 'Omni remix failed');
  }
});

/**
 * generateAudioV3 - Routes to NB2
 */
export const generateAudioV3 = onCall({ timeoutSeconds: 300, secrets: [geminiApiKey] , enforceAppCheck: true}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateAudioSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid payload.');

  const { prompt } = parsed.data;
  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;

  await safeDbSet(jobId, {
    id: jobId,
    userId,
    status: 'processing',
    type: 'audio',
    prompt,
    createdAt: new Date().toISOString()
  });

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: FUNCTION_INTELLIGENCE_MODELS.TEXT.FAST, // Nano Banana 2
      contents: prompt,
      config: {
        responseModalities: ["AUDIO"]
      }
    });

    const audio = extractInlineMedia(response, 'audio');

    const buffer = Buffer.from(audio.data, 'base64');
    const outputUri = await uploadToStorage(userId, buffer, extensionForMime(audio.mimeType, 'wav'), audio.mimeType);
    
    await safeDbUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
      completedAt: new Date().toISOString()
    });

    return { jobId, resultUri: outputUri };
  } catch (error: unknown) {
    await safeDbUpdate(jobId, { status: 'failed', error: errorMessage(error) });
    throw toGatewayError(error, 'Audio generation failed');
  }
});
