import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInteractionsCreate = vi.fn();
const mockGenerateVideos = vi.fn();
const mockGetVideosOperation = vi.fn();
const mockDownload = vi.fn();
const mockGetMetadata = vi.fn();
const mockSet = vi.fn();
const mockCreate = vi.fn();
const mockAudioAssetSet = vi.fn();
const mockUpdate = vi.fn();
const mockJobGet = vi.fn();
const mockSave = vi.fn();
const mockDelete = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockFinalizeReservation = vi.hoisted(() => vi.fn());
const mockCheckOperationBudget = vi.hoisted(() => vi.fn());
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
      })),
    })),
  })),
}));

vi.mock('../../config/secrets', () => ({
  geminiApiKey: {},
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
}));

vi.mock('../billing/enforceOperationCost', () => ({
  finalizeOperationReservation: mockFinalizeReservation,
  checkOperationBudget: mockCheckOperationBudget,
}));

import { classifyMediaFinishFailure, generateAudioV3, generateImageV3, generateOmniRemixV3, generateVideoV3 } from './gateway';

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

const callGenerateAudio = generateAudioV3 as unknown as (request: {
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
      tools: [{ type: 'google_search', search_types: ['web_search'] }],
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
        model: 'fast',
        imageSize: '1K',
        count: 3,
        thinkingLevel: 'minimal',
        includeThoughts: true,
        responseFormat: 'image_and_text',
        useGoogleSearch: true,
        useImageSearch: true,
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
        thinking_level: 'minimal',
        thinking_summaries: 'auto',
      }),
      tools: [{ type: 'google_search', search_types: ['web_search', 'image_search'] }],
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
      error: expect.stringContaining('model is not available'),
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

    const rejection = await callGenerateImage({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'If you know what my dog looks like you can try that',
        aspectRatio: '16:9',
        model: 'fast',
        costReservationId: 'image-op-5',
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

describe('creative gateway generateAudioV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectionNames.length = 0;
    mockSet.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
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
    })).rejects.toMatchObject({ message: expect.stringContaining('Firestore unavailable') });

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

  it('ISSUE-1003: persists the exact role-labelled input manifest to both video job documents', async () => {
    const inputManifest = [
      { role: 'first_frame', uri: 'gs://test-bucket/frames/a.png' },
      { role: 'last_frame', uri: 'gs://test-bucket/frames/d.png' },
      { role: 'ingredient', uri: 'gs://test-bucket/refs/b.png' },
      { role: 'character_reference', uri: 'gs://test-bucket/refs/c.png' },
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
        costReservationId: 'op-123',
      },
    });

    expect(mockSet).toHaveBeenCalledTimes(2);
    for (const [jobRecord] of mockSet.mock.calls) {
      expect(jobRecord).toEqual(expect.objectContaining({
        firstFrameUri: 'gs://test-bucket/frames/a.png',
        lastFrameUri: 'gs://test-bucket/frames/d.png',
        referenceUris: [
          'gs://test-bucket/refs/b.png',
          'gs://test-bucket/refs/c.png',
        ],
        payload: expect.objectContaining({ inputManifest }),
      }));
    }
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
      model: 'veo-3.1-fast-generate-001',
      prompt: 'A cinematic social clip',
      image: { gcsUri: 'gs://test-bucket/frames/start.png' },
      config: expect.objectContaining({
        numberOfVideos: 1,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '1080p',
        enhancePrompt: true,
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
    process.env.GEMINI_OMNI_FLASH_MODEL = 'gemini-omni-flash-preview';
  });

  afterEach(() => {
    delete process.env.GEMINI_OMNI_FLASH_MODEL;
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

  it('ISSUE-774: never prices "hybrid-veo" at the Pro rate — it never runs a second Veo stage', async () => {
    mockInteractionsCreate.mockResolvedValueOnce({
      id: 'interaction-123',
      status: 'ACTIVE',
      output_video: {
        data: Buffer.from('omni-video-bytes').toString('base64'),
        mime_type: 'video/mp4',
      },
    });

    // A client with a stale persisted 'hybrid-veo' selection still reserves
    // at the real (fast) rate. If the server priced this at the Pro rate
    // (0.4/sec instead of 0.1/sec), 8 * 0.4 = 3.2 would mismatch this 0.8
    // reservation and the job would be rejected before ever running.
    const result = await callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Add neon glow effects to the performance',
        referenceVideoUri: 'gs://test-bucket/base/performance.mp4',
        aspectRatio: '16:9',
        durationSeconds: 8,
        pipelineMode: 'hybrid-veo',
        costEstimate: 0.8,
        costReservationId: 'cost-op-1',
      },
    });

    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
    // Confirm exactly one generation call happened — no second Veo stage.
    expect(mockInteractionsCreate).toHaveBeenCalledTimes(1);
  });
});
