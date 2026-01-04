import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

export const PublicistTools: Record<string, AnyToolFunction> = {
    write_press_release: wrapTool('write_press_release', async ({ topic, angle, quotes_from }: { topic: string; angle?: string; quotes_from?: string[] }) => {
        const schema = zodToJsonSchema(WritePressReleaseSchema);
        const prompt = `
        You are a Senior Publicist. Write a Press Release.
        Topic: ${topic}
        ${angle ? `Angle: ${angle}` : ''}
        ${quotes_from ? `Include quotes from: ${quotes_from.join(', ')}` : ''}
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as any
        );

        const validated = WritePressReleaseSchema.parse(data);
        return toolSuccess(validated, `Press release generated: ${validated.headline}`);
    }),

    generate_crisis_response: wrapTool('generate_crisis_response', async ({ situation, tone }: { situation: string; tone?: string }) => {
        const schema = zodToJsonSchema(GenerateCrisisResponseSchema);
        const prompt = `
        You are a Crisis Manager. Develop a response strategy.
        Situation: ${situation}
        Tone: ${tone || 'Professional, empathetic, and firm'}.
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as any
        );

        const validated = GenerateCrisisResponseSchema.parse(data);
        return toolSuccess(validated, "Crisis response strategy developed.");
    }),

    pitch_story: wrapTool('pitch_story', async ({ story_summary, recipient_type }: { story_summary: string; recipient_type?: string }) => {
        const schema = zodToJsonSchema(PitchStorySchema);
        const prompt = `
        You are a PR Specialist. Write an email pitch.
        Story: ${story_summary}
        Recipient: ${recipient_type || 'General Media'}.
        `;

        const data = await firebaseAI.generateStructuredData(
            [{ text: prompt }],
            schema as any
        );

        const validated = PitchStorySchema.parse(data);
        return toolSuccess(validated, `Email pitch created: ${validated.subject_line}`);
    })
};

// Aliases for historical reasons if needed, but the object is the preferred way
export const {
    write_press_release,
    generate_crisis_response,
    pitch_story
} = PublicistTools;
