import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { getGeminiApiKey, geminiApiKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';
import { getVertexAIClient } from '../../lib/vertexClient';
import { GenerateAudioSchema, GenerateImageSchema, GenerateVideoSchema, GenerateOmniRemixSchema } from '../../shared/creative';
import { VideoJobDocumentSchema, type VideoJobDocument } from '../../shared/videoJob';
import { finalizeOperationReservation } from '../billing/enforceOperationCost';
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

const ENFORCE_APP_CHECK = process.env.NODE_ENV === 'production' && process.env.SKIP_APP_CHECK !== "true" && process.env.ENFORCE_APP_CHECK !== "false";

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
  fast: 'gemini-3.1-flash-image',
  pro: 'gemini-3-pro-image',
  legacy: 'gemini-2.5-flash-image',
} as const;

// GA model IDs (ISSUE-867) — the *-preview IDs are deprecated April 2026.
const VIDEO_MODEL_IDS = {
  fast: 'veo-3.1-fast-generate-001',
  pro: 'veo-3.1-generate-001',
  lite: 'veo-3.1-lite-generate-001',
} as const;
type VideoModelId = typeof VIDEO_MODEL_IDS[keyof typeof VIDEO_MODEL_IDS];

const OMNI_FLASH_MODEL_ID = process.env.GEMINI_OMNI_FLASH_MODEL || '';
const VIDEO_POLL_INTERVAL_MS = Number(process.env.VIDEO_POLL_INTERVAL_MS || '10000');
const VIDEO_MAX_POLLS = Number(process.env.VIDEO_MAX_POLLS || '54');

function getMediaVertexLocation(kind: MediaKind): string {
  switch (kind) {
    case 'image':
      return process.env.VERTEX_IMAGE_LOCATION || process.env.VERTEX_MEDIA_LOCATION || 'us';
    case 'video':
      return process.env.VERTEX_VIDEO_LOCATION || process.env.VERTEX_MEDIA_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';
    case 'audio':
      return process.env.VERTEX_AUDIO_LOCATION || process.env.VERTEX_MEDIA_LOCATION || process.env.VERTEX_LOCATION || 'global';
  }
}

// Helper to resolve the GenAI client using Google AI Studio (API Key) or Vertex AI (ADC).
// This fully adheres to the secure proxy architecture, with backend-only media routing.
function getRawAiClient(kind: MediaKind, forceVertex = false): GoogleGenAI {
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

  return getVertexAIClient(project, getMediaVertexLocation(kind));
}

/**
 * Proxy wrapper that retries on API key failures by falling back to Vertex AI.
 * Handles nested object/method chains so .models.generateContent(...) works.
 * Type is preserved via generic T; only the function invoke layer is polymorphic.
 */
function wrapWithFallback<T extends object>(
  obj: T,
  forceVertex: boolean,
  fallbackFactory: () => T,
): T {
  return new Proxy(obj, {
    get(target: T, prop: string | symbol, receiver: unknown): unknown {
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        // Async wrapper that retries on API key errors
        return async function wrappedMethod(...args: unknown[]): Promise<unknown> {
          try {
            return await (val as (...args: unknown[]) => Promise<unknown>).apply(target, args);
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const isApiKeyError = errorMsg.includes('API key expired') ||
                                  errorMsg.includes('API_KEY_INVALID') ||
                                  errorMsg.includes('API key not valid') ||
                                  (errorMsg.includes('INVALID_ARGUMENT') && errorMsg.includes('API key'));

            if (isApiKeyError && !forceVertex) {
              console.warn('[creativeGateway] API key error encountered. Retrying automatically with Vertex AI ADC...', errorMsg);
              const fallbackObj = fallbackFactory();
              const fallbackFn = Reflect.get(fallbackObj, prop, fallbackObj) as (...args: unknown[]) => Promise<unknown>;
              return await fallbackFn.apply(fallbackObj, args);
            }
            throw error;
          }
        };
      } else if (val && typeof val === 'object') {
        // Recursively wrap nested objects to handle .models.generateContent(...) chains
        return wrapWithFallback(val as object, forceVertex, () => {
          const nextFallback = fallbackFactory();
          return Reflect.get(nextFallback, prop, nextFallback) as object;
        });
      }
      return val;
    }
  }) as T;
}

function getAiClient(kind: MediaKind, forceVertex = false): GoogleGenAI {
  const client = getRawAiClient(kind, forceVertex);
  if (forceVertex) return client;
  return wrapWithFallback(client, false, () => getRawAiClient(kind, true));
}

// Defer firestore and storage initialization until first use (for test compatibility)
function getDb() {
  return admin.firestore();
}

function getStorage() {
  return admin.storage();
}

/**
 * Helper: Upload a raw buffer to Cloud Storage and return the gs:// URI
 */
async function uploadToStorage(
  userId: string,
  buffer: Buffer,
  extension: string,
  contentType?: string,
  options?: {
    projectId?: string;
    sessionId?: string;
    jobId?: string;
    category?: 'image' | 'video' | 'audio';
    purpose?: 'outputs' | 'intermediates' | 'thumbnails';
  }
): Promise<string> {
  const bucket = getStorage().bucket();
  const mediaCategory = options?.category || (extension === 'mp4' ? 'video' : extension === 'wav' ? 'audio' : 'image');
  const purpose = options?.purpose || 'outputs';
  const basePath = options?.projectId
    ? `creative/${userId}/projects/${options.projectId}/${mediaCategory}/${purpose}`
    : options?.sessionId || options?.jobId
      ? `creative/${userId}/video/tmp/${options.sessionId || options.jobId}/${purpose}`
      : `creative/${userId}/${mediaCategory}/${purpose}`;
  const filename = `${basePath}/${Date.now()}_${crypto.randomUUID().split('-')[0]}.${extension}`;
  const file = bucket.file(filename);
  await file.save(buffer, {
    resumable: false,
    contentType: contentType || (extension === 'mp4' ? 'video/mp4' : extension === 'wav' ? 'audio/wav' : 'image/jpeg')
  });
  return `gs://${bucket.name}/${filename}`;
}

