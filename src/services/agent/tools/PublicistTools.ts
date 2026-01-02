
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Zod Schemas ---

const WritePressReleaseSchema = z.object({
    headline: z.string(),
    dateline: z.string(),
    body: z.string(),
    contact_info: z.string()
});

const GenerateCrisisResponseSchema = z.object({
    severity: z.enum(["low", "medium", "high"]),
    talking_points: z.array(z.string()),
    statement: z.string(),
    recommended_actions: z.array(z.string())
});

const PitchStorySchema = z.object({
    subject_line: z.string(),
    email_body: z.string(),
    target_outlets: z.array(z.string())
});

// --- Tools Implementation ---

export const PublicistTools = {
    write_press_release: async ({ topic, angle, quotes }: { topic: string; angle?: string; quotes?: string[] }) => {
        const schema = zodToJsonSchema(WritePressReleaseSchema);
        const prompt = `
        You are a PR Specialist. Write a press release about: ${topic}.
        ${angle ? `Angle: ${angle}` : ''}
        ${quotes ? `Include quotes: ${quotes.join('; ')}` : ''}

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const result = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            const data = AI.parseJSON(text);
            return WritePressReleaseSchema.parse(data);
        } catch (error) {
            console.error('PublicistTools.write_press_release error:', error);
            return { headline: "Error", dateline: "", body: "Generation failed.", contact_info: "" };
        }
    },

    generate_crisis_response: async ({ scenario, stakeholders }: { scenario: string; stakeholders: string[] }) => {
        const schema = zodToJsonSchema(GenerateCrisisResponseSchema);
        const prompt = `
        You are a Crisis Manager. Generate a response plan for the following scenario: ${scenario}.
        Stakeholders: ${stakeholders.join(', ')}.

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const result = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            const data = AI.parseJSON(text);
            return GenerateCrisisResponseSchema.parse(data);
        } catch (error) {
            console.error('PublicistTools.generate_crisis_response error:', error);
            return { severity: "high", talking_points: [], statement: "Error generating response.", recommended_actions: [] };
        }
    },

    pitch_story: async ({ outlet, hook }: { outlet: string; hook: string }) => {
        const schema = zodToJsonSchema(PitchStorySchema);
        const prompt = `
        You are a Publicist. Write a pitch email to ${outlet} with the hook: "${hook}".

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const result = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            const text = result.text();
            const data = AI.parseJSON(text);
            return PitchStorySchema.parse(data);
        } catch (error) {
            console.error('PublicistTools.pitch_story error:', error);
            return { subject_line: "Error", email_body: "Generation failed.", target_outlets: [] };
        }
    }
};
