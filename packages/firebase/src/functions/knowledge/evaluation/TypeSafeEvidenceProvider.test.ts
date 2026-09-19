import { describe, expect, it, vi } from 'vitest';
import type { EvidenceJudgmentRequest } from '../evidenceJudgment';
import { TypeSafeEvidenceProvider } from './TypeSafeEvidenceProvider';

const request: EvidenceJudgmentRequest = {
  query: 'Who controls the master recording?',
  candidates: [
    {
      id: 'candidate-a',
      documentId: 'private-doc-a',
      text: 'The artist retains 100% ownership of the sound recording master.',
      vectorScore: 0.71,
    },
    {
      id: 'candidate-b',
      documentId: 'private-doc-b',
      text: 'The master campaign calendar starts next week.',
      vectorScore: 0.93,
    },
  ],
};

describe('TypeSafeEvidenceProvider', () => {
  it('maps Noul probabilities onto indii-owned evidence judgments', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      model: 'jev-latest',
      answers: {
        candidate_0: { type: 'noul', noul: 0.96 },
        candidate_1: { type: 'noul', noul: 0.08 },
      },
      usage: { input_tokens: 50, output_tokens: 2 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const provider = new TypeSafeEvidenceProvider({
      apiKey: 'synthetic-test-key',
      fetchImpl,
    });

    await expect(provider.judgeRelevance(request)).resolves.toEqual([
      { candidateId: 'candidate-a', relevance: 0.96 },
      { candidateId: 'candidate-b', relevance: 0.08 },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer synthetic-test-key');

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('jev-latest');
    expect(body.state).toEqual({
      query: request.query,
      candidates: [
        { ref: 'candidate_0', text: request.candidates[0]!.text },
        { ref: 'candidate_1', text: request.candidates[1]!.text },
      ],
    });
    expect(body.questions.candidate_0.type).toBe('noul');
    expect(body.questions.candidate_1.type).toBe('noul');

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('private-doc-a');
    expect(serialized).not.toContain('private-doc-b');
    expect(serialized).not.toContain('0.71');
    expect(serialized).not.toContain('0.93');
  });

  it('rejects malformed probabilities instead of normalizing provider errors', async () => {
    const provider = new TypeSafeEvidenceProvider({
      apiKey: 'synthetic-test-key',
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        answers: {
          candidate_0: { type: 'noul', noul: 1.4 },
          candidate_1: { type: 'noul', noul: 0.1 },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })),
    });

    await expect(provider.judgeRelevance(request)).rejects.toThrow(
      'invalid Noul answer for candidate_0',
    );
  });

  it('does not expose the API key when the provider returns an HTTP error', async () => {
    const provider = new TypeSafeEvidenceProvider({
      apiKey: 'never-log-this-key',
      fetchImpl: vi.fn(async () => new Response('unauthorized', {
        status: 401,
        headers: { 'x-typesafe-request-id': 'req-test-123' },
      })),
    });

    let message = '';
    try {
      await provider.judgeRelevance(request);
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('HTTP 401');
    expect(message).toContain('req-test-123');
    expect(message).not.toContain('never-log-this-key');
  });

  it('refuses empty keys and oversized candidate batches before any request', async () => {
    expect(() => new TypeSafeEvidenceProvider({ apiKey: '   ' })).toThrow('non-empty API key');

    const fetchImpl = vi.fn();
    const provider = new TypeSafeEvidenceProvider({
      apiKey: 'synthetic-test-key',
      fetchImpl,
    });
    const oversized = {
      query: 'test',
      candidates: Array.from({ length: 21 }, (_, index) => ({
        id: `c-${index}`,
        documentId: `d-${index}`,
        text: `candidate ${index}`,
        vectorScore: 0.5,
      })),
    };

    await expect(provider.judgeRelevance(oversized)).rejects.toThrow('at most 20 candidates');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