async function safeDbSet(
  jobId: string,
  data: Record<string, unknown>,
  collection: string = 'creative_jobs',
) {
  try {
    await getDb().collection(collection).doc(jobId).set(data);
  } catch (e) {
    console.warn(`[creativeGateway] Firestore set failed for ${collection} (non-blocking):`, e);
  }
}

async function safeDbUpdate(
  jobId: string,
  data: Record<string, unknown>,
  collection: string = 'creative_jobs',
) {
  try {
    await getDb().collection(collection).doc(jobId).update(data);
  } catch (e) {
    console.warn(`[creativeGateway] Firestore update failed for ${collection} (non-blocking):`, e);
  }
}

async function syncVideoJobDocument(jobId: string, data: Record<string, unknown>) {
  await Promise.all([
    safeDbSet(jobId, data, 'creative_jobs'),
    safeDbSet(jobId, data, 'videoJobs'),
  ]);
}

async function syncVideoJobUpdate(jobId: string, data: Record<string, unknown>) {
  await Promise.all([
    safeDbUpdate(jobId, data, 'creative_jobs'),
    safeDbUpdate(jobId, data, 'videoJobs'),
  ]);
}

async function loadTrackedVideoJob(jobId: string): Promise<Record<string, unknown> | null> {
  const [videoSnap, creativeSnap] = await Promise.all([
    getDb().collection('videoJobs').doc(jobId).get(),
    getDb().collection('creative_jobs').doc(jobId).get(),
  ]);
  if (videoSnap.exists) return videoSnap.data() as Record<string, unknown>;
  if (creativeSnap.exists) return creativeSnap.data() as Record<string, unknown>;
  return null;
}

function normalizeImageSize(imageSize?: string): '512' | '1K' | '2K' | '4K' | undefined {
  if (!imageSize) return undefined;
  if (imageSize === '0.5K') return '512';
  if (imageSize.toLowerCase() === '1k') return '1K';
  if (imageSize.toLowerCase() === '2k') return '2K';
  if (imageSize.toLowerCase() === '4k') return '4K';
  return '1K';
}

function normalizeThinkingLevel(thinkingLevel?: string): 'minimal' | 'high' | undefined {
  if (!thinkingLevel || thinkingLevel === 'none') return undefined;
  if (thinkingLevel === 'high' || thinkingLevel === 'medium') return 'high';
  return 'minimal';
}

function resolveImageModel(model: z.infer<typeof GenerateImageSchema>['model']): string {
  if (model === 'pro') return IMAGE_MODEL_IDS.pro;
  // Explicit legacy only. 'lite' is NOT a silent downgrade to the 2.5 legacy
  // model (ISSUE-871) — no supported Lite image model exists, so lite resolves
  // to fast (same price tier, full capability set).
  if (model === 'legacy') return IMAGE_MODEL_IDS.legacy;
  return IMAGE_MODEL_IDS.fast;
}

function resolveVideoModel(model: string | undefined): VideoModelId {
  if (model === VIDEO_MODEL_IDS.pro || model === 'pro' || (model?.includes('pro') ?? false)) return VIDEO_MODEL_IDS.pro;
  if (model === VIDEO_MODEL_IDS.lite || model === 'lite' || (model?.includes('lite') ?? false)) return VIDEO_MODEL_IDS.lite;
  return VIDEO_MODEL_IDS.fast;
}

/**
 * Omni Flash model resolution (ISSUE-872): there is NO verified default —
 * the old 'gemini-omni-flash-preview' fallback was a placeholder that let
 * jobs start (and reserve cost) against a model that may not exist. Omni is
 * unavailable unless GEMINI_OMNI_FLASH_MODEL is explicitly configured.
 */
