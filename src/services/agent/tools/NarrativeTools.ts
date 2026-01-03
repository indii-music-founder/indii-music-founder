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

            const response = await firebaseAI.generateStructuredData(
                [{ text: prompt }],
                {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        logline: { type: "string" },
                        beats: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    beat: { type: "number" },
                                    name: { type: "string" },
                                    description: { type: "string" },
                                    camera: { type: "string" },
                                    mood: { type: "string" }
                                },
                                required: ["beat", "name", "description"]
                            }
                        }
                    },
                    required: ["title", "beats"]
                },
                undefined as any,
                systemPrompt
            );

            return JSON.stringify(response, null, 2);

        } catch (e: unknown) {
            return `Failed to generate script: ${getErrorMessage(e)}`;
        }
    }
};
