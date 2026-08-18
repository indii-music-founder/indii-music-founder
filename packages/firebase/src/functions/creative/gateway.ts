import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';
import { getVertexAIClient } from '../../lib/vertexClient';
import { parseStorageUri } from '../../lib/storageUri';
import { GenerateAudioSchema, GenerateImageSchema, GenerateVideoSchema, GenerateOmniRemixSchema } from '../../shared/creative';
import { normalizeVideoAspectRatio, normalizeVideoDuration, normalizePersonGeneration, normalizeVideoResolution, normalizeVideoSeed, type VeoPersonGeneration } from '../../shared/creativeNormalizers';
import { VideoJobDocumentSchema, type VideoJobDocument } from '../../shared/videoJob';
import { checkOperationBudget, finalizeOperationReservation, requireVerifiedCreativeUser } from '../billing/enforceOperationCost';
import { entitlementTierToBudgetTier, requireVerifiedServerEntitlement } from '../auth/entitlements';
import { arcjetKey } from '../../config/secrets';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from '../security/arcjet';
import { probeDurationSeconds } from './getMediaDuration';
import {
  adminVideoInputStorage,
  authorizeAndStageVideoInputs,
  createClaimedVideoJob,
  GATEWAY_VIDEO_WORKER_VERSION,
  type VerifiedVideoInput,
  type VideoInputRequest,
} from './videoJobAuthority';
import { cancelOwnedVideoJobTransactionally } from '../video/renderJobLifecycle';
import { createHash, randomUUID as cryptoRandomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import {
  FileState,
  GoogleGenAI,
  VideoGenerationReferenceType,
  type File as GeminiFile,
  type GenerateVideosOperation,
  type Image,
  type Video,
  type VideoGenerationReferenceImage,
} from "@google/genai";

export type MediaKind = 'image' | 'video' | 'audio';
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
  fast: FUNCTION_INTELLIGENCE_MODELS.IMAGE.FAST,
  pro: FUNCTION_INTELLIGENCE_MODELS.IMAGE.GENERATION,
  legacy: 'gemini-2.5-flash-image',
} as const;

// GA model IDs (ISSUE-867) — the *-preview IDs are deprecated April 2026.
const VIDEO_MODEL_IDS = {
  fast: 'veo-3.1-fast-generate-001',
  pro: 'veo-3.1-generate-001',
  lite: 'veo-3.1-lite-generate-001',
} as const;
type VideoModelId = typeof VIDEO_MODEL_IDS[keyof typeof VIDEO_MODEL_IDS];

const OMNI_FLASH_MODEL_ID = process.env.GEMINI_OMNI_FLASH_MODEL || FUNCTION_INTELLIGENCE_MODELS.VIDEO.OMNI;
const VIDEO_POLL_INTERVAL_MS = Number(process.env.VIDEO_POLL_INTERVAL_MS || '5000');
const VIDEO_MAX_POLLS = Number(process.env.VIDEO_MAX_POLLS || '90');
const MAX_OMNI_VIDEO_INPUT_BYTES = 256 * 1024 * 1024;
const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_INLINE_IMAGE_TOTAL_BYTES = 14 * 1024 * 1024;
const INLINE_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp',
  'image/tiff',
] as const;
type InlineImageMimeType = typeof INLINE_IMAGE_MIME_TYPES[number];

