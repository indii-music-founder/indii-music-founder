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
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.VERTEX_PROJECT_ID;
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
      httpOptions: { baseUrl: 'https://aiplatform.googleapis.com', apiVersion: 'v1beta1' },
    }));
  });

  it('keeps Vertex multi-region locations on their replica hosts', async () => {
    const { getVertexAIBaseUrl, getVertexAIClient } = await import('./vertexClient');

    expect(getVertexAIBaseUrl('us')).toBe('https://aiplatform.us.rep.googleapis.com');
    getVertexAIClient('148015878263', 'us');

    expect(mockGoogleGenAI).toHaveBeenCalledWith(expect.objectContaining({
      vertexai: true,
      project: '148015878263',
      location: 'us',
      httpOptions: { baseUrl: 'https://aiplatform.us.rep.googleapis.com', apiVersion: 'v1beta1' },
    }));
  });

  it('keeps regional locations on regional hosts', async () => {
    const { getVertexAIClient } = await import('./vertexClient');

    getVertexAIClient('test-project', 'us-central1');

    expect(mockGoogleGenAI).toHaveBeenCalledWith(expect.objectContaining({
      vertexai: true,
      project: 'test-project',
      location: 'us-central1',
      httpOptions: { baseUrl: 'https://us-central1-aiplatform.googleapis.com', apiVersion: 'v1beta1' },
    }));
  });
  it('reuses a client for the same project and location without changing credentials', async () => {
    const { getVertexAIClient } = await import('./vertexClient');
    const first = getVertexAIClient('test-project', 'us');
    const second = getVertexAIClient('test-project', 'us');
    expect(second).toBe(first);
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(1);
  });

  it('does not share clients between different projects or locations', async () => {
    const { getVertexAIClient } = await import('./vertexClient');
    const a = getVertexAIClient('project-a', 'us');
    const b = getVertexAIClient('project-b', 'us');
    const c = getVertexAIClient('project-a', 'eu');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(mockGoogleGenAI).toHaveBeenCalledTimes(3);
  });

});
