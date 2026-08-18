import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';

const mockInteractionsCreate = vi.fn();
const mockInteractionsGet = vi.fn();
const mockGenerateVideos = vi.fn();
const mockGetVideosOperation = vi.fn();
const mockDownload = vi.fn();
const mockFilesUpload = vi.fn();
const mockFilesGet = vi.fn();
const mockFilesDownload = vi.fn();
const mockGetMetadata = vi.fn();
const mockSet = vi.fn();
const mockCreate = vi.fn();
const mockAudioAssetSet = vi.fn();
const mockUpdate = vi.fn();
const mockJobGet = vi.fn();
const mockSave = vi.fn();
const mockDelete = vi.fn();
const mockCopy = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockFinalizeReservation = vi.hoisted(() => vi.fn());
const mockCheckOperationBudget = vi.hoisted(() => vi.fn());
const mockRequireVerifiedServerEntitlement = vi.hoisted(() => vi.fn());
const mockEntitlementTierToBudgetTier = vi.hoisted(() => vi.fn());
const mockArcjetProtect = vi.hoisted(() => vi.fn());
const mockArcjetPolicyForEntitlement = vi.hoisted(() => vi.fn());
const mockProbeDurationSeconds = vi.hoisted(() => vi.fn());
const mockCollectionNames: string[] = [];
const mockOnCallOptions = vi.hoisted(() => [] as unknown[]);
const mockOnCall = vi.hoisted(() => vi.fn((options, handler) => {
  mockOnCallOptions.push(options);
  return handler;
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return {
      interactions: {
        create: mockInteractionsCreate,
        get: mockInteractionsGet,
      },
      models: {
        generateVideos: mockGenerateVideos,
      },
      operations: {
        getVideosOperation: mockGetVideosOperation,
      },
      files: {
        upload: mockFilesUpload,
        get: mockFilesGet,
        download: mockFilesDownload,
      },
    };
  }),
  VideoGenerationReferenceType: {
    ASSET: 'ASSET',
    STYLE: 'STYLE',
  },
  FileState: {
    ACTIVE: 'ACTIVE',
    PROCESSING: 'PROCESSING',
    FAILED: 'FAILED',
  },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: mockOnCall,
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;

    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

vi.mock('firebase-admin', () => ({
  firestore: vi.fn(() => ({
    runTransaction: vi.fn(async (handler: (transaction: {
      get: (reference: { collectionName?: string; id?: string }) => Promise<unknown>;
      update: typeof mockUpdate;
      create: typeof mockCreate;
    }) => Promise<unknown>) => handler({
      get: vi.fn(async (reference: { collectionName?: string; id?: string }) => reference.collectionName === 'costLedger'
        ? {
            exists: true,
            data: () => ({
              userId: 'user-123',
              type: 'video',
              status: 'APPROVED',
              estimatedCost: 0.8,
            }),
          }
        : { exists: false, data: () => undefined }),
      update: mockUpdate,
      create: mockCreate,
    })),
    batch: vi.fn(() => ({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })),
    collection: vi.fn((name: string) => {
      mockCollectionNames.push(name);
      return {
        doc: vi.fn((id?: string) => ({
          id: id || 'job-123',
          path: `${name}/${id || 'job-123'}`,
          collectionName: name,
          set: name === 'audio_assets' ? mockAudioAssetSet : mockSet,
          create: mockCreate,
          update: mockUpdate,
          get: vi.fn(async () => name === 'creative_jobs'
            ? mockJobGet()
            : name === 'costLedger'
            ? ({
                exists: true,
                data: () => ({
                  userId: 'user-123',
                  type: id?.startsWith('image-') ? 'image' : id?.startsWith('audio-') ? 'audio' : 'video',
                  status: 'APPROVED',
                  estimatedCost: 0.8,
                }),
              })
            : ({
                exists: false,
                data: () => undefined,
              })),
        })),
      };
    }),
  })),
  storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      name: 'test-bucket',
      file: vi.fn(() => ({
        save: mockSave,
        delete: mockDelete,
        download: mockDownload,
        getMetadata: mockGetMetadata,
        copy: mockCopy,
      })),
    })),
  })),
}));

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mockArcjetProtect,
  policyClassForServerEntitlement: mockArcjetPolicyForEntitlement,
}));

vi.mock('../billing/enforceOperationCost', () => ({
  finalizeOperationReservation: mockFinalizeReservation,
  checkOperationBudget: mockCheckOperationBudget,
  requireVerifiedCreativeUser: vi.fn((auth: { uid?: string; token?: Record<string, unknown> } | undefined) => {
    if (!auth?.uid) {
      const error = Object.assign(new Error('User must be authenticated.'), { code: 'unauthenticated' });
      throw error;
    }
    if (auth.token?.email_verified !== true) {
      const error = Object.assign(new Error('Verify your email before using creative generation.'), { code: 'failed-precondition' });
      throw error;
    }
    return auth.uid;
  }),
}));

vi.mock('../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: mockRequireVerifiedServerEntitlement,
  entitlementTierToBudgetTier: mockEntitlementTierToBudgetTier,
}));

