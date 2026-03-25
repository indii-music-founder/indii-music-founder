/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { z } from 'zod';

import { wrapTool, toolSuccess, toolError } from '@/services/agent/utils/ToolUtils';
import type { AnyToolFunction } from '@/services/agent/types';
import { logger } from '@/utils/logger';

/**
 * Publicist Tools
 * PR generation and crisis management.
 */

// --- Validation Schemas ---

const PressReleaseSchema = z.object({
    headline: z.string(),
    content: z.string(),
    contactInfo: z.string()
});

const CrisisResponseSchema = z.object({
    response: z.string(),
    sentimentAnalysis: z.string(),
    nextSteps: z.array(z.string())
});

const MediaListSchema = z.array(z.object({
    name: z.string(),
    contact: z.string(),
    tags: z.array(z.string())
}));

const PitchStorySchema = z.object({
    outlet: z.string(),
    status: z.string(),
    subjectLine: z.string(),
    emailBody: z.string()
});

const CampaignAssetsSchema = z.object({
    pressRelease: PressReleaseSchema,
    socialPosts: z.array(z.object({
        platform: z.string(),
        content: z.string(),
        hashtags: z.array(z.string())
    })),
    emailBlast: z.object({
        subject: z.string(),
        body: z.string()
    })
});

// --- Tools Implementation ---

export const PUBLICIST_TOOLS = {
    write_press_release: wrapTool('write_press_release', async (args: { headline: string, company_name: string, key_points: string[], contact_info: string }) => {
        const prompt = `
        You are a Senior Publicist.
        Write a formal press release.

        Headline: ${args.headline}
        Company: ${args.company_name}
        Key Points:
        ${args.key_points.map(p => `- ${p}`).join('\n')}
        Contact Info: ${args.contact_info}

        Format: Standard Press Release format (FOR IMMEDIATE RELEASE).
        Tone: Professional, exciting, newsworthy.

        Output a strict JSON object (no markdown) matching this schema:
        { "headline": string, "content": string, "contactInfo": string }
        `;

        try {
            const res = await firebaseAI.generateContent(prompt, AI_MODELS.TEXT.AGENT);
            const text = res.response.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = PressReleaseSchema.parse(parsed);
            return toolSuccess(result, `Press release generated for ${args.headline}.`);
        } catch (e) {
            logger.error('PUBLICIST_TOOLS.write_press_release error:', e);
            return toolError("Error generating press release.", 'GENERATION_ERROR');
        }
    }),

    generate_crisis_response: wrapTool('generate_crisis_response', async (args: { issue: string, sentiment: string, platform: string }) => {
        const prompt = `
        You are a Crisis Management Expert.
        Draft a response to a negative situation.
        Issue: ${args.issue}
        Current Sentiment: ${args.sentiment}
        Platform: ${args.platform}

        Goal: De-escalate, show empathy, and provide a solution or next step.
        Tone: Empathetic, professional, calm.

        Output a strict JSON object (no markdown) matching this schema:
        { "response": string, "sentimentAnalysis": string, "nextSteps": string[] }
        `;

        try {
            const res = await firebaseAI.generateContent(prompt, AI_MODELS.TEXT.AGENT);
            const text = res.response.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = CrisisResponseSchema.parse(parsed);
            return toolSuccess(result, `Crisis response generated for: ${args.issue}.`);
        } catch (e) {
            logger.error('PUBLICIST_TOOLS.generate_crisis_response error:', e);
            return toolError("Error generating crisis response.", 'GENERATION_ERROR');
        }
    }),

    manage_media_list: wrapTool('manage_media_list', async (args: { action: 'add' | 'remove' | 'list', contact?: any }) => {
        if (args.action === 'list') {
            const list = [
                { name: "Rolling Stone", contact: "editor@rollingstone.com", tags: ["Music", "Review"] },
                { name: "Pitchfork", contact: "news@pitchfork.com", tags: ["Indie", "News"] },
                { name: "Billboard", contact: "info@billboard.com", tags: ["Industry", "Charts"] }
            ];
            MediaListSchema.parse(list);
            return toolSuccess(list, "Media list retrieved.");
        }
        return toolSuccess({ action: args.action }, `Successfully performed '${args.action}' on media list (Mock).`);
    }),

    pitch_story: wrapTool('pitch_story', async (args: { outlet: string, angle: string }) => {
        const pitch = {
            outlet: args.outlet,
            status: "drafted",
            subjectLine: `Exclusive: Why [Artist] is the next big thing`,
            emailBody: `Hi Team at ${args.outlet},\n\nI wanted to share a story about... [AI would generate full pitch based on ${args.angle}]`
        };
        PitchStorySchema.parse(pitch);
        return toolSuccess(pitch, `Pitch drafted for ${args.outlet}.`);
    }),

    generate_campaign_assets: wrapTool('generate_campaign_assets', async (args: { trackTitle: string, artistName: string, releaseDate: string, musicalStyle: string[], targetAudience: string }) => {
        const prompt = `
        You are a Music Marketing Strategist.
        Create a complete "Release Kit" for a new single.
        
        Track: ${args.trackTitle}
        Artist: ${args.artistName}
        Release Date: ${args.releaseDate}
        Style: ${args.musicalStyle.join(', ')}
        Audience: ${args.targetAudience}

        Generate the following assets:
        1. Press Release (Formal, concise)
        2. Social Media Posts (3 posts: Instagram, Twitter/X, TikTok - engaging, use emojis)
        3. Email Blast (Direct to fans, personal tone)

        Output a STRICT JSON object matching this schema:
        {
            "pressRelease": { "headline": string, "content": string, "contactInfo": string },
            "socialPosts": [ { "platform": string, "content": string, "hashtags": string[] } ],
            "emailBlast": { "subject": string, "body": string }
        }
        `;

        try {
            const res = await firebaseAI.generateContent(prompt, AI_MODELS.TEXT.AGENT);
            const text = res.response.text();
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = CampaignAssetsSchema.parse(parsed);

            return toolSuccess(result, `Campaign assets generated for ${args.trackTitle}.`);
        } catch (e) {
            logger.error('PUBLICIST_TOOLS.generate_campaign_assets error:', e);
            return toolError("Error generating campaign assets.", 'GENERATION_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
