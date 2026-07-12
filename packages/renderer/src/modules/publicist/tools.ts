/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import { AutonomousIntelligence, getResponseText } from '@/services/intelligence/AutonomousIntelligence';
import { getFineTunedModel } from '@/services/agent/fine-tuned-models';
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

// ISSUE-931: the model must never invent contact/identity facts. The
// press release it drafts for generate_campaign_assets omits contactInfo
// entirely — it is injected deterministically after generation from the
// user-supplied form field (see generate_campaign_assets below).
const CampaignPressReleaseSchema = z.object({
    headline: z.string(),
    content: z.string()
});

export const UNRESOLVED_MEDIA_CONTACT = 'MEDIA CONTACT NOT PROVIDED — add a verified contact before sending to press';

const CampaignAssetsSchema = z.object({
    pressRelease: CampaignPressReleaseSchema,
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
            const res = await AutonomousIntelligence.generateContent(prompt, getFineTunedModel('publicist'));
            const text = getResponseText(res);
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = PressReleaseSchema.parse(parsed);
            return toolSuccess(result, `Press release generated for ${args.headline}.`);
        } catch (e: unknown) {
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
            const res = await AutonomousIntelligence.generateContent(prompt, getFineTunedModel('publicist'));
            const text = getResponseText(res);
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const result = CrisisResponseSchema.parse(parsed);
            return toolSuccess(result, `Crisis response generated for: ${args.issue}.`);
        } catch (e: unknown) {
            logger.error('PUBLICIST_TOOLS.generate_crisis_response error:', e);
            return toolError("Error generating crisis response.", 'GENERATION_ERROR');
        }
    }),

    manage_media_list: wrapTool('manage_media_list', async (args: { action: 'add' | 'remove' | 'list', contact?: any }) => {
        const { auth, db } = await import('@/services/firebase');
        const { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } = await import('firebase/firestore');

        const userId = auth.currentUser?.uid;
        if (!userId) {
            return toolError('Media list requires an authenticated user.', 'AUTH_REQUIRED');
        }

        const contactsRef = collection(db, 'users', userId, 'publicist_media_contacts');

        if (args.action === 'add') {
            const contact = MediaListSchema.element.parse(args.contact);
            const ref = await addDoc(contactsRef, {
                ...contact,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return toolSuccess({ id: ref.id, ...contact }, `Media contact added: ${contact.name}.`);
        }

        if (args.action === 'remove') {
            const contactId = args.contact?.id;
            if (!contactId || typeof contactId !== 'string') {
                return toolError('Removing a media contact requires contact.id.', 'INVALID_ARGS');
            }
            await deleteDoc(doc(db, 'users', userId, 'publicist_media_contacts', contactId));
            return toolSuccess({ id: contactId }, 'Media contact removed.');
        }

        const snapshot = await getDocs(contactsRef);
        const list = snapshot.docs.map(contactDoc => contactDoc.data());
        MediaListSchema.parse(list);
        return toolSuccess(list, "Media list retrieved.");
    }),

    pitch_story: wrapTool('pitch_story', async (args: { outlet: string, angle: string }) => {
        // ISSUE-911: pitch_story requires AI model to generate real content.
        // Placeholder implementation removed to avoid fabricating copy.
        return toolError(
            `pitch_story requires an active AI model connection to generate a custom pitch for ${args.outlet} based on angle: "${args.angle}". This is not yet implemented.`,
            'NOT_IMPLEMENTED'
        );
    }),

    generate_campaign_assets: wrapTool('generate_campaign_assets', async (args: { trackTitle: string, artistName: string, releaseDate: string, musicalStyle: string[], targetAudience: string, contactInfo?: string }) => {
        const prompt = `
        You are a Music Marketing Strategist.
        Create a complete "Release Kit" for a new single.

        Track: ${args.trackTitle}
        Artist: ${args.artistName}
        Release Date: ${args.releaseDate}
        Style: ${args.musicalStyle.join(', ')}
        Audience: ${args.targetAudience}

        Generate the following assets:
        1. Press Release (Formal, concise) — headline and body ONLY. Do NOT invent a
           media contact, email address, phone number, or any other contact detail;
           that is supplied separately by the user and injected after generation.
        2. Social Media Posts (3 posts: Instagram, Twitter/X, TikTok - engaging, use emojis)
        3. Email Blast (Direct to fans, personal tone)

        Output a STRICT JSON object matching this schema:
        {
            "pressRelease": { "headline": string, "content": string },
            "socialPosts": [ { "platform": string, "content": string, "hashtags": string[] } ],
            "emailBlast": { "subject": string, "body": string }
        }
        `;

        try {
            const res = await AutonomousIntelligence.generateContent(prompt, getFineTunedModel('publicist'));
            const text = getResponseText(res);
            const jsonText = text.replace(/```json\n|\n```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const generated = CampaignAssetsSchema.parse(parsed);

            // ISSUE-931: contact info is never model-generated. Inject the
            // user-supplied value deterministically, or an obvious
            // unresolved placeholder if none was provided.
            const result = {
                ...generated,
                pressRelease: {
                    ...generated.pressRelease,
                    contactInfo: args.contactInfo?.trim() || UNRESOLVED_MEDIA_CONTACT
                }
            };

            return toolSuccess(result, `Campaign assets generated for ${args.trackTitle}.`);
        } catch (e: unknown) {
            logger.error('PUBLICIST_TOOLS.generate_campaign_assets error:', e);
            return toolError("Error generating campaign assets.", 'GENERATION_ERROR');
        }
    })
} satisfies Record<string, AnyToolFunction>;