function resolveOmniFlashModel(): string | null {
  return process.env.GEMINI_OMNI_FLASH_MODEL || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeVideoAspectRatio(aspectRatio: z.infer<typeof GenerateVideoSchema>['aspectRatio']): '16:9' | '9:16' {
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

function normalizeVideoResolution(
  resolution: z.infer<typeof GenerateVideoSchema>['resolution'] | undefined,
  model: string | undefined,
): '720p' | '1080p' | '4k' {
  const normalizedInput = resolution ?? '720p';
  const normalizedModel = model && model.includes('lite') ? 'lite' : 'fast';
  const normalized = normalizedInput === '1280x720'
    ? '720p'
    : normalizedInput === '1920x1080'
      ? '1080p'
      : normalizedInput === '3840x2160'
        ? '4k'
        : normalizedInput;

  if (normalizedModel === 'lite' && normalized === '4k') return '1080p';
  return normalized;
}

function normalizeVideoDuration(durationSeconds: number | undefined, resolution: string, hasFrameInput: boolean): 4 | 6 | 8 {
  const safeDurationSeconds = durationSeconds ?? 8;
  if (resolution !== '720p' || hasFrameInput) return 8;
  if (safeDurationSeconds <= 4) return 4;
  if (safeDurationSeconds <= 6) return 6;
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

function estimateVideoCost(durationSeconds: number, model?: string, mode?: string): number {
  const normalizedDuration = Math.max(1, durationSeconds);
  const isPro = !!model && (model.includes('pro') || model === VIDEO_MODEL_IDS.pro);
  const isLite = !!model && (model.includes('lite') || model === VIDEO_MODEL_IDS.lite);
  const baseRate = isPro ? 0.4 : isLite ? 0.05 : 0.1;
  const modeMultiplier = mode === 'temporal_inpaint' ? 1.35 : mode === 'long_form' ? 1.2 : 1;
  return Math.round(normalizedDuration * baseRate * modeMultiplier * 100) / 100;
}

const TEMPORAL_INPAINT_ENABLED = process.env.GEMINI_VEO_TEMPORAL_INPAINT_ENABLED === 'true';

function supportsTemporalInpaint(modelId: string): boolean {
  return TEMPORAL_INPAINT_ENABLED || modelId.includes('temporal') || modelId.includes('inpaint');
}

async function loadCostReservation(
  userId: string,
  costReservationId: string,
  expectedType: 'image' | 'video' = 'video',
): Promise<{ estimatedCost: number }> {
  const snapshot = await getDb().collection('costLedger').doc(costReservationId).get();
  if (!snapshot.exists) {
    throw new HttpsError('failed-precondition', `Missing cost reservation ${costReservationId}. Reserve cost before submitting the job.`);
  }

  const data = snapshot.data() as Record<string, unknown>;
  if (data.userId !== userId) {
    throw new HttpsError('permission-denied', 'Cost reservation does not belong to the authenticated user.');
  }
  if (data.type !== expectedType) {
    throw new HttpsError('failed-precondition', `Cost reservation type mismatch for ${expectedType} generation.`);
  }
  if (data.status !== 'APPROVED') {
    throw new HttpsError('failed-precondition', 'Cost reservation is not approved.');
  }

  const estimatedCost = typeof data.estimatedCost === 'number'
    ? data.estimatedCost
    : Number(data.estimatedCost);
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
    throw new HttpsError('failed-precondition', 'Cost reservation contains an invalid estimated cost.');
  }

  return { estimatedCost };
}

function resolveVideoJobMode(mode?: string): 'video_remix' | 'temporal_inpaint' {
  return mode === 'temporal_inpaint' ? 'temporal_inpaint' : 'video_remix';
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

function parseGsUri(uri: string): { bucket: string; path: string } {
  const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new HttpsError('invalid-argument', `Expected a gs:// URI, got: ${uri}`);
  }
  return { bucket: match[1]!, path: match[2]! };
}

function isOwnerScopedCreativePath(userId: string, path: string): boolean {
  return (
    path.startsWith(`creative/${userId}/`) ||
    path.startsWith(`users/${userId}/vault/`)
  );
}

async function loadReferenceImage(userId: string, uri: string): Promise<{ mimeType: string; data: string }> {
  const { bucket, path } = parseGsUri(uri);
  if (!isOwnerScopedCreativePath(userId, path)) {
    throw new HttpsError('permission-denied', 'Reference media must live in your creative storage namespace.');
  }

  const file = getStorage().bucket(bucket).file(path);
  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || 'image/png';
  if (!contentType.startsWith('image/')) {
    throw new HttpsError('invalid-argument', `Reference media must be an image, got ${contentType}.`);
  }

  const [buffer] = await file.download();
  return { mimeType: contentType, data: buffer.toString('base64') };
}

async function loadReferenceImages(userId: string, requestData: { referenceUri?: string; referenceUris?: string[] }): Promise<{ mimeType: string; data: string }[]> {
  const uris = [
    requestData.referenceUri,
    ...(requestData.referenceUris ?? []),
  ].filter((uri, index, array): uri is string => !!uri && array.indexOf(uri) === index);

  return Promise.all(uris.map(uri => loadReferenceImage(userId, uri)));
}

function extractInteractionImage(response: unknown, kind: MediaKind = 'image'): { mimeType: string; data: string } {
  const typed = response as {
    output_image?: { data?: string; mime_type?: string; mimeType?: string };
    outputs?: Array<Record<string, unknown>>;
    status?: string;
  };

  if (typed.output_image?.data) {
    return {
      data: typed.output_image.data,
      mimeType: typed.output_image.mime_type || typed.output_image.mimeType || 'image/png',
    };
  }

  for (const output of typed.outputs ?? []) {
    if (!output || typeof output !== 'object') continue;
    const imageOutput = output as {
      type?: string;
      data?: string;
      mime_type?: string;
      mimeType?: string;
      parts?: Array<Record<string, unknown>>;
    };

    if (imageOutput.type === 'image' && imageOutput.data) {
      return {
        data: imageOutput.data,
        mimeType: imageOutput.mime_type || imageOutput.mimeType || 'image/png',
      };
    }

    for (const part of imageOutput.parts ?? []) {
      const inlineData = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inlineData?.data) {
        return {
          data: inlineData.data,
          mimeType: inlineData.mimeType || 'image/png',
        };
      }
    }
  }

  const textPreview = (typed.outputs ?? [])
    .flatMap(output => {
      if (!output || typeof output !== 'object') return [];
      const imageOutput = output as { text?: string; parts?: Array<Record<string, unknown>> };
      const textParts = imageOutput.text ? [imageOutput.text] : [];
      const nestedTextParts = (imageOutput.parts ?? [])
        .map(part => (part as { text?: string }).text)
        .filter((text): text is string => !!text);
      return [...textParts, ...nestedTextParts];
    })
    .join(' ')
    .slice(0, 180) || undefined;

  throw new MediaGenerationError(kind, 'NO_IMAGE', textPreview);
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

/** Article + noun for user-facing copy, e.g. "an image", "a video", "audio". */
const MEDIA_NOUN: Record<MediaKind, string> = {
  image: 'an image',
  video: 'a video',
  audio: 'audio',
};

type MediaFailureCategory = 'safety' | 'recitation' | 'truncated' | 'declined';

interface MediaFailureClassification {
  category: MediaFailureCategory;
  code: GatewayErrorCode;
  publicMessage: string;
}

/**
 * Map a Gemini finish reason (e.g. NO_IMAGE, IMAGE_SAFETY, RECITATION) to an
 * accurate, user-facing message and the correct callable error code.
 *
 * This is deliberately type-driven. A benign "the model declined to render this
 * prompt" (NO_IMAGE) must never be mislabeled as a settings or billing rejection
 * by downstream substring matching — that was the original defect.
 */
export function classifyMediaFinishFailure(
  kind: MediaKind,
  finishReason: string,
): MediaFailureClassification {
  const noun = MEDIA_NOUN[kind];
  const reason = (finishReason || '').toUpperCase();

  if (/SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(reason)) {
    return {
      category: 'safety',
      code: 'invalid-argument',
      publicMessage: `That prompt was blocked by Google's safety filters, so no ${kind} was produced. Adjust the wording to avoid restricted or sensitive content and try again.`,
    };
  }

  if (reason.includes('RECITATION')) {
    return {
      category: 'recitation',
      code: 'invalid-argument',
      publicMessage: `Google blocked the ${kind} because it closely matched protected or copyrighted material. Try a more original prompt.`,
    };
  }

  if (reason.includes('MAX_TOKENS')) {
    return {
      category: 'truncated',
      code: 'failed-precondition',
      publicMessage: `The model ran out of room before it could finish ${noun}. Try a shorter, simpler prompt.`,
    };
  }

  // NO_IMAGE / IMAGE_OTHER / OTHER / STOP-with-no-media / unknown: the request
  // was valid but the model chose not to render. Almost always a conversational
  // or under-specified prompt, so guide the user to describe the result directly.
  return {
    category: 'declined',
    code: 'failed-precondition',
    publicMessage: `INDII couldn't create ${noun} from that prompt. Describe the ${kind} directly — the subject, style, and setting — instead of asking a question, then try again.`,
  };
}

/**
 * Raised when Gemini returns a response with no usable media part. Carries the
 * provider finish reason plus a pre-classified, user-facing message so the error
 * is handled by type — never by sniffing substrings — all the way to the client.
 */
export class MediaGenerationError extends Error {
  readonly kind: MediaKind;
  readonly finishReason: string;
  readonly category: MediaFailureCategory;
  readonly code: GatewayErrorCode;
  readonly publicMessage: string;
  readonly textPreview?: string;

  constructor(kind: MediaKind, finishReason: string, textPreview?: string) {
    const { category, code, publicMessage } = classifyMediaFinishFailure(kind, finishReason);
    // The detailed message is what lands in logs and the job document.
    const detail = `No ${kind} returned from Gemini (finish reason: ${finishReason || 'unknown'})${textPreview ? `. Model text: ${textPreview}` : ''}`;
    super(detail);
    this.name = 'MediaGenerationError';
    this.kind = kind;
    this.finishReason = finishReason || 'unknown';
    this.category = category;
    this.code = code;
    this.publicMessage = publicMessage;
    this.textPreview = textPreview;
  }
}

function extractInlineMedia(response: unknown, kind: MediaKind): { data: string; mimeType: string } {
  interface GeneratedImageResponse {
    generatedImages?: Array<{
      image?: {
        mimeType?: string;
        imageBytes?: string;
      };
    }>;
  }
  const typedResponse = response as GeneratedImageResponse;
  if (kind === 'image' && typedResponse?.generatedImages?.[0]?.image?.imageBytes) {
    return {
      mimeType: typedResponse.generatedImages[0].image.mimeType || 'image/jpeg',
      data: typedResponse.generatedImages[0].image.imageBytes
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
    .slice(0, 180) || undefined;

  throw new MediaGenerationError(kind, finishReasons, textPreview);
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

  // Pre-classified "no media returned" failures carry their own user-facing
  // message and code. Handle by type so a benign NO_IMAGE is never re-mapped to a
  // settings/billing rejection by the substring matching below.
  if (error instanceof MediaGenerationError) {
    return new HttpsError(error.code, `${context}: ${error.publicMessage}`, {
      finishReason: error.finishReason,
      category: error.category,
      cause: error.message,
    });
  }

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
    const trackedJob = await loadTrackedVideoJob(jobId);
    const trackedStatus = typeof trackedJob?.status === 'string' ? trackedJob.status.toLowerCase() : '';
    if (trackedStatus === 'cancelled') {
      throw new HttpsError('cancelled', 'Video generation cancelled by user.');
    }

    attempts += 1;
    await sleep(VIDEO_POLL_INTERVAL_MS);
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });

    await syncVideoJobUpdate(jobId, {
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

export type VideoGenerationJobRecord = VideoJobDocument & {
  type: 'video';
  prompt: string;
  aspectRatio?: z.infer<typeof GenerateVideoSchema>['aspectRatio'];
  firstFrameUri?: string;
  lastFrameUri?: string;
  referenceUri?: string;
  referenceUris?: string[];
  resolution?: z.infer<typeof GenerateVideoSchema>['resolution'];
  durationSeconds?: number;
  negativePrompt?: string;
  personGeneration?: z.infer<typeof GenerateVideoSchema>['personGeneration'];
  seed?: z.infer<typeof GenerateVideoSchema>['seed'];
  enhancePrompt?: boolean;
  parentId?: string;
};

export async function executeVideoJob(jobId: string, job: VideoGenerationJobRecord): Promise<{ jobId: string; resultUri: string }> {
  const normalizedResolution = normalizeVideoResolution(job.resolution, job.model);
  const hasFrameInput = !!job.firstFrameUri || !!job.referenceUri || !!job.lastFrameUri;
  const normalizedDuration = normalizeVideoDuration(job.durationSeconds, normalizedResolution, hasFrameInput);
  const modelId = resolveVideoModel(job.model);
  const effectiveMode = resolveVideoJobMode(job.mode);
  const sourceVideoUri = job.payload?.sourceVideoUri || job.referenceUri || job.firstFrameUri;
  const maskUri = job.payload?.maskTrackUri || job.payload?.maskFrameUri;
  const maskUris = maskUri ? [maskUri] : [];
  const inputUris = [
    sourceVideoUri,
    job.firstFrameUri,
    job.lastFrameUri,
    ...(job.referenceUris ?? []),
    ...maskUris,
  ].filter((uri): uri is string => !!uri);
  const serverEstimatedCost = estimateVideoCost(normalizedDuration, modelId, effectiveMode);

  await syncVideoJobUpdate(jobId, {
    id: jobId,
    userId: job.userId,
    status: 'processing',
    type: 'video',
    prompt: job.prompt,
    model: modelId,
    mode: effectiveMode,
    progress: 0,
    costEstimate: job.costEstimate ?? serverEstimatedCost,
    costReservationId: job.costReservationId,
    inputUris,
    maskUris,
    payload: {
      prompt: job.prompt,
      sourceVideoUri,
      maskFrameUri: job.payload?.maskFrameUri,
      maskTrackUri: job.payload?.maskTrackUri,
      frameRange: job.payload?.frameRange,
      cameraPhysics: job.payload?.cameraPhysics,
    },
    maskMetadata: {
      mode: effectiveMode,
      sourceVideoUri,
      maskFrameUri: job.payload?.maskFrameUri,
      maskTrackUri: job.payload?.maskTrackUri,
      frameRange: job.payload?.frameRange,
      hasTemporalMask: effectiveMode === 'temporal_inpaint',
    },
    metadata: {
      model: modelId,
      resolution: normalizedResolution,
      durationSeconds: normalizedDuration,
      aspectRatio: normalizeVideoAspectRatio(job.aspectRatio ?? '16:9'),
      referenceCount: job.referenceUris?.length ?? 0,
      hasFirstFrame: !!job.firstFrameUri || !!job.referenceUri,
      hasLastFrame: !!job.lastFrameUri,
      mode: effectiveMode,
      hasTemporalMask: effectiveMode === 'temporal_inpaint',
      sourceVideoUri,
      maskFrameUri: job.payload?.maskFrameUri,
      maskTrackUri: job.payload?.maskTrackUri,
      frameRange: job.payload?.frameRange,
    },
    updatedAt: new Date().toISOString(),
  });

  try {
    const ai = getAiClient('video');
    const image = toImage(job.firstFrameUri || job.referenceUri);
    const referenceImages = toReferenceImages(job.referenceUris);
    const config: Record<string, unknown> = {
      numberOfVideos: 1,
      aspectRatio: normalizeVideoAspectRatio(job.aspectRatio ?? '16:9'),
      durationSeconds: normalizedDuration,
      resolution: normalizedResolution,
      ...(job.negativePrompt ? { negativePrompt: job.negativePrompt } : {}),
      ...(normalizeVideoSeed(job.seed) !== undefined ? { seed: normalizeVideoSeed(job.seed) } : {}),
      ...(job.enhancePrompt !== undefined ? { enhancePrompt: job.enhancePrompt } : {}),
      ...(normalizePersonGeneration(job.personGeneration, hasFrameInput) ? { personGeneration: normalizePersonGeneration(job.personGeneration, hasFrameInput) } : {}),
      ...(job.lastFrameUri ? { lastFrame: toImage(job.lastFrameUri) } : {}),
      ...(referenceImages ? { referenceImages } : {}),
    };
    if (effectiveMode === 'temporal_inpaint' && sourceVideoUri && maskUri) {
      config.sourceVideo = { uri: sourceVideoUri, mimeType: 'video/mp4' };
      config.maskVideo = { uri: maskUri, mimeType: 'image/png' };
      config.frameRange = job.payload?.frameRange;
    }

    let operation = await ai.models.generateVideos({
      model: modelId,
      prompt: job.prompt,
      ...(image ? { image } : {}),
      config: config as Parameters<typeof ai.models.generateVideos>[0]['config'],
    });

    await syncVideoJobUpdate(jobId, {
      operationName: operation.name,
      progress: 5,
      updatedAt: new Date().toISOString(),
    });

    operation = await pollVideoOperation(ai, operation, jobId);
    const video = extractGeneratedVideo(operation);
    const downloadedVideo = await downloadGeneratedVideo(ai, video, jobId);
    const outputUri = await uploadToStorage(
      job.userId,
      downloadedVideo.buffer,
      extensionForMime(downloadedVideo.mimeType, 'mp4'),
      downloadedVideo.mimeType,
      {
        projectId: job.projectId,
        sessionId: job.sessionId,
        jobId,
        category: 'video',
        purpose: 'outputs',
      },
    );

    await syncVideoJobUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
        downloadUrl: outputUri,
        videoUrl: outputUri,
        url: outputUri,
        progress: 100,
        actualCost: job.costEstimate ?? serverEstimatedCost,
        output: {
          url: outputUri,
          metadata: {
            model: modelId,
            aspectRatio: normalizeVideoAspectRatio(job.aspectRatio ?? '16:9'),
          resolution: normalizedResolution,
          durationSeconds: normalizedDuration,
          mime_type: downloadedVideo.mimeType,
          hasFirstFrame: !!image,
          hasLastFrame: !!job.lastFrameUri,
            referenceCount: referenceImages?.length ?? 0,
            mode: effectiveMode,
            hasTemporalMask: effectiveMode === 'temporal_inpaint',
          },
        },
        metadata: {
          model: modelId,
          aspectRatio: normalizeVideoAspectRatio(job.aspectRatio ?? '16:9'),
          resolution: normalizedResolution,
          durationSeconds: normalizedDuration,
          mimeType: downloadedVideo.mimeType,
          hasFirstFrame: !!image,
          hasLastFrame: !!job.lastFrameUri,
          referenceCount: referenceImages?.length ?? 0,
          mode: effectiveMode,
          hasTemporalMask: effectiveMode === 'temporal_inpaint',
        },
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return { jobId, resultUri: outputUri };
  } catch (error: unknown) {
    const errorText = errorMessage(error);
    const isCancelled = error instanceof HttpsError
      ? error.code === 'cancelled'
      : errorText.toLowerCase().includes('cancelled');
    await syncVideoJobUpdate(jobId, {
      status: isCancelled ? 'cancelled' : 'failed',
      error: errorText,
      ...(isCancelled ? { cancelledAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    });
    throw toGatewayError(error, 'Video generation failed');
  }
}

/**
 * generateImageV3 - Routes to Gemini 3 image models via Interactions API.
 */
export const generateImageV3 = onCall({ timeoutSeconds: 120, memory: '1GiB', secrets: [geminiApiKey], enforceAppCheck: false }, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateImageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Payload validation failed. Ensure no base64 is passed and only gs:// URIs are used.');
  }

  const { prompt, sessionId, aspectRatio, model, imageSize, thinkingLevel, useGoogleSearch, useGrounding, useImageSearch, costReservationId } = parsed.data;
  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;
  await loadCostReservation(userId, costReservationId, 'image');
  let outputCompleted = false;

  try {
    await safeDbSet(jobId, {
      id: jobId,
      userId,
      sessionId,
      status: 'processing',
      type: 'image',
      prompt,
      costReservationId,
      createdAt: new Date().toISOString()
    });
    const ai = getAiClient('image');
    const modelId = resolveImageModel(model);
    const normalizedThinkingLevel = normalizeThinkingLevel(thinkingLevel);
    const normalizedImageSize = normalizeImageSize(imageSize);
    const referenceImages = await loadReferenceImages(userId, parsed.data);
    const interactionInput = [
      { type: 'text' as const, text: prompt },
      ...referenceImages.map(ref => ({
        type: 'image' as const,
        mime_type: ref.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic' | 'image/heif' | 'image/gif' | 'image/bmp' | 'image/tiff',
        data: ref.data,
      })),
    ];
    const searchTypes: Array<'web_search' | 'image_search' | 'enterprise_web_search'> =
      model === 'fast' && useImageSearch
        ? ['web_search', 'image_search']
        : ['web_search'];
    const googleSearchTool = useGoogleSearch || useGrounding
      ? [{
          type: 'google_search' as const,
          search_types: searchTypes,
        }]
      : undefined;

    let image: { data: string; mimeType: string };

    if ((ai as any).interactions) {
      const interaction = await (ai as any).interactions.create({
        model: modelId,
        input: interactionInput,
        response_modalities: ['image'],
        generation_config: {
          image_config: {
            aspect_ratio: aspectRatio,
            ...(normalizedImageSize ? { image_size: normalizedImageSize } : {}),
          },
          ...(normalizedThinkingLevel && model === 'fast'
            ? { thinking_level: normalizedThinkingLevel }
            : {}),
        },
        ...(googleSearchTool ? { tools: googleSearchTool } : {}),
      });
      image = extractInteractionImage(interaction);
    } else {
      console.log('[generateImageV3] ai.interactions is undefined (Vertex AI mode). Falling back to models.generateContent...');
      const response = await (ai.models as any).generateContent({
        model: modelId,
        contents: interactionInput,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio,
            ...(normalizedImageSize ? { imageSize: normalizedImageSize } : {}),
          },
          ...(normalizedThinkingLevel && model === 'fast'
            ? { thinkingConfig: { thinkingLevel: normalizedThinkingLevel.charAt(0).toUpperCase() + normalizedThinkingLevel.slice(1) } }
            : {}),
          ...(googleSearchTool ? { tools: googleSearchTool } : {}),
        }
      });

      const candidates = (response as any).candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API.');
      }
      const parts = candidates[0].content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error('No parts in response.');
      }
      const part = parts.find((p: any) => p.inlineData);
      if (!part || !part.inlineData) {
        throw new Error('No image data found in response.');
      }
      image = {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      };
    }
    
    const buffer = Buffer.from(image.data, 'base64');
    
    // Strict Thin Client adherence: Save directly to Cloud Storage
    const outputUri = await uploadToStorage(userId, buffer, extensionForMime(image.mimeType, 'jpg'), image.mimeType);
    
    await safeDbUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
      completedAt: new Date().toISOString()
    });
    outputCompleted = true;
    try {
      await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'SETTLED' });
    } catch (settlementError) {
      console.error('[generateImageV3] Output completed but reservation settlement needs reconciliation:', settlementError);
    }

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
    if (!outputCompleted) {
      try {
        await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'VOIDED' });
      } catch (releaseError) {
        console.error('[generateImageV3] Failed to release cost reservation:', releaseError);
      }
    }
    throw toGatewayError(error, 'Image generation failed');
  }
});