vi.mock('./getMediaDuration', () => ({
  probeDurationSeconds: mockProbeDurationSeconds,
}));

import {
  classifyMediaFinishFailure,
  generateAudioV3,
  generateImageV3,
  generateOmniRemixV3,
  generateVideoV3,
  getMediaVertexLocation,
  getOmniVertexLocation,
  type VideoGenerationJobRecord,
} from './gateway';

/**
 * `VideoGenerationJobRecord` is `VideoJobDocument & {...}`, and `VideoJobDocument`
 * is `z.infer` of a schema whose `.default()` fields (schemaVersion, progress,
 * inputUris, tempUris, persistentUris, maskUris, retryCount) are required —
 * non-optional — on the *output* type Zod infers, even though a real `.parse()`
 * call would fill them in. Passing a hand-built object straight through as this
 * type (as these fixtures do, without going through the schema) means every one
 * of those has to be supplied explicitly. This fills them with values that are
 * inert for `executeVideoJob`'s logic, so each test only needs to override what
 * it actually exercises (ISSUE-1212).
 */
const buildVideoJob = (overrides: Partial<VideoGenerationJobRecord> & Pick<VideoGenerationJobRecord, 'userId' | 'prompt'>): VideoGenerationJobRecord => ({
  id: 'job-123',
  schemaVersion: 1,
  status: 'queued',
  type: 'video',
  mode: 'video',
  progress: 0,
  payload: { prompt: overrides.prompt },
  inputUris: [],
  tempUris: [],
  persistentUris: [],
  maskUris: [],
  retryCount: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  ...overrides,
});

type GatewayRequest = {
  auth?: { uid: string; token?: Record<string, unknown> };
  data: Record<string, unknown>;
  rawRequest?: Record<string, unknown>;
};

function withVerifiedEmail(request: GatewayRequest): GatewayRequest {
  return {
    ...request,
    ...(request.auth ? {
      auth: {
        ...request.auth,
        token: { ...request.auth.token, email_verified: true },
      },
    } : {}),
    rawRequest: request.rawRequest ?? { method: 'POST', headers: {} },
  };
}

const callGenerateImage = (request: GatewayRequest): Promise<unknown> =>
  (generateImageV3 as unknown as (input: GatewayRequest) => Promise<unknown>)(withVerifiedEmail(request));

const callGenerateVideo = (request: GatewayRequest): Promise<unknown> =>
  (generateVideoV3 as unknown as (input: GatewayRequest) => Promise<unknown>)(withVerifiedEmail(request));

const callGenerateOmniRemix = (request: GatewayRequest): Promise<unknown> =>
  (generateOmniRemixV3 as unknown as (input: GatewayRequest) => Promise<unknown>)(withVerifiedEmail(request));

const callGenerateAudio = (request: GatewayRequest): Promise<unknown> =>
  (generateAudioV3 as unknown as (input: GatewayRequest) => Promise<unknown>)(withVerifiedEmail(request));

