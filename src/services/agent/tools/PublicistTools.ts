
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// --- Validation Schemas ---

const WritePressReleaseSchema = z.object({
    headline: z.string(),
    dateline: z.string(),
    introduction: z.string(),
    body_paragraphs: z.array(z.string()),
    quotes: z.array(z.object({
        speaker: z.string(),
        text: z.string()
    })),
    boilerplate: z.string(),
    contact_info: z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string().optional()
    })
});

const GenerateCrisisResponseSchema = z.object({
    severity_assessment: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    strategy: z.string(),
    public_statement: z.string(),
    internal_talking_points: z.array(z.string()),
    actions_to_take: z.array(z.string())
});

const PitchStorySchema = z.object({
    subject_line: z.string(),
    hook: z.string(),
    body: z.string(),
    call_to_action: z.string(),
    angle: z.string(),
    target_outlets: z.array(z.string())
});

// --- Tools Implementation ---

export const PublicistTools = {
    write_press_release: async ({ topic, angle, quotes_from }: { topic: string; angle?: string; quotes_from?: string[] }) => {
        const schema = zodToJsonSchema(WritePressReleaseSchema);
        const prompt = `
        You are a Senior Publicist. Write a Press Release.
        Topic: ${topic}
        ${angle ? `Angle: ${angle}` : ''}
        ${quotes_from ? `Include quotes from: ${quotes_from.join(', ')}` : ''}

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(WritePressReleaseSchema.parse(data));
        } catch (error) {
            console.error('PublicistTools.write_press_release error:', error);
            // Fallback
            return JSON.stringify({
                headline: `Press Release: ${topic}`,
                dateline: new Date().toLocaleDateString(),
                introduction: "Start of the press release...",
                body_paragraphs: ["Details to follow."],
                quotes: [],
                boilerplate: "About the company...",
                contact_info: { name: "Media Contact", email: "press@example.com" }
            });
        }
    },

    generate_crisis_response: async ({ situation, tone }: { situation: string; tone?: string }) => {
        const schema = zodToJsonSchema(GenerateCrisisResponseSchema);
        const prompt = `
        You are a Crisis Manager. Develop a response strategy.
        Situation: ${situation}
        Tone: ${tone || 'Professional, empathetic, and firm'}.

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(GenerateCrisisResponseSchema.parse(data));
        } catch (error) {
            console.error('PublicistTools.generate_crisis_response error:', error);
            return JSON.stringify({
                severity_assessment: "HIGH",
                strategy: "Acknowledge and investigate.",
                public_statement: "We are aware of the situation regarding " + situation,
                internal_talking_points: ["Stay calm", "Do not speculate"],
                actions_to_take: ["Gather facts"]
            });
        }
    },

    pitch_story: async ({ story_summary, recipient_type }: { story_summary: string; recipient_type?: string }) => {
        const schema = zodToJsonSchema(PitchStorySchema);
        const prompt = `
        You are a PR Specialist. Write an email pitch.
        Story: ${story_summary}
        Recipient: ${recipient_type || 'General Media'}.

        Output a strict JSON object (no markdown) matching this schema:
        ${JSON.stringify(schema, null, 2)}
        `;

        try {
            const data = await AI.generateStructuredData<any>(prompt, schema as any);
            return JSON.stringify(PitchStorySchema.parse(data));
        } catch (error) {
            console.error('PublicistTools.pitch_story error:', error);
            return JSON.stringify({
                subject_line: "Story Pitch",
                hook: "Interesting story...",
                body: story_summary,
                call_to_action: "Let me know if you are interested.",
                angle: "General",
                target_outlets: ["Blogs", "News"]
            });
        }
    }
};

// Aliases
export const write_press_release = PublicistTools.write_press_release;
export const generate_crisis_response = PublicistTools.generate_crisis_response;
export const pitch_story = PublicistTools.pitch_story;
