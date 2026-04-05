/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import { FirebaseAIService as AIService } from '../../ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';
import type { GenerationConfig } from '@/shared/types/ai.dto';
import type { AlwaysOnMemory, MemoryEntity, ConsolidationInsight, MemoryConnection } from '@/types/AlwaysOnMemory';
import { Timestamp } from 'firebase/firestore';

/**
 * Robust JSON parser for AI responses.
 * Strips markdown code fences (`\`\`\`json ... \`\`\``) and trims whitespace
 * before parsing. Returns a default value on failure instead of throwing.
 */
function safeParseJson<T>(raw: string, fallback: T): T {
    try {
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
        return JSON.parse(cleaned) as T;
    } catch {
        // Attempt to find the first { or [ and parse from there
        const firstBrace = raw.indexOf('{');
        const firstBracket = raw.indexOf('[');
        const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
            ? firstBrace : firstBracket;
        if (start >= 0) {
            try {
                return JSON.parse(raw.slice(start)) as T;
            } catch {
                // Final fallback
            }
        }
        logger.warn('[MemorySummarizer] Failed to parse AI JSON response:', raw.slice(0, 200));
        return fallback;
    }
}

/**
 * MemorySummarizer handles the logic for condensing multiple memory entries
 * into a single, cohesive summary, extracting entities and topics, and
 * generating cross-cutting insights during consolidation.
 *
 * Upgraded from the original 44-line version to support the Always-On Memory Agent
 * with entity extraction, topic assignment, and insight generation.
 */
export class MemorySummarizer {
    /**
     * Generates a topical summary of a set of memory entries.
     */
    public static async summarizeMemories(memories: Array<{ content: string; type?: string }>): Promise<string> {
        if (memories.length === 0) return '';
        if (memories.length === 1) return memories[0]!.content;

        try {
            const memoryText = memories.map(m => `- [${m.type || 'fact'}] ${m.content}`).join('\n');
            const prompt = `
Summarize the following user memories into a concise, high-density paragraph. 
Focus on recurring preferences, key facts, and established rules.
Do not lose specific details like artist names, technical requirements, or visual styles.

MEMORIES:
${memoryText}

SUMMARY:
`;

            const summary = await AIService.getInstance().generateText(
                prompt,
                0,
                { temperature: 0.2 } as Record<string, unknown>
            );

            return summary;
        } catch (error: unknown) {
            logger.error('[MemorySummarizer] Summarization failed:', error);
            return memories.slice(0, 5).map(m => m.content).join('. ');
        }
    }

    /**
     * Generates a cross-cutting insight from a set of related memories.
     * This is the "aha!" moment — finding patterns humans wouldn't spot manually.
     *
     * @param memories - The set of memories to analyze
     * @returns A ConsolidationInsight or null if no meaningful insight was found
     */
    public static async generateInsight(
        userId: string,
        memories: AlwaysOnMemory[]
    ): Promise<Omit<ConsolidationInsight, 'id'> | null> {
        if (memories.length < 2) return null;

        try {
            const memoryBlock = memories.map((m, i) =>
                `Memory #${m.id} (${m.category}, importance: ${m.importance.toFixed(2)}):\n` +
                `  Summary: ${m.summary}\n` +
                `  Entities: [${m.entities.map(e => e.name).join(', ')}]\n` +
                `  Topics: [${m.topics.join(', ')}]`
            ).join('\n\n');

            const prompt = `You are a Memory Consolidation Agent for a creative music/visual production platform.
Analyze these memories and find meaningful connections and cross-cutting insights.

MEMORIES:
${memoryBlock}

Respond in JSON format:
{
  "summary": "A synthesized summary across all memories (1-2 sentences)",
  "insight": "One key pattern, connection, or strategic insight you discovered (1-2 sentences)",
  "connections": [
    {
      "fromMemoryId": "<id>",
      "toMemoryId": "<id>",
      "relationship": "<description of how they're connected>"
    }
  ],
  "confidence": 0.0-1.0
}

If no meaningful connections exist, return {"summary": "", "insight": "", "connections": [], "confidence": 0.0}.
Be specific and actionable. Focus on creative workflow, branding, distribution, and business patterns.`;

            const response = await AIService.getInstance().generateText(
                prompt,
                0,
                {
                    temperature: 0.3,
                    responseMimeType: 'application/json',
                } as Record<string, unknown>
            );

            const parsed = safeParseJson(response, { insight: '', summary: '', confidence: 0, connections: [] });

            if (!parsed.insight || parsed.confidence < 0.3) {
                return null;
            }

            const now = Timestamp.now();
            const connections: MemoryConnection[] = (parsed.connections || []).map((c: any) => ({
                fromMemoryId: String(c.fromMemoryId),
                toMemoryId: String(c.toMemoryId),
                relationship: String(c.relationship),
                confidence: parsed.confidence,
                discoveredAt: now,
            }));

            return {
                userId,
                sourceMemoryIds: memories.map(m => m.id),
                summary: parsed.summary,
                insight: parsed.insight,
                connections,
                createdAt: now,
                confidence: parsed.confidence,
            };
        } catch (error: unknown) {
            logger.error('[MemorySummarizer] Insight generation failed:', error);
            return null;
        }
    }