beforeEach(() => {
  mockRequireVerifiedServerEntitlement.mockResolvedValue({ tier: 'free' });
  mockEntitlementTierToBudgetTier.mockReturnValue('free');
  mockArcjetPolicyForEntitlement.mockReturnValue('verified-free');
  mockArcjetProtect.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('creative gateway media routing policy', () => {
  it('does not let generic Vertex location variables reroute media models', () => {
    vi.stubEnv('VERTEX_LOCATION', 'europe-west4');
    vi.stubEnv('VERTEX_MEDIA_LOCATION', 'us');
    vi.stubEnv('VERTEX_IMAGE_LOCATION', '');
    vi.stubEnv('VERTEX_VIDEO_LOCATION', '');
    vi.stubEnv('VERTEX_AUDIO_LOCATION', '');
    vi.stubEnv('VERTEX_OMNI_LOCATION', '');

    expect(getMediaVertexLocation('image')).toBe('global');
    expect(getMediaVertexLocation('video')).toBe('us-central1');
    expect(getMediaVertexLocation('audio')).toBe('global');
    expect(getOmniVertexLocation()).toBe('global');
  });

  it('honors only the media-specific location override for each route', () => {
    vi.stubEnv('VERTEX_IMAGE_LOCATION', 'global');
    vi.stubEnv('VERTEX_VIDEO_LOCATION', 'us-central1');
    vi.stubEnv('VERTEX_AUDIO_LOCATION', 'us-east1');
    vi.stubEnv('VERTEX_OMNI_LOCATION', 'global');

    expect(getMediaVertexLocation('image')).toBe('global');
    expect(getMediaVertexLocation('video')).toBe('us-central1');
    expect(getMediaVertexLocation('audio')).toBe('us-east1');
    expect(getOmniVertexLocation()).toBe('global');
  });
});

describe('creative gateway usage accounting (ISSUE-1365)', () => {
  it('writes a usage record with the gateway shape for a completed image', async () => {
    vi.clearAllMocks();
    const { recordUsage } = await import('./gateway');
    await recordUsage('user-123', 'image', 3, 'session-1');

    // The mock collection('usage').doc(id).set path — verify a set happened
    // with the usage record shape.
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-123',
      type: 'image',
      amount: 3,
      project: 'session-1',
      subscriptionId: 'gateway',
    }));
  });

  it('skips usage writes for missing user or zero amount', async () => {
    vi.clearAllMocks();
    const { recordUsage } = await import('./gateway');
    await recordUsage('', 'image', 1);
    await recordUsage('user-123', 'video', 0);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('creative gateway generateImageV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInteractionsCreate.mockReset();
    mockGetMetadata.mockReset();
    mockGetMetadata.mockResolvedValue([{ contentType: 'image/png', size: '15' }]);
  });

  it('allocates enough memory for the Gemini image SDK path', () => {
    expect(mockOnCallOptions).toContainEqual(
      expect.objectContaining({
        timeoutSeconds: 120,
        memory: '1GiB',
        enforceAppCheck: expect.any(Boolean),
      }),
    );
    expect(mockOnCallOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ secrets: [{ name: 'ARCJET_KEY' }] }),
    ]));
  });

  it('fails closed before Vertex work when the server-owned admission policy blocks a request', async () => {
    mockArcjetProtect.mockResolvedValueOnce({
      allowed: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      retryAfterSeconds: 20,
    });

    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A protected image request',
        costReservationId: 'image-op-rate-limited',
      },
    })).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { code: 'RATE_LIMITED', retryAfterSeconds: 20 },
    });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('rejects an unverified account before creating a job or calling Vertex', async () => {
    await expect((generateImageV3 as unknown as (input: GatewayRequest) => Promise<unknown>)({
      auth: { uid: 'user-123', token: { email_verified: false } },
      data: {
        prompt: 'A protected image request',
        aspectRatio: '1:1',
        model: 'fast',
        costReservationId: 'image-op-unverified',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Verify your email before using creative generation.',
    });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('honors fast model settings and extracts image data after text parts', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      output_image: {
        data: Buffer.from('image-bytes').toString('base64'),
        mime_type: 'image/png',
      },
    });

    const result = await callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Dogs having fun',
        aspectRatio: '16:9',
        model: 'fast',
        imageSize: '2K',
        thinkingLevel: 'minimal',
        costReservationId: 'image-op-1',
      },
    });

    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.1-flash-image',
      input: [{ type: 'text', text: 'Dogs having fun' }],
      response_modalities: ['image'],
      generation_config: expect.objectContaining({
        image_config: expect.objectContaining({ aspect_ratio: '16:9', image_size: '2K' }),
        thinking_level: 'minimal',
      }),
    }));
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('image-bytes'), expect.objectContaining({ contentType: 'image/png' }));
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'image-op-1',
      outcome: 'SETTLED',
    });
  });

  it('rejects search grounding requests when using fast image model', async () => {
    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Grounded fast image request',
        model: 'fast',
        useGoogleSearch: true,
        costReservationId: 'image-fast-grounding-test',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Search grounding is not supported on the Fast image generation model. Switch to Pro tier for search grounding.',
    });
  });

  it('rejects unsupported image-search grounding on the pro image model', async () => {
    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Image-search grounded pro request',
        model: 'pro',
        useImageSearch: true,
        costReservationId: 'image-pro-image-search-test',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Image Search grounding is not supported by the current image generation models.',
    });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
  });

  it('ISSUE-777: honors batch, text response, and thought-summary settings end to end', async () => {
    mockInteractionsCreate.mockResolvedValue({
      outputs: [
        { type: 'text', text: 'Visual direction notes' },
        { type: 'thought', summary: 'Composition summary' },
        {
          type: 'image',
          data: Buffer.from('image-bytes').toString('base64'),
          mime_type: 'image/png',
        },
      ],
    });

    const result = await callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Three grounded campaign concepts',
        aspectRatio: '1:1',
        model: 'pro',
        imageSize: '1K',
        count: 3,
        thinkingLevel: 'minimal',
        includeThoughts: true,
        responseFormat: 'image_and_text',
        useGoogleSearch: true,
        costReservationId: 'image-op-batch',
      },
    }) as {
      resultUris: string[];
      textNarration?: string;
      thoughtSummary?: string;
    };

    expect(mockInteractionsCreate).toHaveBeenCalledTimes(3);
    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      response_modalities: ['text', 'image'],
      generation_config: expect.objectContaining({
        thinking_summaries: 'auto',
      }),
      tools: [{ type: 'google_search', search_types: ['web_search'] }],
    }));
    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(result.resultUris).toHaveLength(3);
    expect(result.textNarration).toContain('Visual direction notes');
    expect(result.thoughtSummary).toContain('Composition summary');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      outputCount: 3,
      resultUris: expect.any(Array),
    }));
  });

  it('ISSUE-777: removes already-uploaded batch outputs when a later Storage write fails', async () => {
    mockInteractionsCreate.mockResolvedValue({
      output_image: {
        data: Buffer.from('image-bytes').toString('base64'),
        mime_type: 'image/png',
      },
    });
    mockSave
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Two-image batch',
        count: 2,
        model: 'fast',
        costReservationId: 'image-op-cleanup',
      },
    })).rejects.toBeDefined();

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'image-op-cleanup',
      outcome: 'VOIDED',
    });
  });

  it('includes reference images in the Gemini interaction payload and rejects foreign storage paths', async () => {
    mockDownload.mockResolvedValue([Buffer.from('reference-bytes')]);
    mockInteractionsCreate.mockResolvedValueOnce({
      output_image: {
        data: Buffer.from('image-bytes').toString('base64'),
        mime_type: 'image/png',
      },
    });

    await callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Dogs having fun',
        aspectRatio: '1:1',
        model: 'pro',
        referenceUri: 'gs://test-bucket/creative/user-123/ref.png',
        costReservationId: 'image-op-2',
      },
    });

    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3-pro-image',
      input: [
        { type: 'text', text: 'Dogs having fun' },
        { type: 'image', mime_type: 'image/png', data: Buffer.from('reference-bytes').toString('base64') },
      ],
    }));

    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Dogs having fun',
        aspectRatio: '1:1',
        model: 'pro',
        referenceUri: 'gs://test-bucket/creative/other-user/ref.png',
        costReservationId: 'image-op-3',
      },
    })).rejects.toMatchObject({
      code: 'permission-denied',
    });

    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Dogs having fun',
        aspectRatio: '1:1',
        model: 'pro',
        referenceUri: 'data:image/png;base64,Zm9yZ2Vk',
        costReservationId: 'image-op-4',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('maps Google model availability failures to actionable callable errors', async () => {
    mockInteractionsCreate.mockRejectedValueOnce(Object.assign(
      new Error('404 NOT_FOUND: model is not available for this project'),
      { status: 404 },
    ));

    await expect(callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Dogs having fun',
        aspectRatio: '16:9',
        model: 'pro',
        costReservationId: 'image-op-4',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('Image generation failed'),
    });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('requested generation capability is not available'),
      errorCode: 'failed-precondition',
    }));
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'image-op-4',
      outcome: 'VOIDED',
    });
  });

  it('surfaces a prompt-rephrase message when the model declines (NO_IMAGE), not a settings rejection', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      status: 'failed',
      outputs: [{ type: 'text', text: 'I am not sure what your dog looks like.' }],
    });

    // `callGenerateImage` returns `Promise<unknown>` (it wraps a real handler as
    // `unknown` above), so `.catch`'s return type is absorbed back into
    // `unknown` rather than narrowing to the catch handler's return type — the
    // assertion has to land on the whole awaited expression, not just inside
    // the handler.
    const rejection = await callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'If you know what my dog looks like you can try that',
        aspectRatio: '16:9',
        model: 'fast',
        costReservationId: 'image-op-5',
      },
    }).catch((error: unknown) => error) as { code: string; message: string };

    expect(rejection.code).toBe('failed-precondition');
    expect(rejection.message).toContain("INDII couldn't create an image");
    // The original defect: NO_IMAGE was wrapped as a settings rejection.
    expect(rejection.message).not.toContain('Google rejected the image generation settings');
    // Provider output may contain artist or prompt content, so the durable job
    // record keeps the safe product explanation rather than raw finish data.
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining("INDII couldn't create an image"),
      errorCode: 'failed-precondition',
    }));
  });
});

