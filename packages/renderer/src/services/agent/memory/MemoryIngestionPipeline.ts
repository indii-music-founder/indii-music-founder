import { FirebaseAIService as AIService } from '../../ai/FirebaseAIService';
import { AI_MODELS, APPROVED_MODELS } from '@/core/config/ai-models';
import { RequestBatcher } from '@/utils/RequestBatcher';
import { logger } from '@/utils/logger';
import type { Content, GenerationConfig } from 'firebase/ai';
import { MemorySummarizer } from './MemorySummarizer';
import type {
    AlwaysOnMemory,
    AlwaysOnMemoryCategory,
    IngestionContentType,
    IngestionStatus,
    MemoryEntity,
    MemorySource,
} from '@/types/AlwaysOnMemory';
import {
    MAX_INLINE_FILE_SIZE_BYTES,
} from '@/types/AlwaysOnMemory';
import { Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

interface IngestTextInput {
    text: string;
    source?: string;
    category?: AlwaysOnMemoryCategory;
}

interface IngestFileInput {
    fileBytes: Uint8Array;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
}

interface IngestResult {
    success: boolean;
    memoryId?: string;
    summary?: string;
    error?: string;
    skipped?: boolean;
    skipReason?: string;
}

// ============================================================================
// PIPELINE
// ============================================================================

/**
 * MemoryIngestionPipeline — Multimodal ingestion handler for the Always-On Memory Agent.
 *
 * Accepts text, images, audio, video, and PDFs. Uses Gemini's multimodal capabilities
 * to extract structured information from all media types. Performs deduplication,
 * entity extraction, topic assignment, and importance scoring before storing.
 *
 * Inspired by Google's IngestAgent but improved with:
 * - Deduplication against existing memories
 * - Multi-step extraction pipeline (summarize → entities → topics → importance)
 * - Category auto-classification
 * - Embedding generation for vector search
 * - Ingestion event logging
 */
export class MemoryIngestionPipeline {
    private embeddingBatcher: RequestBatcher<string, number[]>;

    constructor() {
        this.embeddingBatcher = new RequestBatcher<string, number[]>(
            async (texts: string[]) => {
                try {
                    const results = await AIService.getInstance().batchEmbedContents(
                        texts,
                        APPROVED_MODELS.EMBEDDING_DEFAULT
                    );
                    return results;
                } catch (error: unknown) {
                    logger.error('[MemoryIngestionPipeline] Batch embedding failed:', error);
                    return texts.map(() => []);
                }
            },
            { maxBatchSize: 10, maxWaitMs: 100 }
        );
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Ingest raw text content into the memory system.
     *
     * @param userId - The user who owns this memory
     * @param input - Text content and metadata
     * @returns Ingestion result with memory ID if successful
     */
    async ingestText(userId: string, input: IngestTextInput): Promise<IngestResult> {
        const { text, source = 'user_input', category } = input;

        if (!text.trim()) {
            return { success: false, error: 'Empty text content' };
        }

        // Log the ingestion event
        const eventId = await this.logIngestionEvent(userId, {
            contentType: 'text',
            source,
            status: 'processing',
        });

        try {
            // Step 1: Deduplication check
            const isDuplicate = await this.checkDuplicate(userId, text);
            if (isDuplicate) {
                await this.updateIngestionEvent(userId, eventId, {
                    status: 'skipped',
                    errorMessage: 'Duplicate content detected',
                });
                logger.info(`[MemoryIngestionPipeline] Skipped duplicate: ${text.slice(0, 60)}...`);
                return { success: true, skipped: true, skipReason: 'duplicate' };
            }

            // Step 2: Extract structure using Gemini
            const extracted = await this.extractStructure(text, source);

            // Step 3: Override category if provided
            const finalCategory = category || extracted.category;

            // Step 4: Generate embedding for vector search
            const embedding = await this.generateEmbedding(extracted.summary || text);

            // Step 5: Store the memory
            const memoryId = await this.storeMemory(userId, {
                content: extracted.summary,
                rawText: text,
                summary: extracted.summary,
                category: finalCategory,
                entities: extracted.entities,
                topics: extracted.topics,
                importance: extracted.importance,
                source: source as MemorySource,
                sourceFileName: source !== 'user_input' ? source : undefined,
                embedding,
                tags: extracted.topics,
            });

            // Step 6: Update ingestion event
            await this.updateIngestionEvent(userId, eventId, {
                status: 'completed',
                resultMemoryId: memoryId,
            });

            logger.info(`[MemoryIngestionPipeline] 📥 Stored memory: ${extracted.summary.slice(0, 60)}...`);

            return {
                success: true,
                memoryId,
                summary: extracted.summary,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.updateIngestionEvent(userId, eventId, {
                status: 'failed',
                errorMessage,
            });
            logger.error('[MemoryIngestionPipeline] Ingestion failed:', error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Ingest a media file (image, audio, video, PDF) into the memory system.
     * Uses Gemini's multimodal capabilities for content extraction.
     *
     * @param userId - The user who owns this memory
     * @param input - File bytes, name, and MIME type
     * @returns Ingestion result with memory ID if successful
     */
    async ingestFile(userId: string, input: IngestFileInput): Promise<IngestResult> {
        const { fileBytes, fileName, mimeType, sizeBytes } = input;

        // Validate file size
        if (sizeBytes > MAX_INLINE_FILE_SIZE_BYTES) {
            const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
            logger.warn(`[MemoryIngestionPipeline] ⚠️ Skipping ${fileName} (${sizeMB}MB) — exceeds 20MB limit`);
            return {
                success: false,
                error: `File too large (${sizeMB}MB). Maximum is 20MB for inline processing.`,
            };
        }

        // Determine content type
        const contentType = this.getContentType(mimeType);

        // Log ingestion event
        const eventId = await this.logIngestionEvent(userId, {
            contentType,
            source: fileName,
            mimeType,
            sizeBytes,
            status: 'processing',
        });

        try {
            // Step 1: Use Gemini multimodal to analyze the file
            const description = await this.analyzeMediaFile(fileBytes, mimeType, fileName);

            if (!description.trim()) {
                await this.updateIngestionEvent(userId, eventId, {
                    status: 'failed',
                    errorMessage: 'Could not extract meaningful content from file',
                });
                return { success: false, error: 'No content extracted from file' };
            }

            // Step 2: Extract structure from the description
            const extracted = await this.extractStructure(description, fileName);

            // Step 3: Generate embedding
            const embedding = await this.generateEmbedding(extracted.summary || description);

            // Step 4: Store the memory
            const memoryId = await this.storeMemory(userId, {
                content: extracted.summary,
                rawText: description,
                summary: extracted.summary,
                category: extracted.category,
                entities: extracted.entities,
                topics: extracted.topics,
                importance: extracted.importance,
                source: 'file_ingestion',
                sourceFileName: fileName,
                sourceMimeType: mimeType,
                embedding,
                tags: [...extracted.topics, contentType],
            });

            // Step 5: Update ingestion event
            await this.updateIngestionEvent(userId, eventId, {
                status: 'completed',
                resultMemoryId: memoryId,
            });

            const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
            logger.info(`[MemoryIngestionPipeline] 🔮 Ingested ${contentType}: ${fileName} (${sizeMB}MB)`);

            return {
                success: true,
                memoryId,
                summary: extracted.summary,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.updateIngestionEvent(userId, eventId, {
                status: 'failed',
                errorMessage,
            });
            logger.error(`[MemoryIngestionPipeline] File ingestion failed for ${fileName}:`, error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Ingest messages from an agent conversation session.
     * Extracts key facts, preferences, and decisions from the conversation history.
     *
     * @param userId - The user who owns these memories
     * @param messages - Array of conversation messages
     * @param sessionId - The session ID for source tracking
     * @returns Array of ingestion results
     */
    async ingestFromSession(
        userId: string,
        messages: Array<{ role: string; text: string }>,
        sessionId: string
    ): Promise<IngestResult[]> {
        if (messages.length === 0) return [];

        try {
            // Compile the conversation into a single text block
            const conversationText = messages
                .map(m => `[${m.role}]: ${m.text}`)
                .join('\n')
                .slice(0, 8000); // Limit context window usage

            // Use Gemini to extract memorable facts from the conversation
            const prompt = `You are a Memory Extraction Agent for a creative music/visual production platform.
Analyze this conversation and extract discrete, memorable facts, preferences, decisions, and goals.

CONVERSATION:
${conversationText}

For each memory, provide:
- content: The fact/preference/decision (1-2 sentences, standalone)
- category: One of: preference, fact, context, goal, skill, interaction, feedback, relationship, creative, business, technical
- importance: 0.0 to 1.0

Respond in JSON format:
{
  "memories": [
    {"content": "...", "category": "...", "importance": 0.X}
  ]
}

Rules:
- Only extract NEW information that wasn't previously known
- Prefer specific, actionable facts over general observations
- Skip small talk, greetings, and procedural exchanges
- Return an empty array if nothing worth remembering was said`;

            const response = await AIService.getInstance().generateText(
                prompt,
                0,
                {
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                } as Record<string, unknown>
            );

            const parsed = JSON.parse(response);
            const extractedMemories = parsed.memories || [];

            // Ingest each extracted memory
            const results: IngestResult[] = [];
            for (const mem of extractedMemories.slice(0, 10)) { // Cap at 10 per session
                const result = await this.ingestText(userId, {
                    text: mem.content,
                    source: `session:${sessionId}`,
                    category: mem.category,
                });
                results.push(result);
            }

            logger.info(
                `[MemoryIngestionPipeline] Extracted ${results.filter(r => r.success && !r.skipped).length} ` +
                `memories from session ${sessionId}`
            );

            return results;
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Session ingestion failed:', error);
            return [];
        }
    }

    // ========================================================================
    // PRIVATE - EXTRACTION
    // ========================================================================

    /**
     * Extract structured information from raw text using Gemini.
     * Runs entity extraction, topic assignment, importance scoring, and categorization.
     */
    private async extractStructure(text: string, source: string): Promise<{
        summary: string;
        entities: MemoryEntity[];
        topics: string[];
        importance: number;
        category: AlwaysOnMemoryCategory;
    }> {
        // Run extraction steps in parallel for speed
        const [entities, topics, importance, summary, category] = await Promise.all([
            MemorySummarizer.extractEntities(text),
            MemorySummarizer.assignTopics(text),
            MemorySummarizer.scoreImportance(text),
            this.generateSummary(text),
            this.classifyCategory(text, source),
        ]);

        return { summary, entities, topics, importance, category };
    }

    /**
     * Generate a concise 1-2 sentence summary of the content.
     */
    private async generateSummary(text: string): Promise<string> {
        if (text.length < 200) return text;

        try {
            const prompt = `Summarize the following in 1-2 concise sentences. Preserve specific details like names, numbers, and dates.

TEXT:
${text.slice(0, 4000)}

SUMMARY:`;

            const summary = await AIService.getInstance().generateText(
                prompt,
                0,
                { temperature: 0.2 } as Record<string, unknown>
            );

            return summary.trim();
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Summary generation failed:', error);
            return text.slice(0, 200);
        }
    }

    /**
     * Auto-classify the category of a piece of content.
     */
    private async classifyCategory(text: string, source: string): Promise<AlwaysOnMemoryCategory> {
        try {
            const prompt = `Classify this text into exactly ONE category:
- preference: User preferences and settings
- fact: Facts about the user or their work
- context: Current working context
- goal: Goals and objectives
- skill: Skills and expertise
- interaction: Communication patterns
- feedback: Corrections or complaints
- relationship: Social/professional relationships
- creative: Creative decisions (art direction, sound design, visual style)
- business: Business information (contracts, revenue, distribution, deadlines)
- technical: Technical specifications (audio formats, mastering specs, export settings)

TEXT (source: ${source}):
${text.slice(0, 2000)}

Respond with ONLY a JSON object: {"category": "<category>"}`;

            const response = await AIService.getInstance().generateText(
                prompt,
                0,
                {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                } as Record<string, unknown>
            );

            const parsed = JSON.parse(response);
            return parsed.category || 'fact';
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Category classification failed:', error);
            return 'fact';
        }
    }

    /**
     * Analyze a media file using Gemini's multimodal capabilities.
     * Sends file bytes + prompt to get a detailed text description.
     */
    private async analyzeMediaFile(
        fileBytes: Uint8Array,
        mimeType: string,
        fileName: string
    ): Promise<string> {
        try {
            const mediaType = mimeType.split('/')[0]; // image, audio, video, application

            const prompt =
                `You are a Memory Ingest Agent. Thoroughly analyze this ${mediaType} file (${fileName}) and ` +
                `extract ALL meaningful information for memory storage.\n\n` +
                `For images: describe the scene, objects, text, people, colors, style, mood, and any visual details.\n` +
                `For audio: describe the spoken content, sounds, mood, genre, tempo, key, and instrumentation.\n` +
                `For video: describe the visual scenes, spoken content, sounds, key moments, and narrative.\n` +
                `For PDFs: extract and summarize the document content, key data points, and any tables/figures.\n\n` +
                `Provide a comprehensive description that preserves all important details.`;

            // Use Firebase AI Service for multimodal content
            const result = await AIService.getInstance().generateContent(
                [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: this.uint8ArrayToBase64(fileBytes),
                                mimeType,
                            },
                        },
                    ],
                }] as Content[],
                AI_MODELS.TEXT.FAST,
                { temperature: 0.3 } as GenerationConfig,
            );

            // Extract text from response
            const responseText = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text
                || result?.response?.text?.()
                || '';

            return typeof responseText === 'string' ? responseText : String(responseText);
        } catch (error: unknown) {
            logger.error(`[MemoryIngestionPipeline] Media analysis failed for ${fileName}:`, error);
            return '';
        }
    }

    // ========================================================================
    // PRIVATE - STORAGE
    // ========================================================================

    /**
     * Store a processed memory in Firestore.
     */
    private async storeMemory(
        userId: string,
        data: Partial<AlwaysOnMemory>
    ): Promise<string> {
        const now = Timestamp.now();
        const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');

        const docData = {
            content: data.content || '',
            rawText: data.rawText || data.content || '',
            summary: data.summary || data.content || '',
            category: data.category || 'fact',
            tier: 'working' as const,
            entities: (data.entities || []).map(e => ({
                name: e.name,
                type: e.type,
                mentionCount: e.mentionCount || 1,
            })),
            topics: data.topics || [],
            importance: data.importance || 0.5,
            source: data.source || 'user_input',
            sourceSessionId: data.sourceSessionId || null,
            sourceProjectId: data.sourceProjectId || null,
            sourceFileName: data.sourceFileName || null,
            sourceMimeType: data.sourceMimeType || null,
            createdAt: now,
            updatedAt: now,
            lastAccessedAt: now,
            accessCount: 0,
            isActive: true,
            consolidated: false,
            connections: [],
            relatedMemoryIds: [],
            embedding: data.embedding || [],
            embeddingModel: APPROVED_MODELS.EMBEDDING_DEFAULT,
            tags: data.tags || [],
        };

        const docRef = await addDoc(memoryRef, docData);
        return docRef.id;
    }

    /**
     * Check if similar content already exists in memory to prevent duplicates.
     */
    private async checkDuplicate(userId: string, text: string): Promise<boolean> {
        try {
            const memoryRef = collection(db, 'users', userId, 'alwaysOnMemories');
            // Check last 50 memories for exact or near-exact content match
            const q = query(
                memoryRef,
                where('isActive', '==', true),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const normalizedInput = text.toLowerCase().trim();

            for (const doc of snapshot.docs) {
                const existing = doc.data();
                const existingContent = (existing.content || '').toLowerCase().trim();
                const existingRaw = (existing.rawText || '').toLowerCase().trim();

                // Exact match
                if (existingContent === normalizedInput || existingRaw === normalizedInput) {
                    return true;
                }

                // Near-duplicate: check if >90% of words overlap
                const inputWords = new Set(normalizedInput.split(/\s+/));
                const existingWords = new Set(existingContent.split(/\s+/));
                if (inputWords.size > 5 && existingWords.size > 5) {
                    const intersection = [...inputWords].filter(w => existingWords.has(w));
                    const overlap = intersection.length / Math.max(inputWords.size, existingWords.size);
                    if (overlap > 0.9) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Deduplication check failed:', error);
            return false; // Don't block ingestion on dedupe failure
        }
    }

    /**
     * Generate embedding vector for semantic search.
     */
    private async generateEmbedding(text: string): Promise<number[]> {
        try {
            return await this.embeddingBatcher.add(text);
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Embedding generation failed:', error);
            return [];
        }
    }

    // ========================================================================
    // PRIVATE - INGESTION EVENT LOG
    // ========================================================================

    /**
     * Log an ingestion event for audit trail.
     */
    private async logIngestionEvent(
        userId: string,
        data: {
            contentType: IngestionContentType;
            source: string;
            mimeType?: string;
            sizeBytes?: number;
            status: IngestionStatus;
        }
    ): Promise<string> {
        try {
            const eventRef = collection(db, 'users', userId, 'ingestionEvents');
            const docRef = await addDoc(eventRef, {
                ...data,
                createdAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Failed to log ingestion event:', error);
            return '';
        }
    }

    /**
     * Update an ingestion event's status.
     */
    private async updateIngestionEvent(
        userId: string,
        eventId: string,
        updates: {
            status: IngestionStatus;
            resultMemoryId?: string;
            errorMessage?: string;
        }
    ): Promise<void> {
        if (!eventId) return;

        try {
            const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
            const eventRef = firestoreDoc(db, 'users', userId, 'ingestionEvents', eventId);
            await updateDoc(eventRef, {
                ...updates,
                processedAt: serverTimestamp(),
            });
        } catch (error: unknown) {
            logger.error('[MemoryIngestionPipeline] Failed to update ingestion event:', error);
        }
    }

    // ========================================================================
    // PRIVATE - UTILITIES
    // ========================================================================

    /**
     * Determine the broad content type from a MIME type.
     */
    private getContentType(mimeType: string): IngestionContentType {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'text';
        return 'structured_data';
    }

    /**
     * Convert Uint8Array to base64 string for Gemini inline data.
     */
    private uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    }
}

// Singleton instance
export const memoryIngestionPipeline = new MemoryIngestionPipeline();