    /**
     * Extracts named entities from a text block using Gemini.
     * Entities are people, companies, products, concepts, locations, genres, tools.
     *
     * @param text - The text to extract entities from
     * @returns Array of extracted entities
     */
    public static async extractEntities(text: string): Promise<MemoryEntity[]> {
        if (!text.trim()) return [];

        try {
            const prompt = `Extract named entities from the following text. 
Categorize each entity as one of: person, company, product, concept, location, genre, tool, other.

TEXT:
${text.slice(0, 4000)}

Respond in JSON format:
{
  "entities": [
    {"name": "Entity Name", "type": "person|company|product|concept|location|genre|tool|other"}
  ]
}

Only include clearly identifiable entities. Be precise with names. Return an empty array if no clear entities exist.`;

            const response = await AIService.getInstance().generateText(
                prompt,
                0,
                {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                } as Record<string, unknown>
            );

            const parsed = safeParseJson(response, { entities: [] });
            return (parsed.entities || []).map((e: any) => ({
                name: String(e.name),
                type: e.type || 'other',
                mentionCount: 1,
            }));
        } catch (error: unknown) {
            logger.error('[MemorySummarizer] Entity extraction failed:', error);
            return [];
        }
    }

    /**
     * Assigns 2-4 topic tags to a text block using Gemini.
     *
     * @param text - The text to assign topics to
     * @returns Array of topic strings
     */
    public static async assignTopics(text: string): Promise<string[]> {
        if (!text.trim()) return [];

        try {
            const prompt = `Assign 2-4 concise topic tags to the following text.
Topics should be broad categories useful for grouping and searching.
Use lowercase, single-word or hyphenated tags (e.g., "music-production", "branding", "distribution").

TEXT:
${text.slice(0, 4000)}

Respond in JSON format:
{
  "topics": ["tag1", "tag2", "tag3"]
}`;

            const response = await AIService.getInstance().generateText(
                prompt,
                0,
                {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                } as Record<string, unknown>
            );

            const parsed = safeParseJson(response, { topics: [] });
            return (parsed.topics || []).map((t: any) => String(t).toLowerCase());
        } catch (error: unknown) {
            logger.error('[MemorySummarizer] Topic assignment failed:', error);
            return [];
        }
    }

    /**
     * Assigns an importance score (0.0-1.0) to a piece of content.
     * Higher scores for actionable info, deadlines, preferences, and key decisions.
     *
     * @param text - The text to score
     * @param category - The memory category (used as a signal)
     * @returns Importance score between 0.0 and 1.0
     */
    public static async scoreImportance(text: string, category: string = 'fact'): Promise<number> {
        if (!text.trim()) return 0.3;

        try {
            const prompt = `Rate the importance of the following information for a music/visual creative professional.
Score from 0.0 (trivial) to 1.0 (critical).

Higher scores for:
- Actionable deadlines or dates
- Core preferences and creative vision
- Business-critical information (contracts, revenue, distribution)
- Explicit user corrections or feedback
- Key relationships or collaborations

Lower scores for:
- General knowledge or trivia
- Redundant information
- Temporary or ephemeral context

Category: ${category}

TEXT:
${text.slice(0, 2000)}

Respond with ONLY a JSON object: {"importance": 0.X}`;

            const response = await AIService.getInstance().generateText(
                prompt,
                0,
                {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                } as Record<string, unknown>
            );

            const parsed = safeParseJson(response, { importance: 0.5 });
            const score = parseFloat(String(parsed.importance));
            return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
        } catch (error: unknown) {
            logger.error('[MemorySummarizer] Importance scoring failed:', error);
            return 0.5;
        }
    }
}