describe('classifyMediaFinishFailure', () => {
  it('treats NO_IMAGE as a recoverable, prompt-driven decline', () => {
    const result = classifyMediaFinishFailure('image', 'NO_IMAGE');
    expect(result.category).toBe('declined');
    expect(result.code).toBe('failed-precondition');
    expect(result.publicMessage).toContain("INDII couldn't create an image");
    expect(result.publicMessage).not.toContain('rejected');
  });

  it('maps safety finish reasons to an invalid-argument with a safety message', () => {
    for (const reason of ['IMAGE_SAFETY', 'SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST']) {
      const result = classifyMediaFinishFailure('image', reason);
      expect(result.category).toBe('safety');
      expect(result.code).toBe('invalid-argument');
      expect(result.publicMessage).toContain('safety filters');
    }
  });

  it('maps RECITATION to a copyright-oriented message', () => {
    const result = classifyMediaFinishFailure('image', 'RECITATION');
    expect(result.category).toBe('recitation');
    expect(result.publicMessage).toContain('copyrighted material');
  });

  it('maps MAX_TOKENS to a truncation message', () => {
    const result = classifyMediaFinishFailure('audio', 'MAX_TOKENS');
    expect(result.category).toBe('truncated');
    expect(result.publicMessage).toContain('ran out of room');
  });

  it('uses the right media noun per kind', () => {
    expect(classifyMediaFinishFailure('image', 'NO_IMAGE').publicMessage).toContain('an image');
    expect(classifyMediaFinishFailure('video', 'OTHER').publicMessage).toContain('a video');
    expect(classifyMediaFinishFailure('audio', 'OTHER').publicMessage).toContain('audio from that prompt');
  });
});

