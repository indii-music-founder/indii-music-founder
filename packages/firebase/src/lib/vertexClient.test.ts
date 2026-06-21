import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGoogleGenAI = vi.fn(function GoogleGenAI(options: unknown) {
  return { options };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

describe('vertexClient', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockGoogleGenAI.mockClear();
    delete process.env.VITE_VERTEX_PROJECT_ID;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.VITE_VERTEX_LOCATION;
    delete process.env.VERTEX_LOCATION;

    const { resetVertexAIClient } = await import('./vertexClient');
    resetVertexAIClient();
  });

  it('uses the unprefixed global host for the global location', async () => {
    const { getVertexAIClient } = await import('./vertexClient');

    getVertexAIClient('test-project', 'global');

    expect(mockGoogleGenAI).toHaveBeenCalledWith(expect.objectContaining({
      vertexai: true,
      project: 'test-project',
      location: 'global',
      httpOptions: { baseUrl: 'https://aiplatform.googleapis.com' },
    }));
  });

  it('maps Vertex multi-region endpoint locations to a valid client host', async () => {
    const { getVertexAIClient, normalizeVertexClientLocation } = await import('./vertexClient');

    expect(normalizeVertexClientLocation('us')).toBe('global');
    getVertexAIClient('148015878263', 'us');

    expect(mockGoogleGenAI).toHaveBeenCalledWith(expect.objectContaining({
      vertexai: true,
      project: '148015878263',
      location: 'global',
      httpOptions: { baseUrl: 'https://aiplatform.googleapis.com' },
    }));
  });

  it('keeps regional locations on regional hosts', async () => {
    const { getVertexAIClient } = await import('./vertexClient');

    getVertexAIClient('test-project', 'us-central1');

    expect(mockGoogleGenAI).toHaveBeenCalledWith(expect.objectContaining({
      vertexai: true,
      project: 'test-project',
      location: 'us-central1',
      httpOptions: { baseUrl: 'https://us-central1-aiplatform.googleapis.com' },
    }));
  });
});
