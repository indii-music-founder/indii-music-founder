import { describe, expect, it } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { readKnowledgeEmbedding } from './vectorEncoding';
import { cosineSimilarityRelevance } from './evidenceJudgment';

describe('Knowledge Firestore vector encoding', () => {
  it('reads real SDK vectors for relevance without discarding grounded evidence', () => {
    const vector = FieldValue.vector([1, 0, 0]);
    expect(readKnowledgeEmbedding(vector)).toEqual([1, 0, 0]);
    expect(cosineSimilarityRelevance([1, 0, 0], readKnowledgeEmbedding(vector))).toBe(1);
  });
  it('reads legacy numeric arrays but fails closed for unusable data', () => {
    expect(readKnowledgeEmbedding([0, 1])).toEqual([0, 1]);
    for (const value of [null, {}, 'vector', [1, 'bad']]) {
      expect(readKnowledgeEmbedding(value)).toEqual([]);
      expect(cosineSimilarityRelevance([1, 0], readKnowledgeEmbedding(value))).toBeNull();
    }
  });
});
