import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// Types for ProducerTools
// ============================================================================

export const ProducerTools: Record<string, AnyToolFunction> = {
    create_call_sheet: wrapTool('create_call_sheet', async (args: {
        date: string;
        location: string;
        cast: string[];
    }) => {
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

        const response = await firebaseAI.generateContent(
            prompt,
            AI_MODELS.TEXT.AGENT,
            undefined,
            systemPrompt
        );

        const textResponse = response.response.text();
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: textResponse };

        return toolSuccess(data, `Call sheet generated for ${args.date} at ${args.location}`);
    }),

    breakdown_script: wrapTool('breakdown_script', async (args: { script: string }) => {
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

        const response = await firebaseAI.generateContent(
            prompt,
            AI_MODELS.TEXT.AGENT,
            undefined,
            systemPrompt
        );

        const textResponse = response.response.text();
        const jsonMatch = textResponse.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: textResponse };

        return toolSuccess({ breakdown: data }, "Script breakdown completed.");
    })
};
