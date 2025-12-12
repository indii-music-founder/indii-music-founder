
import { AI } from '@/services/ai/AIService';

export const ScreenwriterTools = {
    format_screenplay: async (args: { text: string }) => {
        try {
            const systemPrompt = `
You are a professional screenwriter formatting expert.
Your task is to convert raw text into a structured JSON screenplay format.
Return ONLY valid JSON with the following structure:
{
  "title": "Scene Title",
  "author": "IndiiOS AI",
  "elements": [
    { "type": "slugline", "text": "INT. OFFICE - DAY" },
    { "type": "action", "text": "A busy newsroom..." },
    { "type": "character", "text": "JANE" },
    { "type": "dialogue", "text": "Did you see the news?" },
    { "type": "parenthetical", "text": "whispering" },
    { "type": "transition", "text": "CUT TO:" }
  ]
}
Attempt to infer scene headers if not explicit.
`;
            const prompt = `Convert this text to screenplay JSON:\n\n${args.text}`;

            const response = await AI.generateContent({
                model: 'gemini-1.5-pro-preview-0409',
                contents: { role: 'user', parts: [{ text: prompt }] },
                systemInstruction: systemPrompt
            });

            const textResponse = response.text();
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            return jsonMatch ? jsonMatch[0] : textResponse;
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