describe('creative gateway generateAudioV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInteractionsCreate.mockReset();
    mockGetMetadata.mockReset();
    mockCollectionNames.length = 0;
    mockSet.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockRequireVerifiedServerEntitlement.mockResolvedValue({ tier: 'free' });
    mockEntitlementTierToBudgetTier.mockReturnValue('free');
    mockCheckOperationBudget.mockResolvedValue({
      allowed: true,
      operationId: 'audio-reservation-1',
      remainingBudget: 99,
      dailyUsed: 0.02,
      monthlyUsed: 0.02,
    });
    mockJobGet.mockResolvedValue({ exists: false, data: () => undefined });
  });

  it('generates playable TTS, durably records the owned library asset, and settles its server reservation', async () => {
    const pcm = Buffer.alloc(48_000 * 2, 7); // 2 seconds of mono 24 kHz 16-bit PCM.
    mockInteractionsCreate.mockResolvedValueOnce({
      output_audio: {
        data: pcm.toString('base64'),
        mime_type: 'audio/pcm;rate=24000',
      },
    });

    const result = await callGenerateAudio({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Read this in a calm Detroit radio voice.',
        voice: 'Kore',
        requestId: '04df70bd-247f-4f9e-aef5-6ca9dc858b16',
      },
    }) as {
      jobId: string;
      libraryAssetId: string;
      mimeType: string;
      resultUri: string;
    };

    expect(mockInteractionsCreate).toHaveBeenCalledWith({
      model: 'gemini-3.1-flash-tts-preview',
      input: 'Read this in a calm Detroit radio voice.',
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    });

    const savedWav = mockSave.mock.calls[0]?.[0] as Buffer;
    expect(savedWav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(savedWav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(result).toEqual(expect.objectContaining({
      libraryAssetId: result.jobId,
      mimeType: 'audio/wav',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/audio/outputs/'),
    }));
    expect(mockRequireVerifiedServerEntitlement).toHaveBeenCalledWith('user-123');
    expect(mockCheckOperationBudget).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-123',
      entitlementTier: 'free',
    }));

    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'audio_assets' }),
      expect.objectContaining({
        id: result.jobId,
        userId: 'user-123',
        type: 'tts',
        prompt: 'Read this in a calm Detroit radio voice.',
        mimeType: 'audio/wav',
        estimatedDuration: 2,
        storageUrl: result.resultUri,
        voicePreset: 'Kore',
        fullText: 'Read this in a calm Detroit radio voice.',
      }),
    );
    expect(mockBatchCommit).toHaveBeenCalledOnce();
    expect(mockFinalizeReservation).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-123',
      operationId: expect.any(String),
      outcome: 'SETTLED',
    }));
  });

  it('removes the uploaded object and voids the reservation when the atomic metadata commit fails', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      output_audio: {
        data: Buffer.alloc(48_000, 3).toString('base64'),
        mime_type: 'audio/pcm;rate=24000',
      },
    });
    mockBatchCommit.mockRejectedValueOnce(new Error('Firestore unavailable'));

    await expect(callGenerateAudio({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Read this once.',
        voice: 'Kore',
        requestId: 'd372061b-a954-4930-ac33-f82975a18335',
      },
    })).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining('could not complete this request'),
    });

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'audio-reservation-1',
      outcome: 'VOIDED',
    });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }), { merge: true });
  });

  it('replays a completed request from durable Storage without generating or reserving again', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('already exists'), { code: 6 }));
    mockJobGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        userId: 'user-123',
        status: 'completed',
        resultUri: 'gs://test-bucket/creative/user-123/audio/outputs/existing.wav',
        mimeType: 'audio/wav',
      }),
    });
    mockGetMetadata.mockResolvedValueOnce([{ contentType: 'audio/wav', size: '48044' }]);

    const result = await callGenerateAudio({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Read this once.',
        voice: 'Kore',
        requestId: 'd372061b-a954-4930-ac33-f82975a18335',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      resultUri: 'gs://test-bucket/creative/user-123/audio/outputs/existing.wav',
      mimeType: 'audio/wav',
    }));
    expect(result).not.toHaveProperty('audioContent');
    expect(mockGetMetadata).toHaveBeenCalledOnce();
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockCheckOperationBudget).not.toHaveBeenCalled();
  });
});