/**
 * generateVideoV3 - Routes to Veo 3.1 via the long-running generateVideos API.
 */
export const generateVideoV3 = onCall({ timeoutSeconds: 540, secrets: [geminiApiKey] , enforceAppCheck: false}, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  
  const parsed = GenerateVideoSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Invalid video payload. Base64 forbidden; use gs:// URIs for reference media.');

  const {
    prompt,
    referenceUri,
    firstFrameUri,
    lastFrameUri,
    sourceVideoUri,
    maskFrameUri,
    maskTrackUri,
    frameRange,
    referenceUris,
    aspectRatio,
    mode,
    model,
    resolution,
    durationSeconds,
    personGeneration,
    negativePrompt,
    seed,
    enhancePrompt,
    skipCostCheck,
    costEstimate,
    costReservationId,
    directorSettings: requestedDirectorSettings,
    parentId,
  } = parsed.data;

  // ISSUE-870: GenerateVideoSchema's aspectRatio enum includes 1:1/3:4/4:3,
  // but Veo only actually produces 16:9 or 9:16 — normalizeVideoAspectRatio()
  // used to silently coerce anything else to 16:9 with no warning. Reject
  // unsupported shapes here instead of lying about what was generated.
  if (aspectRatio !== '16:9' && aspectRatio !== '9:16') {
    throw new HttpsError(
      'invalid-argument',
      `Video generation only supports 16:9 or 9:16 aspect ratios. "${aspectRatio}" is not supported by the video model.`
    );
  }

  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;
  const normalizedResolution = normalizeVideoResolution(resolution, model);
  const hasFrameInput = !!firstFrameUri || !!referenceUri || !!lastFrameUri;
  const normalizedDuration = normalizeVideoDuration(durationSeconds, normalizedResolution, hasFrameInput);
  const modelId = resolveVideoModel(model);
  const effectiveMode = resolveVideoJobMode(mode);
  const resolvedSourceVideoUri = sourceVideoUri || firstFrameUri || referenceUri;
  const resolvedMaskUri = maskTrackUri || maskFrameUri;

  // ISSUE-869: check temporal-inpaint capability BEFORE loading/validating the
  // cost reservation. The reservation itself was already made client-side
  // before this call, so this can't prevent that charge — but it does avoid
  // an extra Firestore read for a request that's going to be rejected anyway,
  // and fails on the clearest, earliest signal available server-side.
  if (effectiveMode === 'temporal_inpaint') {
    if (!supportsTemporalInpaint(modelId)) {
      throw new HttpsError('failed-precondition', `Model ${modelId} does not support temporal inpaint yet.`);
    }
    if (!resolvedSourceVideoUri || !resolvedMaskUri || !frameRange) {
      throw new HttpsError('invalid-argument', 'Temporal inpaint requires sourceVideoUri, maskFrameUri or maskTrackUri, and frameRange.');
    }
  }

  const serverEstimatedCost = estimateVideoCost(normalizedDuration, modelId, effectiveMode);
  const reservation = !skipCostCheck && costReservationId
    ? await loadCostReservation(userId, costReservationId)
    : null;
  if (!skipCostCheck && !costReservationId) {
    throw new HttpsError('failed-precondition', 'Missing cost reservation. Reserve cost before submitting the job.');
  }
  if (!skipCostCheck && Math.abs((reservation?.estimatedCost ?? serverEstimatedCost) - serverEstimatedCost) > 0.01) {
    throw new HttpsError('failed-precondition', 'Cost reservation estimate does not match the current job estimate.');
  }

  const inputUris = [
    resolvedSourceVideoUri,
    firstFrameUri || referenceUri,
    lastFrameUri,
    ...(referenceUris ?? []),
    resolvedMaskUri,
  ].filter((uri): uri is string => !!uri);
  const maskUris = resolvedMaskUri ? [resolvedMaskUri] : [];
  const directorSettings = requestedDirectorSettings ?? {
    fps: 24,
    durationSeconds: normalizedDuration,
    totalFrames: normalizedDuration * 24,
    aspectRatio: normalizeVideoAspectRatio(aspectRatio),
    resolution: normalizedResolution,
    seed: normalizeVideoSeed(seed),
    firstFrameUri,
    lastFrameUri,
  };

  const jobRecord: VideoGenerationJobRecord = {
    id: jobId,
    schemaVersion: 1,
    userId,
    mode: effectiveMode,
    status: 'queued',
    type: 'video',
    prompt,
    aspectRatio,
    resolution,
    durationSeconds,
    negativePrompt,
    personGeneration,
    seed,
    enhancePrompt,
    firstFrameUri,
    lastFrameUri,
    referenceUri,
    referenceUris,
    progress: 0,
    payload: {
      prompt,
      sourceVideoUri: resolvedSourceVideoUri,
      maskFrameUri,
      maskTrackUri,
      frameRange,
      cameraPhysics: undefined,
    },
    directorSettings,
    provider: 'google-genai',
    model: modelId,
    costEstimate: reservation?.estimatedCost ?? serverEstimatedCost,
    costReservationId: skipCostCheck ? undefined : costReservationId,
    retryCount: 0,
    inputUris,
    tempUris: [],
    persistentUris: [...inputUris, ...maskUris],
    maskUris,
    maskMetadata: {
      mode: effectiveMode,
      sourceVideoUri: resolvedSourceVideoUri,
      maskFrameUri,
      maskTrackUri,
      frameRange,
      hasTemporalMask: effectiveMode === 'temporal_inpaint',
    },
    metadata: {
      model: modelId,
      aspectRatio: normalizeVideoAspectRatio(aspectRatio),
      resolution: normalizedResolution,
      durationSeconds: normalizedDuration,
      hasFirstFrame: !!firstFrameUri || !!referenceUri,
      hasLastFrame: !!lastFrameUri,
      referenceCount: referenceUris?.length ?? 0,
      mode: effectiveMode,
      hasTemporalMask: effectiveMode === 'temporal_inpaint',
      sourceVideoUri: resolvedSourceVideoUri,
      maskFrameUri,
      maskTrackUri,
      frameRange,
    },
    parentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  VideoJobDocumentSchema.parse(jobRecord);
  await syncVideoJobDocument(jobId, jobRecord);

  return { jobId };
});

