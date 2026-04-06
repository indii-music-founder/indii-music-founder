/**
 * SDK Bridge Types — Bridging Firebase AI SDK ↔ @google/genai SDK
 *
 * These interfaces cover shape mismatches between the two SDKs.
 * Extracted from FirebaseAIService.ts for reuse across sub-modules.
 */

import type { GenerativeModel, Content, Part } from 'firebase/ai';
import type {
    ContentPart,
    SafetySetting,
    ToolConfig,
} from '@/shared/types/ai.dto';

// ============================================================================
// SDK Bridge Types
// ============================================================================

/** Vite import.meta.env with optional Google/Gemini API keys */
export interface ImportMetaEnvWithKeys {
    env?: {
        GOOGLE_API_KEY?: string;
        GEMINI_API_KEY?: string;
        [key: string]: string | undefined;
    };
}

/** Shape returned by @google/genai embedContent — differs from Firebase SDK */
export interface GenAIEmbedResult {
    embeddings?: { values: number[] }[];
    embedding?: { values: number[] };
}

/** Extended Part type supporting fileData (used for audio/video analysis) */
export interface FileDataPart {
    fileData: {
        mimeType: string;
        fileUri: string;
    };
}

/** Model options shape accepted by getGenerativeModel */
export interface FirebaseModelOptions {
    model: string;
    generationConfig?: Record<string, unknown>;
    systemInstruction?: string;
    tools?: unknown[];
    toolConfig?: ToolConfig;
    safetySettings?: SafetySetting[];
    cachedContent?: string;
}

/** Result shape from @google/genai generateContent */
export interface GenAIGenerateResult {
    candidates?: unknown[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    text?: string;
}

/** Chunk shape from @google/genai generateContentStream */
export interface GenAIStreamChunk {
    candidates?: { content?: { parts?: unknown[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    text?: string | (() => string);
}

/** Interface for BatchEmbedContentsResponse (missing in SDK types) */
export interface BatchEmbedContentsResponse {
    embeddings: { values: number[] }[];
}

/** Interface for GenerativeModel with batching support */
export interface ExtendedGenerativeModel extends GenerativeModel {
    batchEmbedContents?: (req: { requests: { content: Content, model?: string }[] }) => Promise<BatchEmbedContentsResponse>;
    embedContent?: (req: Content | string) => Promise<{ embedding: { values: number[] } }>;
}

/** Chat message shape used by public API */
export interface ChatMessage {
    role: 'user' | 'model';
    parts: (Part | ContentPart)[];
}
