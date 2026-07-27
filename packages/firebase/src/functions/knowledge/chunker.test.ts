import { describe, it, expect } from 'vitest';
import { chunkDocumentPages } from './chunker';

describe('Document Chunker', () => {
  it('chunks short single-page documents cleanly', () => {
    const pages = [{ pageNumber: 1, text: 'This is a small test document for indii.' }];
    const chunks = chunkDocumentPages('doc-1', 'user-1', pages);

    expect(chunks.length).toBe(1);
    expect(chunks[0]!.ordinal).toBe(0);
    expect(chunks[0]!.documentId).toBe('doc-1');
    expect(chunks[0]!.uid).toBe('user-1');
    expect(chunks[0]!.text).toBe('This is a small test document for indii.');
    expect(chunks[0]!.chunkHash).toHaveLength(64);
  });

  it('splits long text into overlapping chunks deterministically', () => {
    const longText = 'Paragraph one text. '.repeat(150); // ~3000 chars
    const pages = [{ pageNumber: 1, text: longText }];
    const chunks = chunkDocumentPages('doc-2', 'user-1', pages);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.ordinal).toBe(0);
    expect(chunks[1]!.ordinal).toBe(1);
    expect(chunks[0]!.chunkId).not.toBe(chunks[1]!.chunkId);
    expect(chunks[0]!.chunkHash).not.toBe(chunks[1]!.chunkHash);
  });

  it('preserves page numbers across multi-page documents', () => {
    const pages = [
      { pageNumber: 1, text: 'Page 1 content here.' },
      { pageNumber: 2, text: 'Page 2 content here.' },
    ];
    const chunks = chunkDocumentPages('doc-3', 'user-1', pages);

    expect(chunks.length).toBe(2);
    expect(chunks[0]!.pageNumber).toBe(1);
    expect(chunks[1]!.pageNumber).toBe(2);
  });
});
