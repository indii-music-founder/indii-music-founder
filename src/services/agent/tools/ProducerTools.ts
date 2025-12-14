import { AI } from '@/services/ai/AIService';
import type { ToolFunctionArgs } from '../types';

// ============================================================================
// Types for ProducerTools
// ============================================================================

interface CreateCallSheetArgs extends ToolFunctionArgs {
    date: string;
    location: string;
    cast: string[];
}

interface BreakdownScriptArgs extends ToolFunctionArgs {
    script: string;
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
// ProducerTools Implementation
// ============================================================================

export const ProducerTools = {
    create_call_sheet: async (args: CreateCallSheetArgs): Promise<string> => {
        try {
            const systemPrompt = `
You are a Unit Production Manager.
Generate a professional Daily Call Sheet as a JSON object.
Return ONLY valid JSON with this structure:
{
  "production": "Project Name",
  "date": "YYYY-MM-DD",
  "location": "Location Address",
  "callTime": "00:00 AM",
  "weather": "Sunny, 72F",
  "nearestHospital": "General Hospital, 123 Main St",
  "cast": [
    { "name": "Actor Name", "role": "Character", "callTime": "00:00 AM" }
  ],
  "schedule": [
    { "time": "00:00", "scene": "1A", "description": "Scene Description" }
  ]
}
Simulate logical schedule and weather.
`;
            const prompt = `Create a call sheet JSON for:
Date: ${args.date}
Location: ${args.location}
Cast: ${args.cast.join(', ')}
`;

            const response = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            const textResponse = response.text();
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            return jsonMatch ? jsonMatch[0] : textResponse;
        } catch (e: unknown) {
            return `Failed to create call sheet: ${getErrorMessage(e)}`;
        }
    },

    breakdown_script: async (args: BreakdownScriptArgs): Promise<string> => {
        try {
            const systemPrompt = `
You are a Line Producer.
Analyze the script and perform a "Script Breakdown".
Identify every element that costs money or requires logistics.
Output a JSON list of:
- Props
- Costumes
- Vectors (Vehicles, Animals)
- VFX shots
- Special Equipment
`;
            const prompt = `Breakdown this script:\n\n${args.script}`;

            const response = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            const textResponse = response.text();
            const jsonMatch = textResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            return jsonMatch ? jsonMatch[0] : textResponse;

        } catch (e: unknown) {
            return `Failed to breakdown script: ${getErrorMessage(e)}`;
        }
    }
};