export const cancelVideoJob = onCall({ timeoutSeconds: 30, enforceAppCheck: false }, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');

  const schema = z.object({ jobId: z.string().min(1) });
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'jobId is required.');

  const { jobId } = parsed.data;
  const existing = await loadTrackedVideoJob(jobId);
  if (!existing) {
    throw new HttpsError('not-found', 'Video job not found.');
  }
  if (existing.userId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'You do not own this video job.');
  }

  const currentStatus = String(existing.status || '').toLowerCase();
  if (['completed', 'failed', 'cancelled'].includes(currentStatus)) {
    return { jobId, status: currentStatus };
  }

  await syncVideoJobUpdate(jobId, {
    status: 'cancelled',
    error: 'Cancelled by user',
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { jobId, status: 'cancelled' };
});

/**
 * loadVideoInput - Download a gs:// video and return as an Interactions API input part.
 * [CONFIRM notebook] Videos >4MB: inline base64 vs URI handling.
 */
async function loadVideoInput(gsUri: string): Promise<{ type: 'video'; mime_type: string; data: string }> {
  const [bucket, ...pathParts] = gsUri.replace('gs://', '').split('/');
  const path = pathParts.join('/');
  const file = getStorage().bucket(bucket).file(path);
  const [buffer] = await file.download();
  return {
    type: 'video',
    mime_type: 'video/mp4',
    data: buffer.toString('base64'),
  };
}

