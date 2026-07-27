import { createHash } from 'node:crypto';
import type { ExtractedPage } from './textExtractor';

export interface GeneratedChunk {
  chunkId: string;
  documentId: string;
  uid: string;
  ordinal: number;
  text: string;
  startOffset: number;
  endOffset: number;
  pageNumber?: number;
  chunkHash: string;
}

const TARGET_CHUNK_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200;

export function chunkDocumentPages(
  documentId: string,
  uid: string,
  pages: ExtractedPage[],
): GeneratedChunk[] {
  const chunks: GeneratedChunk[] = [];
  let globalOrdinal = 0;
  let currentOffset = 0;

  for (const page of pages) {
    const pageText = page.text.trim();
    if (!pageText) continue;

    let start = 0;
    while (start < pageText.length) {
      let end = start + TARGET_CHUNK_CHARS;

      if (end < pageText.length) {
        // Try to break at paragraph boundary, sentence boundary, or whitespace
        const paraBreak = pageText.lastIndexOf('\n\n', end);
        const sentenceBreak = pageText.lastIndexOf('. ', end);
        const spaceBreak = pageText.lastIndexOf(' ', end);

        if (paraBreak > start + TARGET_CHUNK_CHARS / 2) {
          end = paraBreak + 2;
        } else if (sentenceBreak > start + TARGET_CHUNK_CHARS / 2) {
          end = sentenceBreak + 2;
        } else if (spaceBreak > start + TARGET_CHUNK_CHARS / 2) {
          end = spaceBreak + 1;
        }
      } else {
        end = pageText.length;
      }

      const chunkText = pageText.slice(start, end).trim();

      if (chunkText.length > 0) {
        const chunkHash = createHash('sha256')
          .update(`${documentId}:${globalOrdinal}:${chunkText}`)
          .digest('hex');

        const chunkId = `chk_${createHash('sha256')
          .update(`${documentId}:${globalOrdinal}`)
          .digest('hex')
          .slice(0, 16)}`;

        chunks.push({
          chunkId,
          documentId,
          uid,
          ordinal: globalOrdinal,
          text: chunkText,
          startOffset: currentOffset + start,
          endOffset: currentOffset + end,
          pageNumber: page.pageNumber,
          chunkHash,
        });

        globalOrdinal++;
      }

      if (end >= pageText.length) {
        break;
      }

      // Advance with overlap
      start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS);
    }

    currentOffset += pageText.length + 2; // Account for page break separator
  }

  return chunks;
}
