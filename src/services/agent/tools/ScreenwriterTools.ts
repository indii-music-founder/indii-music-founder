
import { AI } from '@/services/ai/AIService';

export const ScreenwriterTools = {
    format_screenplay: async (args: { text: string }) => {
        try {
            const systemPrompt = `
You are a professional screenwriter formatting expert.
Your task is to convert raw text into standard screenplay format (Sluglines, Action, Character, Dialogue).
You should attempt to infer scene headers (INT./EXT.) if not explicit.
Return the result as a markdown string that mimics screenplay formatting (e.g. capitalized names centered, sluglines bolded).
Strictly adhere to standard industry conventions.
`;
            const prompt = `Convert this text to screenplay format:\n\n${args.text}`;

            const response = await AI.generateContent({
                model: 'gemini-1.5-pro-preview-0409',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            return response.text();
        } catch (e: any) {
            return `Failed to format screenplay: ${e.message}`;
        }
    },

    analyze_script_structure: async (args: { script: string }) => {
        try {
            const systemPrompt = `
You are a script doctor and narrative analyst.
Analyze the provided script text and break it down into a structured JSON object.
Identify the Acts, Sequences, and key Beats.
Return ONLY valid JSON with this structure:
{
  "title": "Inferred Title",
  "logline": "1-sentence summary",
  "acts": [
    {
      "name": "Act I",
      "summary": "Summary of act",
      "sequences": [
        { "name": "Sequence Name", "description": "Description" }
      ]
    }
  ],
  "characters": ["Char 1", "Char 2"],
  "themes": ["Theme 1", "Theme 2"]
}
`;
            const prompt = `Analyze this script:\n\n${args.script}`;

            const response = await AI.generateContent({
                model: 'gemini-1.5-pro-preview-0409',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            const textResponse = response.text();
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            return jsonMatch ? jsonMatch[0] : textResponse;
        } catch (e: any) {
            return `Failed to analyze script: ${e.message}`;
        }
    }
};