describe('creative gateway generateVideoV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInteractionsCreate.mockReset();
    mockCollectionNames.length = 0;
    mockGetMetadata.mockResolvedValue([{
      contentType: 'image/png',
      size: '1024',
      generation: '42',
      metadata: { contentHash: 'a'.repeat(64) },
    }]);
    mockDownload.mockResolvedValue([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0])]);
    mockCopy.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockSet.mockResolvedValue(undefined);
  });

  it('queues a video job and returns quickly from the callable', async () => {
    const result = await callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A cinematic social clip',
        aspectRatio: '9:16',
        model: 'fast',
        resolution: '1080p',
        durationSeconds: 6,
        firstFrameUri: 'gs://test-bucket/creative/user-123/frames/start.png',
        lastFrameUri: 'gs://test-bucket/creative/user-123/frames/end.png',
        referenceUris: ['gs://test-bucket/creative/user-123/refs/artist.png'],
        personGeneration: 'allow_adult',
        negativePrompt: 'no blurry faces',
        seed: '42',
        costReservationId: 'op-123',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
    }));
    expect(mockGenerateVideos).not.toHaveBeenCalled();
    expect(mockGetVideosOperation).not.toHaveBeenCalled();
    expect(mockCollectionNames).toEqual(expect.arrayContaining(['creative_jobs', 'videoJobs']));
    expect(mockCreate.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      workerVersion: 'gateway-video-v3',
      verifiedInputs: expect.arrayContaining([
        expect.objectContaining({
          originalUri: 'gs://test-bucket/creative/user-123/frames/start.png',
          sourceGeneration: '42',
        }),
      ]),
    }));
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it('ISSUE-1135: preserves No People when a frame-conditioned job is queued', async () => {
    await callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'An empty gallery with moving shadows',
        aspectRatio: '16:9',
        model: 'fast',
        resolution: '1080p',
        durationSeconds: 6,
        firstFrameUri: 'gs://test-bucket/creative/user-123/frames/empty-gallery.png',
        personGeneration: 'dont_allow',
        costReservationId: 'op-123',
      },
    });

    expect(mockCreate.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      firstFrameUri: expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
      personGeneration: 'dont_allow',
    }));
  });

  it('rejects a browser-supplied cost-check bypass before creating a job', async () => {
    await expect(callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A cinematic social clip',
        aspectRatio: '16:9',
        model: 'fast',
        resolution: '720p',
        durationSeconds: 6,
        skipCostCheck: true,
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('costReservationId'),
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('reports the exact malformed field instead of falsely blaming every payload on Base64', async () => {
    await expect(callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A cinematic social clip',
        costReservationId: 'op-123',
        aspectRatio: '16:9',
        firstFrameUri: 'https://example.com/not-canonical.png',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('firstFrameUri'),
    });
    await expect(callGenerateVideo({
      auth: { uid: 'user-123' },
      data: { prompt: 'A cinematic social clip', aspectRatio: '16:9' },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('costReservationId'),
    });
  });

  it('ISSUE-1003: persists the exact role-labelled input manifest to both video job documents', async () => {
    const inputManifest = [
      { role: 'first_frame', uri: 'gs://test-bucket/creative/user-123/frames/a.png' },
      { role: 'last_frame', uri: 'gs://test-bucket/creative/user-123/frames/d.png' },
      { role: 'ingredient', uri: 'gs://test-bucket/creative/user-123/refs/b.png' },
      { role: 'character_reference', uri: 'gs://test-bucket/creative/user-123/refs/c.png' },
    ];

    await callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Keep the opening frame while preserving the character reference',
        aspectRatio: '16:9',
        model: 'fast',
        resolution: '1080p',
        durationSeconds: 6,
        firstFrameUri: inputManifest[0].uri,
        lastFrameUri: inputManifest[1].uri,
        referenceUris: [inputManifest[2].uri, inputManifest[3].uri],
        inputManifest,
        directorSettings: {
          fps: 30,
          firstFrameUri: inputManifest[0].uri,
          lastFrameUri: inputManifest[1].uri,
          cameraMovement: 'slow push',
        },
        costReservationId: 'op-123',
      },
    });

    expect(mockCreate.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      firstFrameUri: expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
      lastFrameUri: expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
      referenceUris: [
        expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
        expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
      ],
      payload: expect.objectContaining({
        inputManifest: inputManifest.map(input => ({
          ...input,
          uri: expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
        })),
      }),
      directorSettings: expect.objectContaining({
        fps: 30,
        firstFrameUri: expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
        lastFrameUri: expect.stringContaining('gs://test-bucket/generated/user-123/video-inputs/job-123/'),
        cameraMovement: 'slow push',
      }),
    }));
  });

  /**
   * ISSUE-870: GenerateVideoSchema's aspectRatio enum includes 1:1/3:4/4:3,
   * but Veo only actually produces 16:9 or 9:16 — normalizeVideoAspectRatio()
   * used to silently coerce any of those to 16:9 with no warning. This
   * proves the callable now rejects them instead of lying about the shape.
   */
  it.each(['1:1', '3:4', '4:3'])('rejects an unsupported aspect ratio (%s) instead of silently coercing to 16:9', async (unsupportedRatio) => {
    await expect(callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A cinematic social clip',
        aspectRatio: unsupportedRatio,
        model: 'fast',
        resolution: '1080p',
        durationSeconds: 6,
        costReservationId: 'op-123',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining(unsupportedRatio),
    });

    expect(mockSet).not.toHaveBeenCalled();
  });

  /**
   * ISSUE-869: temporal_inpaint capability is checked BEFORE the cost
   * reservation is loaded/validated, so an unsupported request fails on the
   * clearest signal without an extra Firestore read for a job that's going
   * to be rejected anyway. GEMINI_VEO_TEMPORAL_INPAINT_ENABLED is unset in
   * this test env, so real Veo model IDs (fast/lite/pro) never satisfy
   * supportsTemporalInpaint() — matching the real-world default-disabled case.
   */
  it('rejects temporal_inpaint before loading the cost reservation when the capability is unsupported', async () => {
    await expect(callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A cinematic social clip',
        aspectRatio: '16:9',
        mode: 'temporal_inpaint',
        model: 'fast',
        resolution: '1080p',
        durationSeconds: 6,
        sourceVideoUri: 'gs://test-bucket/source.mp4',
        maskFrameUri: 'gs://test-bucket/mask.png',
        frameRange: { startFrame: 0, endFrame: 10 },
        costReservationId: 'op-123',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('does not support temporal inpaint'),
    });

    // The cost reservation collection is never even queried.
    expect(mockCollectionNames).not.toContain('costLedger');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('processes a queued video job asynchronously and stores the rendered output', async () => {
    mockGenerateVideos.mockResolvedValueOnce({
      done: true,
      response: {
        generatedVideos: [{
          video: {
            videoBytes: Buffer.from('video-bytes').toString('base64'),
            mimeType: 'video/mp4',
          },
        }],
      },
    });

    const { executeVideoJob } = await import('./gateway');
    const result = await executeVideoJob('job-123', buildVideoJob({
      userId: 'user-123',
      prompt: 'A cinematic social clip',
      aspectRatio: '9:16',
      model: 'fast',
      resolution: '1080p',
      durationSeconds: 6,
      referenceUris: ['gs://test-bucket/refs/artist.png'],
      firstFrameUri: 'gs://test-bucket/frames/start.png',
      lastFrameUri: 'gs://test-bucket/frames/end.png',
      personGeneration: 'dont_allow',
      negativePrompt: 'no blurry faces',
      seed: '42',
      enhancePrompt: true,
      inputUris: ['gs://test-bucket/frames/start.png'],
    }));

    expect(mockGenerateVideos).toHaveBeenCalledWith(expect.objectContaining({
      model: 'veo-3.1-fast-generate-001',
      prompt: 'A cinematic social clip',
      image: { gcsUri: 'gs://test-bucket/frames/start.png' },
      config: expect.objectContaining({
        numberOfVideos: 1,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '1080p',
        enhancePrompt: true,
        personGeneration: 'dont_allow',
        negativePrompt: 'no blurry faces',
        seed: 42,
        lastFrame: { gcsUri: 'gs://test-bucket/frames/end.png' },
        referenceImages: [{
          image: { gcsUri: 'gs://test-bucket/refs/artist.png' },
          referenceType: 'ASSET',
        }],
      }),
    }));
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('video-bytes'), expect.objectContaining({ contentType: 'video/mp4' }));
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
    expect(mockCollectionNames).toEqual(expect.arrayContaining(['creative_jobs', 'videoJobs']));
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('maps Veo safety-filter failures to actionable callable errors', async () => {
    mockGenerateVideos.mockResolvedValueOnce({
      done: true,
      response: {
        raiMediaFilteredCount: 1,
        raiMediaFilteredReasons: ['policy'],
        generatedVideos: [],
      },
    });

    const { executeVideoJob } = await import('./gateway');

    await expect(executeVideoJob('job-123', buildVideoJob({
      userId: 'user-123',
      prompt: 'blocked clip',
      aspectRatio: '16:9',
      model: 'pro',
      resolution: '720p',
      durationSeconds: 6,
    }))).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('Video generation failed'),
    });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('generation request was rejected'),
      errorCode: 'invalid-argument',
    }));
  });
});

