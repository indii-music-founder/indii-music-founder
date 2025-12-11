
import { AI } from '@/services/ai/AIService';

export const NarrativeTools = {
    generate_visual_script: async (args: { synopsis: string }) => {
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

            const response = await AI.generateContent({
                model: 'gemini-1.5-pro-preview-0409',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            const textResponse = response.text();

            // Attempt to parse JSON from the text response
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return jsonMatch[0];
            }

            return textResponse;

        } catch (e: any) {
            return `Failed to generate script: ${e.message}`;
        }
    }
};
