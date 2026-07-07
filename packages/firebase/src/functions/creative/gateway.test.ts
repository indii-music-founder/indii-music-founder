import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInteractionsCreate = vi.fn();
const mockGenerateVideos = vi.fn();
const mockGetVideosOperation = vi.fn();
const mockDownload = vi.fn();
const mockGetMetadata = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockSave = vi.fn();
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
      },
      models: {
        generateVideos: mockGenerateVideos,
      },
      operations: {
        getVideosOperation: mockGetVideosOperation,
      },
      files: {
        download: mockDownload,
      },
    };
  }),
  VideoGenerationReferenceType: {
    ASSET: 'ASSET',
    STYLE: 'STYLE',
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
    collection: vi.fn((name: string) => {
      mockCollectionNames.push(name);
      return {
        doc: vi.fn((id?: string) => ({
          id: id || 'job-123',
          set: mockSet,
          update: mockUpdate,
          get: vi.fn(async () => name === 'costLedger'
            ? ({
                exists: true,
                data: () => ({
                  userId: 'user-123',
                  type: 'video',
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
        download: mockDownload,
        getMetadata: mockGetMetadata,
      })),
    })),
  })),
}));

vi.mock('../../config/secrets', () => ({
  geminiApiKey: {},
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
}));

import { classifyMediaFinishFailure, generateImageV3, generateOmniRemixV3, generateVideoV3 } from './gateway';

const callGenerateImage = generateImageV3 as unknown as (request: {
  auth?: { uid: string };
  data: Record<string, unknown>;
}) => Promise<unknown>;

const callGenerateVideo = generateVideoV3 as unknown as (request: {
  auth?: { uid: string };
  data: Record<string, unknown>;
}) => Promise<unknown>;

const callGenerateOmniRemix = generateOmniRemixV3 as unknown as (request: {
  auth?: { uid: string };
  data: Record<string, unknown>;
}) => Promise<unknown>;

describe('creative gateway generateImageV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMetadata.mockResolvedValue([{ contentType: 'image/png' }]);
  });

  it('allocates enough memory for the Gemini image SDK path', () => {
    expect(mockOnCallOptions).toContainEqual(
      expect.objectContaining({
        timeoutSeconds: 120,
        memory: '1GiB',
        enforceAppCheck: expect.any(Boolean),
      }),
    );
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
        useGoogleSearch: true,
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
      tools: [{ type: 'google_search', search_types: ['web_search'] }],
    }));
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('image-bytes'), expect.objectContaining({ contentType: 'image/png' }));
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
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
      },
    })).rejects.toMatchObject({
      code: 'permission-denied',
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
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('Image generation failed'),
    });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('model is not available'),
    }));
  });

  it('surfaces a prompt-rephrase message when the model declines (NO_IMAGE), not a settings rejection', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      status: 'failed',
      outputs: [{ type: 'text', text: 'I am not sure what your dog looks like.' }],
    });

    const rejection = await callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'If you know what my dog looks like you can try that',
        aspectRatio: '16:9',
        model: 'fast',
      },
    }).catch((error: unknown) => error as { code: string; message: string });

    expect(rejection.code).toBe('failed-precondition');
    expect(rejection.message).toContain("INDII couldn't create an image");
    // The original defect: NO_IMAGE was wrapped as a settings rejection.
    expect(rejection.message).not.toContain('Google rejected the image generation settings');
    // The detailed finish reason is still recorded for diagnostics.
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('NO_IMAGE'),
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

describe('creative gateway generateVideoV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionNames.length = 0;
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
        firstFrameUri: 'gs://test-bucket/frames/start.png',
        lastFrameUri: 'gs://test-bucket/frames/end.png',
        referenceUris: ['gs://test-bucket/refs/artist.png'],
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
    expect(mockSet).toHaveBeenCalledTimes(2);
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
    const result = await executeVideoJob('job-123', {
      userId: 'user-123',
      status: 'queued',
      type: 'video',
      prompt: 'A cinematic social clip',
      aspectRatio: '9:16',
      model: 'fast',
      resolution: '1080p',
      durationSeconds: 6,
      referenceUris: ['gs://test-bucket/refs/artist.png'],
      firstFrameUri: 'gs://test-bucket/frames/start.png',
      lastFrameUri: 'gs://test-bucket/frames/end.png',
      personGeneration: 'allow_adult',
      negativePrompt: 'no blurry faces',
      seed: '42',
      enhancePrompt: true,
      progress: 0,
      mode: 'veo-3.1-fast-generate-preview',
      inputUris: ['gs://test-bucket/frames/start.png'],
      maskUris: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(mockGenerateVideos).toHaveBeenCalledWith(expect.objectContaining({
      model: 'veo-3.1-fast-generate-preview',
      prompt: 'A cinematic social clip',
      image: { gcsUri: 'gs://test-bucket/frames/start.png' },
      config: expect.objectContaining({
        numberOfVideos: 1,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '1080p',
        personGeneration: 'allow_adult',
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

    await expect(executeVideoJob('job-123', {
      id: 'job-123',
      userId: 'user-123',
      status: 'queued',
      type: 'video',
      prompt: 'blocked clip',
      aspectRatio: '16:9',
      model: 'pro',
      resolution: '720p',
      durationSeconds: 6,
      progress: 0,
      inputUris: [],
      maskUris: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('Video generation failed'),
    });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('safety filters'),
    }));
  });
});

describe('creative gateway generateOmniRemixV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownload.mockResolvedValue([Buffer.from('video-bytes')]);
    mockGetMetadata.mockResolvedValue([{ contentType: 'video/mp4' }]);
  });

  it('generates a video via the Omni Flash Interactions API with correct payload', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-123',
      status: 'ACTIVE',
      output_video: {
        data: Buffer.from('omni-video-bytes').toString('base64'),
        mime_type: 'video/mp4',
      },
    });

    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Add neon glow effects to the performance',
        referenceVideoUri: 'gs://test-bucket/base/performance.mp4',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(mockInteractionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-omni-flash-preview',
      response_modalities: ['video'],
      generation_config: expect.objectContaining({
        video_config: expect.objectContaining({
          tasks: 'edit',
          aspect_ratio: '16:9',
          duration_seconds: 8,
          resolution: '1080p',
        }),
      }),
      response_format: { delivery: 'uri' },
    }));
    expect(mockGenerateVideos).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
  });

  it('requires a cost reservation and persists Omni cost metadata', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-123',
      status: 'ACTIVE',
      output_video: {
        data: Buffer.from('omni-video-bytes').toString('base64'),
        mime_type: 'video/mp4',
      },
    });

    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Add neon glow effects to the performance',
        referenceVideoUri: 'gs://test-bucket/base/performance.mp4',
        aspectRatio: '16:9',
        durationSeconds: 8,
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('Missing cost reservation'),
    });

    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Add neon glow effects to the performance',
        referenceVideoUri: 'gs://test-bucket/base/performance.mp4',
        aspectRatio: '16:9',
        durationSeconds: 8,
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      costEstimate: 0.8,
      costReservationId: 'cost-op-1',
    }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      costEstimate: 0.8,
      costReservationId: 'cost-op-1',
    }));
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
  });
});
