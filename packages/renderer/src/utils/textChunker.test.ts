import { describe, it, expect } from 'vitest';
import { smartChunk } from './textChunker';

describe('smartChunk', () => {
  it('should return an empty array for empty input', () => {
    expect(smartChunk('')).toEqual([]);
    // @ts-expect-error - testing null/undefined if possible in JS but TS will complain
    expect(smartChunk(null)).toEqual([]);
  });

  it('should return the whole text if it is shorter than maxChunkSize', () => {
    const text = 'Hello world';
    expect(smartChunk(text, 100)).toEqual([text]);
  });

  it('should return the whole text if it is exactly maxChunkSize', () => {
    const text = 'a'.repeat(100);
    expect(smartChunk(text, 100)).toEqual([text]);
  });

  it('should split by paragraphs if they exceed maxChunkSize', () => {
    const p1 = 'Paragraph one is here.';
    const p2 = 'Paragraph two is here.';
    const text = `${p1}\n\n${p2}`;

    // Max size enough for p1 but not both
    const chunks = smartChunk(text, 30);
    expect(chunks).toEqual([p1, p2]);
  });

  it('should combine multiple paragraphs into one chunk if they fit', () => {
    const p1 = 'P1.';
    const p2 = 'P2.';
    const p3 = 'P3.';
    const text = `${p1}\n\n${p2}\n\n${p3}`;

    // Fits p1 and p2 but not p3
    // "P1.\n\nP2." is 3+2+3 = 8 chars
    // "P1.\n\nP2.\n\nP3." is 3+2+3+2+3 = 13 chars
    const chunks = smartChunk(text, 10);
    expect(chunks).toEqual(['P1.\n\nP2.', 'P3.']);
  });

  it('should split long paragraphs by sentences', () => {
    const s1 = 'Sentence one. ';
    const s2 = 'Sentence two. ';
    const s3 = 'Sentence three. ';
    const paragraph = s1 + s2 + s3;

    // Max size enough for s1 + s2 but not s3
    // s1 is 14, s2 is 14, s3 is 16. Total 44.
    const chunks = smartChunk(paragraph, 30);
    expect(chunks).toEqual([s1 + s2, s3]);
  });

  it('should handle paragraphs without sentences by taking the whole paragraph (if no matches found)', () => {
    const text = 'This is a long paragraph without any punctuation and it exceeds the limit';
    const chunks = smartChunk(text, 20);
    // The code does: const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) || [paragraph];
    // If no match, it returns [paragraph].
    // Then it tries to add sentence to currentChunk.
    // If sentence > maxChunkSize, it will still add it or split?
    // Let's re-read:
    /*
    if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) || [paragraph];
        for (const sentence of sentences) {
            if ((currentChunk.length + sentence.length) <= maxChunkSize) {
                currentChunk += sentence;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = sentence;
            }
        }
    }
    */
    // If sentence is the whole paragraph and it's > maxChunkSize,
    // it will be pushed as a single chunk that EXCEEDS maxChunkSize?
    // Let's check:
    // if currentChunk (empty) + sentence (long) <= maxChunkSize -> False
    // else: if (currentChunk) -> False. currentChunk = sentence.
    // Loop ends.
    // if (currentChunk) chunks.push(currentChunk).
    // So yes, it can exceed maxChunkSize if it can't find sentences.

    expect(chunks).toEqual([text]);
  });

  it('should handle multiple sentences in a large paragraph correctly', () => {
    const s1 = 'First sentence. '; // 16
    const s2 = 'Second sentence. '; // 17
    const s3 = 'Third sentence. '; // 16
    const text = s1 + s2 + s3;

    const chunks = smartChunk(text, 20);
    expect(chunks).toEqual([s1, s2, s3]);
  });

  it('should respect complex paragraph spacing', () => {
    const text = 'P1\n  \nP2';
    const chunks = smartChunk(text, 5);
    expect(chunks).toEqual(['P1', 'P2']);
  });
});