/**
 * loadAudioInput - Download a gs:// audio file and return as an Interactions API input part.
 * [CONFIRM notebook] Audio/music reference for beat-sync/dubbing: input part type + field shape.
 */
async function loadAudioInput(gsUri: string): Promise<{ type: 'audio'; mime_type: string; data: string }> {
  const [bucket, ...pathParts] = gsUri.replace('gs://', '').split('/');
  const path = pathParts.join('/');
  const file = getStorage().bucket(bucket).file(path);
  const [buffer] = await file.download();
  return {
    type: 'audio',
    mime_type: 'audio/mpeg',
    data: buffer.toString('base64'),
  };
}

/**
 * pollInteraction - Poll an Omni Flash Interactions API call until ACTIVE.
 * [CONFIRM notebook] `GET /v1beta/interactions/{id}` vs SDK `interactions.get()`; output ready sync vs poll.
 */
async function pollInteraction(
  ai: GoogleGenAI,
  interaction: any,
  jobId: string,
): Promise<any> {
  let current = interaction;
  let pollCount = 0;

  while (pollCount < VIDEO_MAX_POLLS) {
    const status = current.status || current.state || '';
    if (status.toUpperCase() === 'ACTIVE' || status === 'COMPLETED') {
      return current;
    }

    if (status.toUpperCase() === 'FAILED' || status === 'CANCELLED') {
      throw new Error(`Interaction failed with status: ${status}`);
    }

    await sleep(VIDEO_POLL_INTERVAL_MS);
    pollCount++;

    const interactionId = current.id || current.name?.split('/').pop();
    if (!interactionId) {
      throw new Error('No interaction ID found for polling');
    }

    try {
      current = await (ai as any).interactions.get({ id: interactionId });
      const progress = Math.round((pollCount / VIDEO_MAX_POLLS) * 100);
      await safeDbUpdate(jobId, { progress });
    } catch (error) {
      console.error('[pollInteraction] Poll request failed:', error);
      throw new Error(`Failed to poll interaction: ${(error as Error).message}`);
    }
  }

  throw new HttpsError('deadline-exceeded', `Omni video generation timed out after ${pollCount * VIDEO_POLL_INTERVAL_MS / 1000}s`);
}

