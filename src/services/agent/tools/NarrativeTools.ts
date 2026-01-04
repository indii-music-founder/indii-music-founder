import { firebaseAI } from '@/services/ai/FirebaseAIService';
import type { ToolFunctionArgs } from '../types';
import { AI_MODELS } from '@/core/config/ai-models';

// ============================================================================
// Types for NarrativeTools
// ============================================================================

interface GenerateVisualScriptArgs extends ToolFunctionArgs {
    synopsis: string;
}

// ============================================================================
// Helper to extract error message
// ============================================================================

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

// ============================================================================
// NarrativeTools Implementation
// ============================================================================

export const NarrativeTools = {
    generate_visual_script: async (args: GenerateVisualScriptArgs): Promise<string> => {
        try {
            const systemPrompt = `
You are a master filmmaker and narrative structuralist.
Your task is to convert a raw synopsis into a structured 9-beat visual script.
Focus on visual storytelling, camera angles, and emotional beats.

Return ONLY a valid JSON object with the following structure:
{
  "title": "String",
  "logline": "String",
  "beats": [
    {
      "beat": 1,
      "name": "Establishment",
      "description": "Visual description of the scene.",
      "camera": "Shot type (e.g., Wide, Close-up)",
      "mood": "Lighting/Atmosphere"
    },
    ... (up to 9 beats)
  ]
}
`;
            const prompt = `Synopsis: ${args.synopsis}`;

            const schema = {
                type: "object" as const,
                nullable: false,
                properties: {
                    title: { type: "string" as const, nullable: false },
                    logline: { type: "string" as const, nullable: true },
                    beats: {
                        type: "array" as const,
                        nullable: false,
                        items: {
                            type: "object" as const,
                            nullable: false,
                            properties: {
                                beat: { type: "number" as const, nullable: false },
                                name: { type: "string" as const, nullable: false },
                                description: { type: "string" as const, nullable: false },
                                camera: { type: "string" as const, nullable: true },
                                mood: { type: "string" as const, nullable: true }
                            },
                            required: ["beat", "name", "description"] as const
                        }
                    }
                },
                required: ["title", "beats"] as const
            };

            const response = await firebaseAI.generateStructuredData(
                [{ text: prompt }],
                schema,
                undefined,
                systemPrompt
            );

            return JSON.stringify(response, null, 2);

        } catch (e: unknown) {
            return `Failed to generate script: ${getErrorMessage(e)}`;
        }
    }
};