function isInlineImageMimeType(value: string): value is InlineImageMimeType {
  return (INLINE_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function getMediaVertexLocation(kind: MediaKind): string {
  switch (kind) {
    case 'image':
      return process.env.VERTEX_IMAGE_LOCATION || 'global';
    case 'video':
      return process.env.VERTEX_VIDEO_LOCATION || 'us-central1';
    case 'audio':
      return process.env.VERTEX_AUDIO_LOCATION || 'global';
  }
}

export function getOmniVertexLocation(): string {
  return process.env.VERTEX_OMNI_LOCATION || 'global';
}

/**
 * Media provider policy. Creative generation is backend-only and always uses
 * Vertex AI with Application Default Credentials. The API-key path is not a
 * permitted fallback: it would create a second billing and security boundary.
 */
type MediaProvider = 'vertex';

export function getMediaProvider(): MediaProvider {
  return 'vertex';
}

function getAiClient(kind: MediaKind): GoogleGenAI {
  // getVertexAIClient resolves the Cloud Functions project from ADC-safe
  // server environment variables (and a server default for local tests). Do
  // not read VITE_* values here: they are frontend build configuration, not
  // backend credentials or authority.
  return getVertexAIClient(undefined, getMediaVertexLocation(kind));
}

/**
 * Omni Remix is allowed to use only the same ADC-authenticated Vertex client
 * as every other creative capability. Uses its own location (default global)
 * and does not inherit the Veo location.
 */
function getOmniAiClient(): GoogleGenAI {
  return getVertexAIClient(undefined, getOmniVertexLocation());
}

// Defer firestore and storage initialization until first use (for test compatibility)
function getDb() {
  return admin.firestore();
}

function getStorage() {
  return admin.storage();
}

/**
 * Establishes the server-owned admission chain for every spend-bearing
 * creative callable. Auth and verified-email state are signed by Firebase;
 * entitlement is loaded by the backend; Arcjet then sees only that resolved
 * policy and the raw request. No client tier, rate-limit class, or provider
 * credential is accepted as input.
 */
async function requireCreativeGatewayAdmission(
  request: CallableRequest<unknown>,
  operation: string,
): Promise<{ userId: string; entitlement: Awaited<ReturnType<typeof requireVerifiedServerEntitlement>> }> {
  validateAppCheckV2(request);
  const userId = requireVerifiedCreativeUser(request.auth);
  const entitlement = await requireVerifiedServerEntitlement(userId);
  const protection = await protectAuthenticatedApiRequest(request.rawRequest, {
    userId,
    policy: policyClassForServerEntitlement({
      tier: entitlement.tier,
      isAdmin: request.auth?.token.admin === true,
    }),
    operationId: `${operation}:${crypto.randomUUID()}`,
  });
  if (!protection.allowed) {
    const code = protection.status === 429
      ? 'resource-exhausted'
      : protection.status === 403
        ? 'permission-denied'
        : 'unavailable';
    throw new HttpsError(code, protection.message, {
      code: protection.code,
      ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
    });
  }
  return { userId, entitlement };
}

const creativeGatewayCallableOptions = {
  secrets: [arcjetKey],
  enforceAppCheck: false,
};

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

async function deleteStorageOutputs(uris: string[]): Promise<void> {
  await Promise.allSettled(uris.map(async uri => {
    const { bucket, path } = parseStorageUri(uri);
    await getStorage().bucket(bucket).file(path).delete({ ignoreNotFound: true });
  }));
}

export async function safeDbSet(
  jobId: string,
  data: Record<string, unknown>,
  collection: string = 'creative_jobs',
) {
  try {
    // ISSUE-1365/1368: Firestore rejects documents containing `undefined`
    // values ("Cannot use 'undefined' as a Firestore value"). The image job
    // record carries optional `sessionId` (absent on agent-driven Boardroom
    // generations) and the video record has optional staged fields plus an
    // explicit `cameraPhysics: undefined` — so every such write failed and
    // was silently discarded before 961cfac28, leaving the Boardroom with no
    // record of successful generations. Strip undefined values (gateway
    // records are plain JSON — no FieldValue sentinels) so a missing
    // optional field can never invalidate the write.
    const clean = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    await getDb().collection(collection).doc(jobId).set(clean);
  } catch (error) {
    // ISSUE-1365: this catch previously discarded the error entirely, so the
    // gateway logged only collection+jobId and the actual cause (which was
    // hiding weeks of unpersisted creative_jobs — the collection had no
    // documents newer than June while generations succeeded through August)
    // was invisible. Log the error name/code/message — never the payload.
    const err = error as { code?: string; message?: string };
    console.error('[creativeGateway] Firestore set failed (non-blocking)', {
      collection,
      jobId,
      code: err?.code ?? (error instanceof Error ? error.name : typeof error),
      reason: err?.message ?? String(error),
    });
  }
}

export async function safeDbUpdate(
  jobId: string,
  data: Record<string, unknown>,
  collection: string = 'creative_jobs',
) {
  try {
    // ISSUE-1365/1368: same undefined-strip as safeDbSet — an update carrying
    // an undefined field is also an invalid Firestore document.
    const clean = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    await getDb().collection(collection).doc(jobId).update(clean);
  } catch (error) {
    // ISSUE-1365: same non-swallowing fix as safeDbSet — the underlying
    // Firestore failure must be visible in logs to be diagnosable.
    const err = error as { code?: string; message?: string };
    console.error('[creativeGateway] Firestore update failed (non-blocking)', {
      collection,
      jobId,
      code: err?.code ?? (error instanceof Error ? error.name : typeof error),
      reason: err?.message ?? String(error),
    });
  }
}

async function syncVideoJobUpdate(jobId: string, data: Record<string, unknown>) {
  await getDb().collection('videoJobs').doc(jobId).update(data);
  await safeDbUpdate(jobId, data, 'creative_jobs');
}

/**
 * ISSUE-1365: record a completed generation in the top-level `usage`
 * collection — the same record shape `trackUsage` writes — so the settings
 * usage meters (images used / video minutes / tokens) reflect real
 * generations. Previously nothing in the gateway invoked usage accounting,
 * so the meters always showed 0 despite successful generation, and the
 * collection had no records newer than June. Server-side write, fire and
 * forget (failures must never fail a successful generation); logged loudly
 * on failure so accounting gaps stay visible.
 */
export async function recordUsage(
  userId: string,
  type: 'image' | 'video' | 'chat_tokens',
  amount: number,
  project?: string,
) {
  if (!userId || amount <= 0) return;
  const recordId = `${type}_${Date.now()}_${jobIdSuffix()}`;
  try {
    await getDb().collection('usage').doc(recordId).set({
      id: recordId,
      userId,
      subscriptionId: 'gateway',
      project: project || 'default',
      type,
      amount,
      timestamp: Date.now(),
    });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.error('[creativeGateway] Usage record failed (non-blocking)', {
      userId,
      type,
      amount,
      code: err?.code ?? (error instanceof Error ? error.name : typeof error),
      reason: err?.message ?? String(error),
    });
  }
}

function jobIdSuffix(): string {
  return cryptoRandomUUID().slice(0, 8);
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
 * Gemini Omni Flash entered public preview on 2026-06-30. Keep an environment
 * override for rollout testing, while defaulting to the documented model ID.
 */
function resolveOmniFlashModel(): string {
  return OMNI_FLASH_MODEL_ID;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function loadReferenceImage(userId: string, uri: string): Promise<{ mimeType: InlineImageMimeType; data: string; byteLength: number }> {
  const { bucket, path } = parseGsUri(uri);
  const defaultBucket = getStorage().bucket().name;
  if (bucket !== defaultBucket) {
    throw new HttpsError('permission-denied', 'Reference media must live in this project storage bucket.');
  }
  if (!isOwnerScopedCreativePath(userId, path)) {
    throw new HttpsError('permission-denied', 'Reference media must live in your creative storage namespace.');
  }

  const file = getStorage().bucket(bucket).file(path);
  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || 'image/png';
  if (!isInlineImageMimeType(contentType)) {
    throw new HttpsError('invalid-argument', `Reference media must use a supported raster image format, got ${contentType || 'unknown content type'}.`);
  }
  const size = Number(metadata.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new HttpsError('failed-precondition', 'Reference image is empty or has invalid metadata.');
  }
  if (size > MAX_INLINE_IMAGE_BYTES) {
    throw new HttpsError('resource-exhausted', 'Reference image exceeds the 10 MiB inline-media limit.');
  }

  const [buffer] = await file.download();
  if (buffer.length !== size) {
    throw new HttpsError('failed-precondition', 'Reference image size does not match its Storage metadata.');
  }
  return { mimeType: contentType, data: buffer.toString('base64'), byteLength: buffer.length };
}

async function loadReferenceImages(userId: string, requestData: { referenceUri?: string; referenceUris?: string[] }): Promise<{ mimeType: InlineImageMimeType; data: string; byteLength: number }[]> {
  const uris = [
    requestData.referenceUri,
    ...(requestData.referenceUris ?? []),
  ].filter((uri, index, array): uri is string => !!uri && array.indexOf(uri) === index);

  const images = await Promise.all(uris.map(uri => loadReferenceImage(userId, uri)));
  const totalBytes = images.reduce((sum, image) => sum + image.byteLength, 0);
  if (totalBytes > MAX_INLINE_IMAGE_TOTAL_BYTES) {
    throw new HttpsError('resource-exhausted', 'Combined reference images exceed the 14 MiB inline-media limit.');
  }
  return images;
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

function extractInteractionMetadata(response: unknown): { textNarration?: string; thoughtSummary?: string } {
  const typed = response as {
    outputs?: Array<Record<string, unknown>>;
    steps?: Array<Record<string, unknown>>;
    thought_summary?: string;
  };
  const narration: string[] = [];
  const thoughts: string[] = typed.thought_summary ? [typed.thought_summary] : [];

  const collectContent = (entry: Record<string, unknown>, target: string[]) => {
    if (typeof entry.text === 'string') target.push(entry.text);
    if (typeof entry.summary === 'string') target.push(entry.summary);
    for (const part of (entry.parts as Array<Record<string, unknown>> | undefined) ?? []) {
      if (typeof part.text === 'string') target.push(part.text);
      if (typeof part.summary === 'string') target.push(part.summary);
    }
    for (const part of (entry.content as Array<Record<string, unknown>> | undefined) ?? []) {
      if (typeof part.text === 'string') target.push(part.text);
      if (typeof part.summary === 'string') target.push(part.summary);
    }
  };

  for (const output of typed.outputs ?? []) {
    collectContent(output, output.type === 'thought' ? thoughts : narration);
  }
  for (const step of typed.steps ?? []) {
    collectContent(step, step.type === 'thought' ? thoughts : narration);
  }

  return {
    textNarration: narration.filter(Boolean).join('\n\n') || undefined,
    thoughtSummary: thoughts.filter(Boolean).join('\n\n') || undefined,
  };
}

type OmniVideoRequest = z.infer<typeof GenerateOmniRemixSchema>;
type OmniVideoTask = NonNullable<OmniVideoRequest['task']>;

function resolveOmniTask(data: OmniVideoRequest): OmniVideoTask {
  if (data.task) return data.task;
  if (data.previousInteractionId || data.referenceVideoUri) return 'edit';
  if (data.firstFrameUri) return 'image_to_video';
  if (data.referenceUris?.length) return 'reference_to_video';
  return 'text_to_video';
}

function buildOmniPrompt(data: OmniVideoRequest, task: OmniVideoTask): string {
  const imageRolePrefix = [
    ...(data.firstFrameUri ? ['[# Sources <FIRST_FRAME>@Image1]'] : []),
    ...((data.referenceUris ?? []).length > 0
      ? [`[# References ${(data.referenceUris ?? []).map((_, index) => `<IMAGE_REF_${index}>@Image${index + (data.firstFrameUri ? 2 : 1)}`).join(' ')}]`]
      : []),
  ].join(' ');
  const storyboardDirectives = [...(data.storyboard ?? [])]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((frame, index, frames) => {
      const nextTimestamp = frames[index + 1]?.timestamp ?? data.durationSeconds;
      return `[${frame.timestamp}-${nextTimestamp}s] ${frame.prompt}`;
    });
  const directives = [
    task !== 'edit' ? `Target duration: approximately ${data.durationSeconds} seconds.` : undefined,
    data.posePreservation !== undefined
      ? `Preserve the source pose and movement continuity at roughly ${Math.round(data.posePreservation * 100)}% strength.`
      : undefined,
    data.beatPulse !== undefined
      ? `Match visual motion to the implied beat at roughly ${Math.round(data.beatPulse * 100)}% intensity.`
      : undefined,
    data.characterXRay ? 'Maintain performer anatomy, posture, and identity consistently.' : undefined,
    data.activePosePreset ? `Use ${data.activePosePreset.replace(/_/g, ' ')} as a motion reference.` : undefined,
    data.lyricsText ? `Kinetic lyrics: "${data.lyricsText}" using ${data.typographyStyle || 'minimal-infographic'} typography` : undefined,
    data.visualizerColor ? `Visualizer color cue: ${data.visualizerColor}` : undefined,
    data.firstFrameUri ? 'Use Image1 as the starting frame.' : undefined,
    (data.referenceUris ?? []).length > 0
      ? 'Use the tagged images as subject/style references, not as literal starting frames unless explicitly tagged.'
      : undefined,
    task === 'edit' ? 'Keep everything else the same.' : undefined,
  ].filter(Boolean);

  return [
    imageRolePrefix || undefined,
    data.prompt.trim(),
    ...storyboardDirectives,
    ...directives,
  ].filter(Boolean).join('\n');
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
    // Provider detail stays in this in-memory error only. Persistence and the
    // callable response use the classified public message below.
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

  console.error(`[Gateway Debug] Raw Error Details for ${context}:`, { error, combined });

  let code: GatewayErrorCode = 'internal';
  let publicMessage = 'The generation service could not complete this request. Please try again.';

  if (
    lower.includes('prepayment credits are depleted') ||
    lower.includes('billing#prepay') ||
    (lower.includes('ai studio') && lower.includes('billing'))
  ) {
    code = 'resource-exhausted';
    publicMessage = 'The Vertex AI billing quota for this project is unavailable. Please try again later.';
  }
  else if (status === 401 || status === 403 || lower.includes('invalid_grant') || lower.includes('api key') || lower.includes('permission') || lower.includes('auth')) {
    code = 'permission-denied';
    publicMessage = 'The generation service is not currently authorized for this request. If developing locally, run: gcloud auth application-default login';
  }
  else if (status === 400 || lower.includes('invalid') || lower.includes('bad request') || lower.includes('safety') || lower.includes('policy') || lower.includes('blocked') || lower.includes('unsupported') || lower.includes('not supported')) {
    code = 'invalid-argument';
    publicMessage = 'The generation request was rejected. Review the inputs and try again.';
  }
  else if (status === 404 || lower.includes('not found') || lower.includes('not available')) {
    code = 'failed-precondition';
    publicMessage = 'The requested generation capability is not available for this project.';
  }
  else if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    code = 'resource-exhausted';
    publicMessage = 'The generation service is temporarily at capacity. Please retry shortly.';
  }
  else if (status === 503 || status === 504 || lower.includes('timeout') || lower.includes('deadline') || lower.includes('overloaded')) {
    code = 'deadline-exceeded';
    publicMessage = 'The generation service timed out. Please retry shortly.';
  }
  else if (status === 500 || lower.includes('internal error') || lower.includes('internal server error')) {
    code = 'unavailable';
    publicMessage = 'The generation service is temporarily unavailable. Please retry shortly.';
  }

  if (lower.includes('is not configured') || lower.includes('api key unavailable') || lower.includes('model not found') || lower.includes('model is not available')) {
      code = 'failed-precondition';
  }

  // Do not return raw provider codes/statuses. They are not actionable for an
  // artist and can disclose provider-internal state or rollout details.
  return new HttpsError(code, `${context}: ${publicMessage}`);
}

function recordGatewayFailure(operation: string, jobId: string, error: unknown): HttpsError {
  const gatewayError = toGatewayError(error, `${operation} failed`);
  console.error('[creativeGateway] Generation failed', {
    operation,
    jobId,
    code: gatewayError.code,
  });
  return gatewayError;
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

async function downloadGeneratedVideo(ai: GoogleGenAI, video: Video, jobId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (video.videoBytes) {
    return { buffer: Buffer.from(video.videoBytes, 'base64'), mimeType: video.mimeType || 'video/mp4' };
  }

  const downloadPath = join(tmpdir(), `${jobId}_${Date.now()}.mp4`);
  try {
    await ai.files.download({ file: video, downloadPath });
    return { buffer: await readFile(downloadPath), mimeType: video.mimeType || 'video/mp4' };
  } catch (downloadError) {
    throw new Error(`Vertex video download failed: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
  } finally {
    await rm(downloadPath, { force: true }).catch(() => undefined);
  }
}

export type VideoGenerationJobRecord = VideoJobDocument & {
  type: 'video';
  workerVersion?: typeof GATEWAY_VIDEO_WORKER_VERSION;
  prompt: string;
  aspectRatio?: z.infer<typeof GenerateVideoSchema>['aspectRatio'];
  firstFrameUri?: string;
  lastFrameUri?: string;
  referenceUri?: string;
  referenceUris?: string[];
  resolution?: z.infer<typeof GenerateVideoSchema>['resolution'];
  durationSeconds?: number;
  negativePrompt?: string;
  personGeneration?: VeoPersonGeneration;
  seed?: z.infer<typeof GenerateVideoSchema>['seed'];
  enhancePrompt?: boolean;
  parentId?: string;
  verifiedInputs?: VerifiedVideoInput[];
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

  let providerSubmissionAttempted = false;
  try {
    const ai = getAiClient('video');
    const image = toImage(job.firstFrameUri || job.referenceUri);
    const referenceImages = toReferenceImages(job.referenceUris);
    const personGeneration = normalizePersonGeneration(job.personGeneration);
    const config: Record<string, unknown> = {
      numberOfVideos: 1,
      aspectRatio: normalizeVideoAspectRatio(job.aspectRatio ?? '16:9'),
      durationSeconds: normalizedDuration,
      resolution: normalizedResolution,
      ...(job.negativePrompt ? { negativePrompt: job.negativePrompt } : {}),
      ...(normalizeVideoSeed(job.seed) !== undefined ? { seed: normalizeVideoSeed(job.seed) } : {}),
      ...(job.enhancePrompt !== undefined ? { enhancePrompt: job.enhancePrompt } : {}),
      ...(personGeneration ? { personGeneration } : {}),
      ...(job.lastFrameUri ? { lastFrame: toImage(job.lastFrameUri) } : {}),
      ...(referenceImages ? { referenceImages } : {}),
    };
    if (effectiveMode === 'temporal_inpaint' && sourceVideoUri && maskUri) {
      config.sourceVideo = { uri: sourceVideoUri, mimeType: 'video/mp4' };
      config.maskVideo = { uri: maskUri, mimeType: 'image/png' };
      config.frameRange = job.payload?.frameRange;
    }

    providerSubmissionAttempted = true;
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
      status: 'processing',
      providerSubmissionState: 'succeeded_pending_settlement',
      resultUri: outputUri,
      updatedAt: new Date().toISOString(),
    });
    if (job.costReservationId) {
      await finalizeOperationReservation({
        userId: job.userId,
        operationId: job.costReservationId,
        outcome: 'SETTLED',
        jobId,
      });
    }

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
    const gatewayError = recordGatewayFailure('Video generation', jobId, error);
    const isCancelled = error instanceof HttpsError
      ? error.code === 'cancelled'
      : false;
    let reconciliationRequired = providerSubmissionAttempted;
    if (!providerSubmissionAttempted && job.costReservationId) {
      try {
        await finalizeOperationReservation({
          userId: job.userId,
          operationId: job.costReservationId,
          outcome: 'VOIDED',
          jobId,
        });
        reconciliationRequired = false;
      } catch {
        reconciliationRequired = true;
      }
    }
    await syncVideoJobUpdate(jobId, {
      status: isCancelled ? 'cancelled' : 'failed',
      error: gatewayError.message,
      errorCode: gatewayError.code,
      providerSubmissionState: providerSubmissionAttempted ? 'ambiguous_or_failed' : 'not_submitted',
      reconciliationRequired,
      ...(isCancelled ? { cancelledAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    });
    throw gatewayError;
  }
}

/**
 * generateImageV3 - Routes to Gemini 3 image models via Interactions API.
 */
export const generateImageV3 = onCall({ ...creativeGatewayCallableOptions, timeoutSeconds: 120, memory: '1GiB' }, async (request) => {
  const { userId } = await requireCreativeGatewayAdmission(request, 'generate-image');
  
  const parsed = GenerateImageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Payload validation failed. Ensure no base64 is passed and only gs:// URIs are used.');
  }

  const {
    prompt,
    sessionId,
    aspectRatio,
    model,
    imageSize,
    count,
    thinkingLevel,
    includeThoughts,
    responseFormat,
    useGoogleSearch,
    useGrounding,
    useImageSearch,
    costReservationId,
  } = parsed.data;
  const jobId = getDb().collection('creative_jobs').doc().id;
  const reservation = await loadCostReservation(userId, costReservationId, 'image');
  const minimumReservedCost = count * 0.04;
  if (reservation.estimatedCost + 0.0001 < minimumReservedCost) {
    throw new HttpsError(
      'failed-precondition',
      `Cost reservation covers fewer than ${count} requested images.`,
    );
  }
  let outputCompleted = false;
  const outputUris: string[] = [];
  // Record the selected backend, not credentials or provider response data.
  // The explicit production deployment value makes this durable evidence of
  // postpaid Vertex routing for image jobs.
  const mediaProvider = getMediaProvider();

  try {
    await safeDbSet(jobId, {
      id: jobId,
      userId,
      sessionId,
      status: 'processing',
      type: 'image',
      provider: mediaProvider,
      prompt,
      requestedCount: count,
      costReservationId,
      createdAt: new Date().toISOString()
    });
    const ai = getAiClient('image');
    const imageAi = ai as unknown as {
      interactions?: { create: (data: Record<string, unknown>) => Promise<unknown> };
      models: { generateContent: (data: Record<string, unknown>) => Promise<unknown> };
    };
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
    if (useImageSearch) {
      throw new HttpsError(
        'failed-precondition',
        'Image Search grounding is not supported by the current image generation models.'
      );
    }
    if ((useGoogleSearch || useGrounding) && model === 'fast') {
      throw new HttpsError(
        'failed-precondition',
        'Search grounding is not supported on the Fast image generation model. Switch to Pro tier for search grounding.'
      );
    }

    const searchTypes: Array<'web_search' | 'image_search' | 'enterprise_web_search'> = ['web_search'];
    const googleSearchTool = (useGoogleSearch || useGrounding) && model === 'pro'
      ? [{
          type: 'google_search' as const,
          search_types: searchTypes,
        }]
      : undefined;

    const generatedImages: Array<{ data: string; mimeType: string }> = [];
    const narrationParts: string[] = [];
    const thoughtSummaries: string[] = [];

    for (let imageIndex = 0; imageIndex < count; imageIndex += 1) {
      let image: { data: string; mimeType: string } | undefined;

      let usedInteractions = false;

      if (imageAi.interactions) {
        try {
            const interaction = await imageAi.interactions.create({
              model: modelId,
              input: interactionInput,
              response_modalities: responseFormat === 'image_and_text' ? ['text', 'image'] : ['image'],
              generation_config: {
                image_config: {
                  aspect_ratio: aspectRatio,
                  ...(normalizedImageSize ? { image_size: normalizedImageSize } : {}),
                },
                ...(normalizedThinkingLevel && model === 'fast'
                  ? { thinking_level: normalizedThinkingLevel }
                  : {}),
                ...(includeThoughts ? { thinking_summaries: 'auto' } : {}),
              },
              ...(googleSearchTool ? { tools: googleSearchTool } : {}),
            });
            image = extractInteractionImage(interaction);
            const metadata = extractInteractionMetadata(interaction);
            if (metadata.textNarration) narrationParts.push(metadata.textNarration);
            if (metadata.thoughtSummary) thoughtSummaries.push(metadata.thoughtSummary);
            usedInteractions = true;
        } catch (e: unknown) {
            if (e instanceof Error && e.message.includes('Unsupported model interaction')) {
                console.log(`[generateImageV3] interactions.create unsupported for ${modelId}, falling back to models.generateContent`);
            } else {
                throw e;
            }
        }
      } 
      
      if (!usedInteractions) {
        console.log('[generateImageV3] Falling back to models.generateContent...');
        const thinkingConfig = {
          ...(normalizedThinkingLevel && model === 'fast'
            ? { thinkingLevel: normalizedThinkingLevel.charAt(0).toUpperCase() + normalizedThinkingLevel.slice(1) }
            : {}),
          ...(includeThoughts ? { includeThoughts: true } : {}),
        };
        const response = await imageAi.models.generateContent({
          model: modelId,
          contents: interactionInput,
          config: {
            responseModalities: responseFormat === 'image_and_text' ? ['TEXT', 'IMAGE'] : ['IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              ...(normalizedImageSize ? { imageSize: normalizedImageSize } : {}),
            },
            ...(Object.keys(thinkingConfig).length > 0 ? { thinkingConfig } : {}),
            ...(googleSearchTool ? { tools: googleSearchTool } : {}),
          }
        });

        const candidates = (response as GeminiContentResponse).candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('No candidates returned from Gemini API.');
        }
        const parts = candidates[0].content?.parts;
        if (!parts || parts.length === 0) {
          throw new Error('No parts in response.');
        }
        const part = parts.find(candidatePart => candidatePart.inlineData?.data && !candidatePart.thought);
        if (!part?.inlineData?.data) {
          throw new Error('No image data found in response.');
        }
        image = {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        };
        const textNarration = parts
          .filter(candidatePart => candidatePart.text && !candidatePart.thought)
          .map(candidatePart => candidatePart.text)
          .join('\n\n');
        const thoughtSummary = parts
          .filter(candidatePart => candidatePart.text && candidatePart.thought)
          .map(candidatePart => candidatePart.text)
          .join('\n\n');
        if (textNarration) narrationParts.push(textNarration);
        if (thoughtSummary) thoughtSummaries.push(thoughtSummary);
      }
      if (!image) {
        throw new Error('Image generation failed to produce output.');
      }
      generatedImages.push(image);
    }

    for (const image of generatedImages) {
      const buffer = Buffer.from(image.data, 'base64');
      outputUris.push(await uploadToStorage(
        userId,
        buffer,
        extensionForMime(image.mimeType, 'jpg'),
        image.mimeType,
      ));
    }
    
    await safeDbUpdate(jobId, {
      status: 'completed',
      provider: mediaProvider,
      resultUri: outputUris[0],
      resultUris: outputUris,
      outputCount: outputUris.length,
      ...(narrationParts.length > 0 ? { textNarration: narrationParts.join('\n\n') } : {}),
      ...(thoughtSummaries.length > 0 ? { thoughtSummary: thoughtSummaries.join('\n\n') } : {}),
      completedAt: new Date().toISOString()
    });
    outputCompleted = true;
    console.info('[generateImageV3] Image generation completed', {
      jobId,
      provider: mediaProvider,
      outputCount: outputUris.length,
    });
    // ISSUE-1365: usage accounting — settings meters must reflect real
    // generations. Each output image counts as one usage record.
    await recordUsage(userId, 'image', outputUris.length, sessionId);
    try {
      await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'SETTLED' });
    } catch {
      console.error('[generateImageV3] Output completed but reservation settlement needs reconciliation', { jobId });
    }

    return {
      jobId,
      resultUri: outputUris[0],
      resultUris: outputUris,
      ...(narrationParts.length > 0 ? { textNarration: narrationParts.join('\n\n') } : {}),
      ...(thoughtSummaries.length > 0 ? { thoughtSummary: thoughtSummaries.join('\n\n') } : {}),
    };
  } catch (error: unknown) {
    const gatewayError = recordGatewayFailure('Image generation', jobId, error);

    if (!outputCompleted && outputUris.length > 0) {
      await deleteStorageOutputs(outputUris);
    }
    await safeDbUpdate(jobId, {
      status: 'failed',
      error: gatewayError.message,
      errorCode: gatewayError.code,
    });
    if (!outputCompleted) {
      try {
        await finalizeOperationReservation({ userId, operationId: costReservationId, outcome: 'VOIDED' });
      } catch {
        console.error('[generateImageV3] Failed to release cost reservation', { jobId });
      }
    }
    throw gatewayError;
  }
});

/**
 * generateVideoV3 - Routes to Veo 3.1 via the long-running generateVideos API.
 */
export function describeVideoPayloadValidationFailure(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : 'request'}: ${issue.message}`)
    .join('; ');
}

export const generateVideoV3 = onCall({ ...creativeGatewayCallableOptions, timeoutSeconds: 540 }, async (request) => {
  const { userId } = await requireCreativeGatewayAdmission(request, 'generate-video');
  
  const parsed = GenerateVideoSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid video payload: ${describeVideoPayloadValidationFailure(parsed.error)}`);
  }

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
    costEstimate: _costEstimate,
    costReservationId,
    directorSettings: requestedDirectorSettings,
    parentId,
    inputManifest,
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

  const isLiteModel = resolveVideoModel(model) === VIDEO_MODEL_IDS.lite;
  const hasReferenceImages = (referenceUris && referenceUris.length > 0) || !!referenceUri;
  if (isLiteModel && hasReferenceImages) {
    throw new HttpsError(
      'failed-precondition',
      'Reference images are not supported with the Veo Lite model tier. Use Fast or Pro tier for reference image support.'
    );
  }

  // Resolve the public request union into Veo's typed provider contract before
  // any reservation lookup, input staging, or job creation. Frame inputs never
  // weaken an explicit No People request.
  const normalizedPersonGeneration = normalizePersonGeneration(personGeneration);

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
  const reservation = await loadCostReservation(userId, costReservationId, 'video');
  if (reservation.estimatedCost + 0.0001 < serverEstimatedCost) {
    console.warn(`[generateVideoV3] Job cost reservation (${reservation.estimatedCost}) is lower than the server estimated cost (${serverEstimatedCost}).`);
  }

  const requestedInputs: VideoInputRequest[] = [
    ...(sourceVideoUri ? [{
      role: 'source_video',
      uri: sourceVideoUri,
      kind: 'video' as const,
    }] : []),
    ...((firstFrameUri || referenceUri) ? [{
      role: 'first_frame',
      uri: firstFrameUri || referenceUri!,
      kind: 'image' as const,
    }] : []),
    ...(lastFrameUri ? [{ role: 'last_frame', uri: lastFrameUri, kind: 'image' as const }] : []),
    ...(referenceUris ?? []).map((uri, index) => ({ role: `reference_${index}`, uri, kind: 'image' as const })),
    ...(resolvedMaskUri ? [{
      role: 'mask',
      uri: resolvedMaskUri,
      kind: maskTrackUri ? 'mask' as const : 'image' as const,
    }] : []),
    ...(inputManifest ?? []).map(input => ({
      role: `manifest_${input.role}`,
      uri: input.uri,
      kind: 'image' as const,
    })),
  ];
  const verifiedInputs = await authorizeAndStageVideoInputs(
    userId,
    jobId,
    requestedInputs,
    adminVideoInputStorage(getStorage()),
  );
  const stagedByOriginal = new Map(verifiedInputs.map(input => [input.originalUri, input.stagedUri]));
  const staged = (uri: string | undefined): string | undefined => uri ? stagedByOriginal.get(uri) : undefined;
  const stagedFirstFrameUri = staged(firstFrameUri || referenceUri);
  const stagedLastFrameUri = staged(lastFrameUri);
  const stagedSourceVideoUri = staged(resolvedSourceVideoUri);
  const stagedMaskUri = staged(resolvedMaskUri);
  const stagedReferenceUris = (referenceUris ?? []).map(uri => staged(uri)).filter((uri): uri is string => !!uri);
  const stagedInputManifest = inputManifest?.map(input => ({
    ...input,
    uri: staged(input.uri)!,
  }));
  const inputUris = verifiedInputs.map(input => input.stagedUri);
  const maskUris = stagedMaskUri ? [stagedMaskUri] : [];
  const directorFps = requestedDirectorSettings?.fps ?? 24;
  const directorSettings = {
    fps: directorFps,
    durationSeconds: normalizedDuration,
    totalFrames: normalizedDuration * directorFps,
    aspectRatio: normalizeVideoAspectRatio(aspectRatio),
    resolution: normalizedResolution,
    ...(normalizeVideoSeed(seed ?? requestedDirectorSettings?.seed) !== undefined
      ? { seed: normalizeVideoSeed(seed ?? requestedDirectorSettings?.seed) }
      : {}),
    ...(requestedDirectorSettings?.cameraPhysics
      ? { cameraPhysics: requestedDirectorSettings.cameraPhysics }
      : {}),
    ...(stagedFirstFrameUri ? { firstFrameUri: stagedFirstFrameUri } : {}),
    ...(stagedLastFrameUri ? { lastFrameUri: stagedLastFrameUri } : {}),
    ...(requestedDirectorSettings?.cameraMovement
      ? { cameraMovement: requestedDirectorSettings.cameraMovement }
      : {}),
    ...(requestedDirectorSettings?.motionStrength !== undefined
      ? { motionStrength: requestedDirectorSettings.motionStrength }
      : {}),
  };

  const jobRecord: VideoGenerationJobRecord = {
    id: jobId,
    schemaVersion: 1,
    workerVersion: GATEWAY_VIDEO_WORKER_VERSION,
    userId,
    mode: effectiveMode,
    status: 'queued',
    type: 'video',
    prompt,
    aspectRatio,
    resolution,
    durationSeconds,
    negativePrompt,
    personGeneration: normalizedPersonGeneration,
    seed,
    enhancePrompt,
    firstFrameUri: stagedFirstFrameUri,
    lastFrameUri: stagedLastFrameUri,
    referenceUri: staged(referenceUri),
    referenceUris: stagedReferenceUris,
    progress: 0,
    payload: {
      prompt,
      sourceVideoUri: stagedSourceVideoUri,
      maskFrameUri: staged(maskFrameUri),
      maskTrackUri: staged(maskTrackUri),
      frameRange,
      inputManifest: stagedInputManifest,
      cameraPhysics: undefined,
    },
    directorSettings,
    provider: getMediaProvider(),
    model: modelId,
    costEstimate: serverEstimatedCost,
    costReservationId,
    retryCount: 0,
    inputUris,
    tempUris: [],
    persistentUris: [...inputUris, ...maskUris],
    maskUris,
    verifiedInputs,
    maskMetadata: {
      mode: effectiveMode,
      sourceVideoUri: stagedSourceVideoUri,
      maskFrameUri: staged(maskFrameUri),
      maskTrackUri: staged(maskTrackUri),
      frameRange,
      hasTemporalMask: effectiveMode === 'temporal_inpaint',
    },
    metadata: {
      model: modelId,
      aspectRatio: normalizeVideoAspectRatio(aspectRatio),
      resolution: normalizedResolution,
      durationSeconds: normalizedDuration,
      hasFirstFrame: !!stagedFirstFrameUri,
      hasLastFrame: !!stagedLastFrameUri,
      referenceCount: stagedReferenceUris.length,
      mode: effectiveMode,
      hasTemporalMask: effectiveMode === 'temporal_inpaint',
      sourceVideoUri: stagedSourceVideoUri,
      maskFrameUri: staged(maskFrameUri),
      maskTrackUri: staged(maskTrackUri),
      frameRange,
    },
    parentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  VideoJobDocumentSchema.parse(jobRecord);
  try {
    await createClaimedVideoJob(getDb(), {
      ownerUid: userId,
      reservationId: costReservationId,
      jobId,
      expectedCost: serverEstimatedCost,
      jobRecord,
    });
  } catch (error) {
    await deleteStorageOutputs(inputUris);
    throw error;
  }
  await safeDbSet(jobId, jobRecord, 'creative_jobs');

  return { jobId };
});

export const cancelVideoJob = onCall({ ...creativeGatewayCallableOptions, timeoutSeconds: 30 }, async (request) => {
  const { userId } = await requireCreativeGatewayAdmission(request, 'cancel-video');

  const schema = z.object({ jobId: z.string().min(1) });
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'jobId is required.');

  const { jobId } = parsed.data;
  const result = await cancelOwnedVideoJobTransactionally(getDb(), {
    jobId,
    ownerUid: userId,
    cancelledAt: new Date().toISOString(),
  });

  return { jobId, status: result.status };
});

type OmniInteractionStatus = 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete' | 'requires_action' | string;

interface OmniInteractionVideoOutput {
  type: 'video';
  data?: string;
  uri?: string;
  mime_type?: string;
}

interface OmniInteractionResponse {
  id: string;
  status: OmniInteractionStatus;
  output_video?: OmniInteractionVideoOutput;
  steps?: Array<{
    type: string;
    content?: Array<{ type?: string; data?: string; uri?: string; mime_type?: string }>;
    error?: { message?: string };
  }>;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
}

async function assertOwnedPreviousOmniInteraction(
  userId: string,
  previousJobId: string,
  previousInteractionId: string,
): Promise<void> {
  const snapshot = await getDb().collection('creative_jobs').doc(previousJobId).get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Previous Omni job was not found.');
  }
  const previousJob = snapshot.data() as Record<string, unknown>;
  if (previousJob.userId !== userId) {
    throw new HttpsError('permission-denied', 'Previous Omni interaction does not belong to this user.');
  }
  if (
    previousJob.type !== 'omni-video'
    || previousJob.status !== 'completed'
    || previousJob.interactionId !== previousInteractionId
  ) {
    throw new HttpsError('failed-precondition', 'Previous Omni interaction is not available for a stateful edit.');
  }
}

async function waitForGeminiFileActive(ai: GoogleGenAI, file: GeminiFile, label: string): Promise<GeminiFile> {
  let current = file;
  for (let pollCount = 0; pollCount <= VIDEO_MAX_POLLS; pollCount += 1) {
    if (current.state === FileState.ACTIVE || (!current.state && current.uri)) return current;
    if (current.state === FileState.FAILED) {
      throw new HttpsError('failed-precondition', `${label} processing failed: ${current.error?.message || 'unknown provider error'}`);
    }
    if (pollCount === VIDEO_MAX_POLLS) break;
    if (!current.name) {
      throw new HttpsError('internal', `${label} did not return a Gemini Files resource name.`);
    }
    await sleep(VIDEO_POLL_INTERVAL_MS);
    current = await ai.files.get({ name: current.name });
  }
  throw new HttpsError('deadline-exceeded', `${label} processing timed out.`);
}

/** Upload an authenticated user's Storage video through the Gemini Files API. */
async function uploadOwnedVideoToGeminiFiles(
  ai: GoogleGenAI,
  userId: string,
  gsUri: string,
): Promise<{ input: { type: 'document'; uri: string }; providerFileName: string }> {
  const { bucket, path } = parseStorageUri(gsUri);
  const defaultBucket = getStorage().bucket().name;
  if (bucket !== defaultBucket) {
    throw new HttpsError('permission-denied', 'Source video must live in this project storage bucket.');
  }
  if (!isOwnerScopedCreativePath(userId, path)) {
    throw new HttpsError('permission-denied', 'Source video must live in your creative storage namespace.');
  }

  const file = getStorage().bucket(bucket).file(path);
  const [metadata] = await file.getMetadata();
  const mimeType = metadata.contentType || '';
  if (!mimeType.startsWith('video/')) {
    throw new HttpsError('invalid-argument', `Omni edit input must be a video, got ${mimeType || 'unknown content type'}.`);
  }
  const size = Number(metadata.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new HttpsError('failed-precondition', 'Source video is empty or has invalid metadata.');
  }
  if (size > MAX_OMNI_VIDEO_INPUT_BYTES) {
    throw new HttpsError('resource-exhausted', 'Source video exceeds the 256 MiB gateway upload limit.');
  }

  const extension = extname(path) || '.mp4';
  const tempPath = join(tmpdir(), `omni_input_${crypto.randomUUID()}${extension}`);
  try {
    await file.download({ destination: tempPath });
    let durationSeconds: number;
    try {
      durationSeconds = await probeDurationSeconds(tempPath);
    } catch (error) {
      throw new HttpsError('failed-precondition', 'Source video could not be decoded for duration validation.', error);
    }
    if (durationSeconds > 10.05) {
      throw new HttpsError('invalid-argument', 'Gemini Omni Flash edit inputs must be 10 seconds or shorter.');
    }
    const uploaded = await ai.files.upload({
      file: tempPath,
      config: {
        mimeType,
        displayName: path.split('/').pop()?.slice(0, 512) || 'omni-source-video',
      },
    });
    const active = await waitForGeminiFileActive(ai, uploaded, 'Source video');
    if (!active.uri || !active.name) {
      throw new HttpsError('internal', 'Gemini Files did not return a usable source video URI.');
    }
    return {
      input: { type: 'document', uri: active.uri },
      providerFileName: active.name,
    };
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function pollInteraction(
  ai: GoogleGenAI,
  interaction: OmniInteractionResponse,
  jobId: string,
): Promise<OmniInteractionResponse> {
  let current = interaction;
  for (let pollCount = 0; pollCount <= VIDEO_MAX_POLLS; pollCount += 1) {
    const status = current.status.toLowerCase();
    if (status === 'completed' || status === 'active') return current;
    if (['failed', 'cancelled', 'incomplete', 'requires_action'].includes(status)) {
      const providerMessage = current.steps?.find(step => step.error?.message)?.error?.message;
      throw new Error(providerMessage || `Interaction failed with status: ${status}`);
    }
    if (pollCount === VIDEO_MAX_POLLS) break;
    await sleep(VIDEO_POLL_INTERVAL_MS);
    current = await ai.interactions.get(current.id) as OmniInteractionResponse;
    const progress = 20 + Math.round(((pollCount + 1) / VIDEO_MAX_POLLS) * 50);
    await safeDbUpdate(jobId, { progress, updatedAt: new Date().toISOString() });
  }
  throw new HttpsError('deadline-exceeded', 'Gemini Omni generation timed out before the interaction completed.');
}

function extractInteractionVideo(interaction: OmniInteractionResponse): OmniInteractionVideoOutput {
  if (interaction.output_video?.data || interaction.output_video?.uri) return interaction.output_video;
  for (const step of interaction.steps ?? []) {
    if (step.error?.message) throw new Error(step.error.message);
    const video = step.content?.find(content => content.type === 'video' && (content.data || content.uri));
    if (video) {
      return {
        type: 'video',
        data: video.data,
        uri: video.uri,
        mime_type: video.mime_type,
      };
    }
  }
  throw new MediaGenerationError('video', 'NO_VIDEO', 'No video output was present in the completed interaction.');
}

function geminiFileNameFromUri(uri: string): string | null {
  const match = uri.match(/(?:^|\/)files\/([A-Za-z0-9-]+)/);
  return match?.[1] ? `files/${match[1]}` : null;
}

async function fetchInteractionVideo(
  ai: GoogleGenAI,
  interaction: OmniInteractionResponse,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const output = extractInteractionVideo(interaction);
  if (output.data) {
    const buffer = Buffer.from(output.data, 'base64');
    if (buffer.length === 0) throw new MediaGenerationError('video', 'NO_VIDEO', 'Gemini returned an empty video payload.');
    return { buffer, mimeType: output.mime_type || 'video/mp4' };
  }

  const fileName = output.uri ? geminiFileNameFromUri(output.uri) : null;
  if (!fileName) {
    throw new MediaGenerationError('video', 'NO_VIDEO', 'Gemini returned an unsupported video URI.');
  }
  const generatedFile = await waitForGeminiFileActive(
    ai,
    await ai.files.get({ name: fileName }),
    'Generated video',
  );
  const tempPath = join(tmpdir(), `omni_output_${crypto.randomUUID()}.mp4`);
  try {
    await ai.files.download({ file: generatedFile, downloadPath: tempPath });
    const buffer = await readFile(tempPath);
    if (buffer.length === 0) throw new MediaGenerationError('video', 'NO_VIDEO', 'Gemini downloaded an empty video file.');
    return { buffer, mimeType: output.mime_type || generatedFile.mimeType || 'video/mp4' };
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

/**
 * generateOmniRemixV3 - Gemini Omni Flash generation and conversational editing.
 */
export const generateOmniRemixV3 = onCall({ ...creativeGatewayCallableOptions, timeoutSeconds: 540, memory: '2GiB' }, async (request) => {
  const { userId } = await requireCreativeGatewayAdmission(request, 'generate-omni-remix');

  const parsed = GenerateOmniRemixSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid Omni payload. Upload media to Cloud Storage and pass gs:// URIs only.');
  }

  const data = parsed.data;
  const jobId = getDb().collection('creative_jobs').doc().id;
  const modelId = resolveOmniFlashModel();
  const task = resolveOmniTask(data);
  const durationSeconds = Math.min(10, Math.max(3, data.durationSeconds));
  // Official paid-tier Standard pricing is approximately $0.10 per second of
  // 720p output. This is deliberately independent of the retired pipelineMode.
  const serverEstimatedCost = estimateVideoCost(durationSeconds, VIDEO_MODEL_IDS.fast);

  if (!data.costReservationId) {
    throw new HttpsError('failed-precondition', 'Missing cost reservation. Reserve cost before submitting the job.');
  }
  const reservation = await loadCostReservation(userId, data.costReservationId, 'video');
  if (Math.abs(reservation.estimatedCost - serverEstimatedCost) > 0.01) {
    throw new HttpsError('failed-precondition', 'Cost reservation estimate does not match the current Omni job estimate.');
  }

  let outputCompleted = false;
  let outputUri: string | null = null;
  try {
    if (data.audioUri) {
      throw new HttpsError(
        'failed-precondition',
        'Gemini Omni Flash does not currently support uploaded audio references. Describe the desired soundtrack in the prompt instead.',
      );
    }
    if (data.previousInteractionId && data.previousJobId) {
      await assertOwnedPreviousOmniInteraction(userId, data.previousJobId, data.previousInteractionId);
    }

    const initialJob = {
      id: jobId,
      userId,
      status: 'processing',
      type: 'omni-video',
      task,
      prompt: data.prompt,
      model: modelId,
      progress: 0,
      parentId: data.parentId,
      costEstimate: reservation.estimatedCost,
      costReservationId: data.costReservationId,
      previousInteractionId: data.previousInteractionId,
      previousJobId: data.previousJobId,
      metadata: {
        task,
        aspectRatio: data.aspectRatio,
        durationSeconds,
        hasSourceVideo: !!data.referenceVideoUri,
        hasFirstFrame: !!data.firstFrameUri,
        referenceCount: data.referenceUris?.length ?? 0,
        storyboardFrameCount: data.storyboard?.length ?? 0,
        synthIdExpectedByProvider: true,
      },
      createdAt: new Date().toISOString()
    };

    // Omni interaction IDs are required for secure stateful edits, so the job
    // record is part of the transaction boundary rather than best-effort telemetry.
    await getDb().collection('creative_jobs').doc(jobId).set(initialJob);
    const ai = getOmniAiClient();
    const sourceVideo = data.referenceVideoUri && !data.previousInteractionId
      ? await uploadOwnedVideoToGeminiFiles(ai, userId, data.referenceVideoUri)
      : undefined;
    const referenceImages = await loadReferenceImages(userId, {
      referenceUri: data.firstFrameUri,
      referenceUris: data.referenceUris,
    });

    const input = [
      ...(sourceVideo ? [sourceVideo.input] : []),
      ...referenceImages.map(r => ({ type: 'image' as const, mime_type: r.mimeType, data: r.data })),
      { type: 'text' as const, text: buildOmniPrompt(data, task) },
    ];

    const interaction = await ai.interactions.create({
      model: modelId,
      input,
      generation_config: {
        video_config: {
          task,
        },
      },
      response_format: {
        type: 'video',
        aspect_ratio: data.aspectRatio,
        duration: `${durationSeconds}s`,
        delivery: 'uri',
      },
      ...(data.previousInteractionId ? { previous_interaction_id: data.previousInteractionId } : {}),
      background: false,
      stream: false,
      store: true,
    });

    const finished = await pollInteraction(ai, interaction as OmniInteractionResponse, jobId);
    const { buffer, mimeType } = await fetchInteractionVideo(ai, finished);
    outputUri = await uploadToStorage(
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

    await getDb().collection('creative_jobs').doc(jobId).update({
      status: 'completed',
      resultUri: outputUri,
      interactionId: finished.id,
      progress: 100,
      costEstimate: reservation.estimatedCost,
      costReservationId: data.costReservationId,
      metadata: {
        model: modelId,
        task,
        aspectRatio: data.aspectRatio,
        durationSeconds,
        mimeType,
        providerInputFileName: sourceVideo?.providerFileName,
        hasSourceVideo: !!data.referenceVideoUri,
        hasFirstFrame: !!data.firstFrameUri,
        referenceCount: data.referenceUris?.length ?? 0,
        storyboardFrameCount: data.storyboard?.length ?? 0,
        synthIdAppliedByProvider: true,
        usage: finished.usage,
      },
      completedAt: new Date().toISOString()
    });
    outputCompleted = true;
    // ISSUE-1365: usage accounting — video minutes must appear in the
    // settings meters. The record type is 'video' with seconds as amount
    // (matching getUsageStats: videoDurationSeconds += amount).
    await recordUsage(userId, 'video', durationSeconds);
    try {
      await finalizeOperationReservation({
        userId,
        operationId: data.costReservationId,
        outcome: 'SETTLED',
      });
    } catch {
      console.error('[generateOmniRemixV3] Output completed; reservation settlement needs reconciliation', { jobId });
    }

    return {
      jobId,
      resultUri: outputUri,
      interactionId: finished.id,
      task,
      synthIdApplied: true,
    };
  } catch (error: unknown) {
    const gatewayError = recordGatewayFailure('Omni remix', jobId, error);
    if (!outputCompleted && outputUri) await deleteStorageOutputs([outputUri]);
    await safeDbUpdate(jobId, {
      status: 'failed',
      error: gatewayError.message,
      errorCode: gatewayError.code,
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!outputCompleted) {
      try {
        await finalizeOperationReservation({
          userId,
          operationId: data.costReservationId,
          outcome: 'VOIDED',
        });
      } catch {
        console.error('[generateOmniRemixV3] Failed to release cost reservation', { jobId });
      }
    }
    throw gatewayError;
  }
});

interface InteractionAudioResponse {
  output_audio?: {
    data?: string;
    mime_type?: string;
  };
}

function extractInteractionAudio(response: unknown): { pcm: Buffer; sampleRate: number } {
  const audio = (response as InteractionAudioResponse)?.output_audio;
  if (!audio?.data) {
    throw new MediaGenerationError('audio', 'NO_AUDIO');
  }
  const sampleRateMatch = audio.mime_type?.match(/rate=(\d+)/i);
  const sampleRate = sampleRateMatch ? Number(sampleRateMatch[1]) : 24_000;
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000) {
    throw new HttpsError('failed-precondition', 'The speech provider returned an invalid sample rate.');
  }
  return { pcm: Buffer.from(audio.data, 'base64'), sampleRate };
}

/** Wrap Gemini's raw mono 16-bit PCM in a browser-playable WAV container. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function estimateTtsDurationSeconds(prompt: string): number {
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(600, Math.max(1, Math.ceil((wordCount / 2.5) * 1.25)));
}

/**
 * Gemini 3.1 Flash TTS pricing: $1/M text input tokens and $20/M audio output
 * tokens, with 25 audio tokens per generated second. Reserve a 25% duration
 * buffer because the provider controls pacing.
 */
function estimateTtsCost(prompt: string): number {
  const inputTokens = Math.ceil(prompt.length / 4);
  const bufferedSeconds = estimateTtsDurationSeconds(prompt);
  const inputCost = inputTokens / 1_000_000;
  const outputCost = (bufferedSeconds * 25 * 20) / 1_000_000;
  return Math.max(0.001, Math.ceil((inputCost + outputCost) * 1_000_000) / 1_000_000);
}

function buildAudioJobId(userId: string, requestId: string): string {
  const digest = createHash('sha256').update(`${userId}:${requestId}`).digest('hex').slice(0, 40);
  return `audio-${digest}`;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  return record.code === 6 || record.code === '6' || record.code === 'already-exists'
    || errorMessage(error).toLowerCase().includes('already exists');
}

async function replayCompletedAudioJob(
  jobId: string,
  userId: string,
): Promise<{ jobId: string; libraryAssetId: string; resultUri: string; mimeType: string }> {
  const snapshot = await getDb().collection('creative_jobs').doc(jobId).get();
  const existing = snapshot.data() as Record<string, unknown> | undefined;
  if (!snapshot.exists || existing?.userId !== userId) {
    throw new HttpsError('failed-precondition', 'The existing audio request could not be resumed.');
  }
  if (existing.status !== 'completed' || typeof existing.resultUri !== 'string') {
    const status = existing.status === 'processing' ? 'still processing' : 'already failed';
    throw new HttpsError('aborted', `This audio request is ${status}. Use a new request ID only for an intentional retry.`);
  }
  const { bucket, path } = parseStorageUri(existing.resultUri);
  await getStorage().bucket(bucket).file(path).getMetadata();
  return {
    jobId,
    libraryAssetId: jobId,
    resultUri: existing.resultUri,
    mimeType: typeof existing.mimeType === 'string' ? existing.mimeType : 'audio/wav',
  };
}

/**
 * Durable, idempotent single-speaker TTS gateway. The server owns cost
 * reservation, generation, Storage persistence, and audio-library metadata.
 */
export const generateAudioV3 = onCall({ ...creativeGatewayCallableOptions, timeoutSeconds: 300, memory: '1GiB' }, async (request) => {
  const { userId, entitlement } = await requireCreativeGatewayAdmission(request, 'generate-audio');

  const parsed = GenerateAudioSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid TTS payload. Provide prompt, supported voice, and UUID requestId.');
  }

  const { prompt, voice, requestId } = parsed.data;
  const jobId = buildAudioJobId(userId, requestId);
  const db = getDb();
  const jobRef = db.collection('creative_jobs').doc(jobId);
  const createdAt = new Date().toISOString();

  try {
    await jobRef.create({
      id: jobId,
      userId,
      status: 'processing',
      type: 'audio',
      audioType: 'tts',
      prompt,
      voice,
      requestId,
      model: FUNCTION_INTELLIGENCE_MODELS.SPEECH.GENERATION,
      createdAt,
      updatedAt: createdAt,
    });
  } catch (error: unknown) {
    if (isAlreadyExistsError(error)) return replayCompletedAudioJob(jobId, userId);
    throw toGatewayError(error, 'Audio request initialization failed');
  }

  let outputUri: string | undefined;
  let operationId: string | undefined;
  try {
    const estimatedCost = estimateTtsCost(prompt);
    const reservation = await checkOperationBudget({
      userId,
      entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
      estimatedCost,
      operationType: 'audio',
      metadata: {
        jobId,
        requestId,
        model: FUNCTION_INTELLIGENCE_MODELS.SPEECH.GENERATION,
        type: 'tts',
      },
    });
    if (!reservation.allowed || !reservation.operationId) {
      throw new HttpsError('resource-exhausted', reservation.reason || 'Audio generation cost reservation was denied.');
    }
    operationId = reservation.operationId;
    await jobRef.update({ costEstimate: estimatedCost, costReservationId: operationId, updatedAt: new Date().toISOString() });

    const ai = getAiClient('audio');
    const interaction = await ai.interactions.create({
      model: FUNCTION_INTELLIGENCE_MODELS.SPEECH.GENERATION,
      input: prompt,
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice }] },
    });
    const { pcm, sampleRate } = extractInteractionAudio(interaction);
    const wav = pcmToWav(pcm, sampleRate);
    const actualDuration = Math.max(0.001, pcm.length / (sampleRate * 2));
    outputUri = await uploadToStorage(userId, wav, 'wav', 'audio/wav', {
      category: 'audio',
      purpose: 'outputs',
    });

    const completedAt = new Date().toISOString();
    const assetRef = db.collection('audio_assets').doc(jobId);
    const batch = db.batch();
    batch.set(assetRef, {
      id: jobId,
      userId,
      type: 'tts',
      prompt,
      mimeType: 'audio/wav',
      estimatedDuration: actualDuration,
      generatedAt: completedAt,
      storageUrl: outputUri,
      voicePreset: voice,
      fullText: prompt,
    });
    batch.update(jobRef, {
      status: 'completed',
      resultUri: outputUri,
      mimeType: 'audio/wav',
      estimatedDuration: actualDuration,
      costReservationId: operationId,
      completedAt,
      updatedAt: completedAt,
    });
    await batch.commit();

    try {
      await finalizeOperationReservation({ userId, operationId, outcome: 'SETTLED' });
    } catch {
      console.error('[generateAudioV3] Audio completed; reservation settlement queued for reconciliation', { jobId });
    }

    return {
      jobId,
      libraryAssetId: jobId,
      resultUri: outputUri,
      mimeType: 'audio/wav',
    };
  } catch (error: unknown) {
    const gatewayError = recordGatewayFailure('Audio generation', jobId, error);
    if (outputUri) await deleteStorageOutputs([outputUri]);
    await jobRef.set({
      status: 'failed',
      error: gatewayError.message,
      errorCode: gatewayError.code,
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(_jobError => {
      console.error('[generateAudioV3] Failed to record audio job failure', { jobId });
    });
    if (operationId) {
      try {
        await finalizeOperationReservation({ userId, operationId, outcome: 'VOIDED' });
      } catch {
        console.error('[generateAudioV3] Failed to release audio reservation', { jobId });
      }
    }
    throw gatewayError;
  }
});