/**
 * fetchInteractionVideo - Extract the output video from an Omni Flash Interactions response.
 * [CONFIRM notebook] output_video shape (uri vs data); handling both SDK sync + URI-poll paths.
 */
async function fetchInteractionVideo(
  ai: GoogleGenAI,
  interaction: any,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const output = interaction.output_video || interaction.outputVideo;

  if (output?.data) {
    return {
      buffer: Buffer.from(output.data, 'base64'),
      mimeType: output.mime_type || output.mimeType || 'video/mp4',
    };
  }

  if (output?.uri) {
    const response = await fetch(output.uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch video from URI: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(buffer),
      mimeType: output.mime_type || output.mimeType || 'video/mp4',
    };
  }

  throw new MediaGenerationError('video', 'NO_VIDEO', `No output_video found in interaction response`);
}

/**
 * generateOmniRemixV3 - Gemini Omni Flash video-to-video remixing via Interactions API.
 *
 * Google has announced Gemini Omni Flash for video creation/editing in Gemini app,
 * Flow, and Shorts, with API access rolling out later. This callable is wired so
 * the UI can use the real backend path as soon as the API model ID is configured.
 */
export const generateOmniRemixV3 = onCall({ timeoutSeconds: 540, secrets: [geminiApiKey] , enforceAppCheck: false}, async (request) => {
  validateAppCheckV2(request);
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');

  const parsed = GenerateOmniRemixSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid Omni payload. Upload media to Cloud Storage and pass gs:// URIs only.');
  }

  const data = parsed.data;
  const userId = request.auth.uid;
  const jobId = getDb().collection('creative_jobs').doc().id;

  // ISSUE-872: no placeholder model — Omni is unavailable until configured.
  const modelId = resolveOmniFlashModel();
  if (!modelId) {
    throw new HttpsError(
      'failed-precondition',
      'Omni Remix is not available yet: no Omni model is configured on the server. No cost was reserved or charged.'
    );
  }
  const durationSeconds = Math.min(12, Math.max(4, data.durationSeconds));
  // ISSUE-774: exactly one ai.interactions.create() call happens below,
  // regardless of pipelineMode — there is no second Veo stage to charge Pro
  // pricing for. `pipelineMode` no longer affects cost; it's accepted as a
  // legacy/no-op field only (kept in the schema so any client with a stale
  // persisted 'hybrid-veo' selection doesn't fail payload validation).
  const serverEstimatedCost = estimateVideoCost(
    durationSeconds,
    VIDEO_MODEL_IDS.fast,
    data.pipelineMode,
  );
  const reservation = data.costReservationId
    ? await loadCostReservation(userId, data.costReservationId)
    : null;
  if (!data.costReservationId) {
    throw new HttpsError('failed-precondition', 'Missing cost reservation. Reserve cost before submitting the job.');
  }
  if (Math.abs((reservation?.estimatedCost ?? serverEstimatedCost) - serverEstimatedCost) > 0.01) {
    throw new HttpsError('failed-precondition', 'Cost reservation estimate does not match the current Omni job estimate.');
  }

  await safeDbSet(jobId, {
    id: jobId,
    userId,
    status: 'processing',
    type: 'omni-video',
    prompt: data.prompt,
    model: modelId,
    progress: 0,
    parentId: data.parentId,
    costEstimate: reservation?.estimatedCost ?? serverEstimatedCost,
    costReservationId: data.costReservationId,
    metadata: {
      pipelineMode: data.pipelineMode,
      hasAudioReference: !!data.audioUri,
      referenceCount: data.referenceUris?.length ?? 0,
      synthIdRequested: data.synthIdEnabled ?? true,
    },
    createdAt: new Date().toISOString()
  });

  try {
    const ai = getAiClient('video');

    if (!(ai as any).interactions) {
      throw new HttpsError('failed-precondition',
        'Omni Flash requires a Gemini API key (Interactions API unavailable in Vertex mode).');
    }

    const sourceVideo = await loadVideoInput(data.referenceVideoUri);
    const referenceImages = await loadReferenceImages(userId, { referenceUris: data.referenceUris });
    const audio = data.audioUri ? await loadAudioInput(data.audioUri) : undefined;

    const input = [
      { type: 'text' as const, text: buildOmniPrompt(data) },
      sourceVideo,
      ...referenceImages.map(r => ({ type: 'image' as const, mime_type: r.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic' | 'image/heif' | 'image/gif' | 'image/bmp' | 'image/tiff', data: r.data })),
      ...(audio ? [audio] : []),
    ];

    const durationSeconds = Math.min(12, Math.max(4, data.durationSeconds));
    const interaction = await (ai as any).interactions.create({
      model: modelId,
      input,
      response_modalities: ['video'],
      generation_config: {
        video_config: {
          tasks: 'edit',
          aspect_ratio: data.aspectRatio,
          duration_seconds: durationSeconds,
          resolution: '1080p',
        },
      },
      response_format: { delivery: 'uri' },
    });

    const finished = await pollInteraction(ai, interaction, jobId);
    const { buffer, mimeType } = await fetchInteractionVideo(ai, finished);
    const outputUri = await uploadToStorage(
      userId,
      buffer,
      extensionForMime(mimeType, 'mp4'),
      mimeType,
      {
        jobId,
        category: 'video',
        purpose: 'outputs',
      },
    );

    await safeDbUpdate(jobId, {
      status: 'completed',
      resultUri: outputUri,
      progress: 100,
      costEstimate: reservation?.estimatedCost ?? serverEstimatedCost,
      costReservationId: data.costReservationId,
      metadata: {
        model: modelId,
        pipelineMode: data.pipelineMode,
        aspectRatio: data.aspectRatio,
        durationSeconds,
        mimeType,
        hasAudioReference: !!data.audioUri,
        referenceCount: data.referenceUris?.length ?? 0,
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
export const generateAudioV3 = onCall({ timeoutSeconds: 300, secrets: [geminiApiKey] , enforceAppCheck: false}, async (request) => {
  validateAppCheckV2(request);
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
    const ai = getAiClient('audio');
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
