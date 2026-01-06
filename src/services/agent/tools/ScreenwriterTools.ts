import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// ScreenwriterTools Implementation
// ============================================================================

export const ScreenwriterTools: Record<string, AnyToolFunction> = {
  format_screenplay: wrapTool('format_screenplay', async (args: { text: string }) => {
    const systemPrompt = `
You are a professional screenwriter formatting expert.
Your task is to convert raw text into a structured JSON screenplay format.
Return ONLY valid JSON with the following structure:
{
  "title": "Scene Title",
  "author": "indii",
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

    const response = await firebaseAI.generateContent(
      prompt,
      AI_MODELS.TEXT.AGENT,
      undefined,
      systemPrompt
    );

    const textResponse = response.response.text();
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: textResponse };

    return toolSuccess(data, `Screenplay formatted: ${data.title || 'Untitled'}`);
  }),

  analyze_script_structure: wrapTool('analyze_script_structure', async (args: { script: string }) => {
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

    const response = await firebaseAI.generateContent(
      prompt,
      AI_MODELS.TEXT.AGENT,
      undefined,
      systemPrompt
    );

    const textResponse = response.response.text();
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: textResponse };

    return toolSuccess(data, `Script structure analyzed: ${data.title || 'Untitled'}`);
  })
};
