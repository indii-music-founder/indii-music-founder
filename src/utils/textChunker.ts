
/**
 * Smartly chunks text into smaller pieces for RAG ingestion.
 * Respects paragraph and sentence boundaries to preserve semantic meaning.
 */
export function smartChunk(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
    if (!text) return [];
    if (text.length <= maxChunkSize) return [text];

    const chunks: string[] = [];

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = "";

    for (const paragraph of paragraphs) {
        // If paragraph fits in current chunk, add it
        if ((currentChunk.length + paragraph.length + 2) <= maxChunkSize) {
            currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        } else {
            // Paragraph doesn't fit. 
            // If current chunk is not empty, push it and start new.
            if (currentChunk) {
                chunks.push(currentChunk);
                // Start new chunk with overlap if possible (simple overlap is hard with paragraphs, 
                // so we just start fresh or keep last sentence? For now, simple fresh start).
                currentChunk = "";
            }

            // If paragraph itself is too big, split by sentences
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
            } else {
                currentChunk = paragraph;
            }
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}