describe('creative gateway generateOmniRemixV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInteractionsCreate.mockReset();
    mockInteractionsGet.mockReset();
    mockDownload.mockReset();
    mockFilesUpload.mockReset();
    mockFilesGet.mockReset();
    mockFilesDownload.mockReset();
    mockGetMetadata.mockReset();
    mockSave.mockReset();
    mockSet.mockReset();
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
    mockJobGet.mockReset();
    mockProbeDurationSeconds.mockReset();
    mockProbeDurationSeconds.mockResolvedValue(8);
    mockDownload.mockResolvedValue([Buffer.from('video-bytes')]);
    mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4', size: '1024' }]);
    mockFilesUpload.mockResolvedValue({
      name: 'files/source-123',
      uri: 'https://generativelanguage.googleapis.com/v1beta/files/source-123',
      state: 'ACTIVE',
      mimeType: 'video/mp4',
    });
  });

  it('uploads an owned edit source and sends the official Omni interaction contract', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-123',
      status: 'completed',
      output_video: {
        data: Buffer.from('omni-video-bytes').toString('base64'),
        mime_type: 'video/mp4',
      },
    });

    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Add neon glow effects to the performance',
        task: 'edit',
        referenceVideoUri: 'gs://test-bucket/creative/user-123/video/assets/performance.mp4',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-omni-flash-preview',
      input: expect.arrayContaining([
        {
          type: 'document',
          uri: 'https://generativelanguage.googleapis.com/v1beta/files/source-123',
        },
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Keep everything else the same.'),
        }),
      ]),
      generation_config: { video_config: { task: 'edit' } },
      response_format: {
        type: 'video',
        aspect_ratio: '16:9',
        duration: '8s',
        delivery: 'uri',
      },
      background: false,
      stream: false,
      store: true,
    }));
    expect(mockFilesUpload).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ mimeType: 'video/mp4' }),
    }));
    expect(mockGenerateVideos).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
      interactionId: 'interaction-123',
      task: 'edit',
      synthIdApplied: true,
    }));
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'SETTLED',
    });
  });

  it.each([
    ['text_to_video', {}],
    ['image_to_video', { firstFrameUri: 'gs://test-bucket/creative/user-123/images/first.png' }],
    ['reference_to_video', { referenceUris: ['gs://test-bucket/creative/user-123/images/artist.png'] }],
  ] as const)('supports the %s task', async (task, taskInput) => {
    if (task !== 'text_to_video') {
      mockGetMetadata.mockResolvedValue([{ contentType: 'image/png', size: '11' }]);
    }
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-123',
      status: 'completed',
      output_video: {
        data: Buffer.from('omni-video-bytes').toString('base64'),
        mime_type: 'video/mp4',
      },
    });
    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A kinetic performance film in a midnight warehouse',
        task,
        ...taskInput,
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      generation_config: { video_config: { task } },
    }));
    expect(result).toEqual(expect.objectContaining({ task }));
  });

  it('rejects unsupported reference-image formats and releases the reservation', async () => {
    mockGetMetadata.mockResolvedValueOnce([{ contentType: 'image/svg+xml', size: '11' }]);

    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Use the performer as the visual reference',
        task: 'reference_to_video',
        referenceUris: ['gs://test-bucket/creative/user-123/images/performer.svg'],
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('supported raster image format'),
    });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'VOIDED',
    });
  });

  it('continues an owned stored interaction for stateful editing', async () => {
    mockJobGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        userId: 'user-123',
        type: 'omni-video',
        status: 'completed',
        interactionId: 'interaction-previous',
      }),
    });
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-next',
      status: 'completed',
      output_video: {
        data: Buffer.from('edited-video').toString('base64'),
        mime_type: 'video/mp4',
      },
    });

    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Make the jacket cobalt blue',
        task: 'edit',
        previousInteractionId: 'interaction-previous',
        previousJobId: 'job-previous',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      previous_interaction_id: 'interaction-previous',
      generation_config: { video_config: { task: 'edit' } },
    }));
    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      interactionId: 'interaction-next',
      task: 'edit',
    }));
  });

  it('rejects a stateful interaction that is not backed by an owned Omni job', async () => {
    mockJobGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        userId: 'user-123',
        type: 'video',
        status: 'completed',
        interactionId: 'interaction-previous',
      }),
    });

    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Make the jacket cobalt blue',
        task: 'edit',
        previousInteractionId: 'interaction-previous',
        previousJobId: 'job-previous',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'VOIDED',
    });
  });

  it('downloads URI-delivered output through the Gemini Files API', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-123',
      status: 'completed',
      output_video: {
        type: 'video',
        uri: 'https://generativelanguage.googleapis.com/v1beta/files/output-456',
        mime_type: 'video/mp4',
      },
    });
    mockFilesGet.mockResolvedValueOnce({
      name: 'files/output-456',
      uri: 'https://generativelanguage.googleapis.com/v1beta/files/output-456',
      state: 'ACTIVE',
      mimeType: 'video/mp4',
    });
    mockFilesDownload.mockImplementationOnce(async ({ downloadPath }: { downloadPath: string }) => {
      await writeFile(downloadPath, Buffer.from('downloaded-omni-video'));
    });

    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A kinetic performance film in a midnight warehouse',
        task: 'text_to_video',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
    expect(mockFilesGet).toHaveBeenCalledWith({ name: 'files/output-456' });
    expect(mockFilesDownload).toHaveBeenCalledWith(expect.objectContaining({
      file: expect.objectContaining({ name: 'files/output-456' }),
      downloadPath: expect.any(String),
    }));
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('downloaded-omni-video'), expect.any(Object));
  });

  it('rejects uploaded audio references before calling Gemini and voids the existing reservation', async () => {
    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Cut the video to this track',
        task: 'text_to_video',
        audioUri: 'gs://test-bucket/creative/user-123/audio/reference.wav',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('does not currently support uploaded audio references'),
    });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'VOIDED',
    });
  });

  it('rejects uploaded edit sources longer than the documented 10-second limit', async () => {
    mockProbeDurationSeconds.mockResolvedValueOnce(10.5);
    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Make the lighting blue',
        task: 'edit',
        referenceVideoUri: 'gs://test-bucket/creative/user-123/video/assets/performance.mp4',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('10 seconds or shorter'),
    });
    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'VOIDED',
    });
  });

  it('requires a matching reservation and voids it if Gemini fails', async () => {
    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A kinetic performance film',
        task: 'text_to_video',
        durationSeconds: 8,
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('Missing cost reservation'),
    });

    mockInteractionsCreate.mockRejectedValueOnce(Object.assign(new Error('Provider unavailable'), { status: 503 }));
    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A kinetic performance film',
        task: 'text_to_video',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    })).rejects.toMatchObject({ code: 'deadline-exceeded' });
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'VOIDED',
    });
  });

  it('does not call Gemini when the durable job record cannot be created', async () => {
    mockSet.mockRejectedValueOnce(new Error('Firestore unavailable'));
    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'A kinetic performance film',
        task: 'text_to_video',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    })).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining('could not complete this request'),
    });
    expect(mockInteractionsCreate).not.toHaveBeenCalled();
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      userId: 'user-123',
      operationId: 'cost-op-1',
      outcome: 'VOIDED',
    });
  });
});
