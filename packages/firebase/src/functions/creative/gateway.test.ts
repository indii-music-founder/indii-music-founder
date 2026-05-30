import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateContent = vi.fn();
const mockGenerateVideos = vi.fn();
const mockGetVideosOperation = vi.fn();
const mockDownload = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockSave = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return {
      models: {
        generateContent: mockGenerateContent,
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
  onCall: vi.fn((_options, handler) => handler),
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
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => ({
        id: id || 'job-123',
        set: mockSet,
        update: mockUpdate,
      })),
    })),
  })),
  storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      name: 'test-bucket',
      file: vi.fn(() => ({
        save: mockSave,
      })),
    })),
  })),
}));

vi.mock('../../config/secrets', () => ({
  geminiApiKey: {},
  getGeminiApiKey: vi.fn(() => 'test-gemini-key'),
}));

import { generateImageV3, generateOmniRemixV3, generateVideoV3 } from './gateway';

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
  });

  it('honors fast model settings and extracts image data after text parts', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{
        content: {
          parts: [
            { thought: true, inlineData: { data: Buffer.from('draft-image').toString('base64'), mimeType: 'image/png' } },
            { text: 'Composing final image.' },
            { inlineData: { data: Buffer.from('image-bytes').toString('base64'), mimeType: 'image/png' } },
          ],
        },
      }],
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

    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ role: 'user', parts: [{ text: 'Dogs having fun' }] }],
      config: expect.objectContaining({
        responseModalities: ['IMAGE'],
        imageConfig: expect.objectContaining({ aspectRatio: '16:9', imageSize: '2K' }),
        thinkingConfig: { thinkingLevel: 'Minimal' },
        tools: [{ googleSearch: {} }],
      }),
    }));
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('image-bytes'), expect.objectContaining({ contentType: 'image/png' }));
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
  });

  it('maps Google model availability failures to actionable callable errors', async () => {
    mockGenerateContent.mockRejectedValueOnce(Object.assign(
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
});

describe('creative gateway generateVideoV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes video generation through Veo generateVideos and stores returned bytes', async () => {
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
      },
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
    expect(mockGetVideosOperation).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith(Buffer.from('video-bytes'), expect.objectContaining({ contentType: 'video/mp4' }));
    expect(result).toEqual(expect.objectContaining({
      jobId: 'job-123',
      resultUri: expect.stringContaining('gs://test-bucket/creative/user-123/'),
    }));
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

    await expect(callGenerateVideo({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'blocked clip',
        aspectRatio: '16:9',
        model: 'pro',
      },
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
  });

  it('fails honestly until the Gemini Omni Flash API model is configured', async () => {
    await expect(callGenerateOmniRemix({
      auth: { uid: 'user-123' },
      data: {
        prompt: 'Edit this performance with beat-synced neon effects',
        referenceVideoUri: 'gs://test-bucket/base/performance.mp4',
      },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('Gemini Omni Flash is not configured'),
    });
    expect(mockGenerateVideos).not.toHaveBeenCalled();
  });
});
