import { createAgent } from '../sdk/AgentBuilder';
import { AgentConfig } from "../types";
import systemPrompt from '@agents/publicist/prompt.md?raw';
import { PublicistService } from '../../publicist/PublicistService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const PublicistAgent = createAgent('publicist')
    .withName('Publicist')
    .withDescription('Manages public relations and media communications.')
    .withColor('bg-orange-400')
    .withCategory('manager')
    .withSystemPrompt(systemPrompt)
    .withTool({
        functionDeclarations: [{
            name: "create_campaign",
            description: "Create a new publicity campaign in the database.",
            parameters: {
                type: "OBJECT",
                properties: {
                    userId: { type: "STRING", description: "The ID of the user." },
                    title: { type: "STRING", description: "Campaign Title." },
                    artist: { type: "STRING", description: "Artist Name." },
                    type: { type: "STRING", enum: ["Album", "Single", "Tour"], description: "Type of campaign." },
                    focus: { type: "STRING", description: "Main focus or goal." }
                },
                required: ["userId", "title", "artist", "type"]
            }
        }]
    }, async (args: { userId: string, title: string, artist: string, type: 'Album' | 'Single' | 'Tour', focus: string }) => {
        try {
            const startDate = new Date().toISOString().split('T')[0];
            await PublicistService.addCampaign(args.userId, {
                title: args.title,
                artist: args.artist,
                type: args.type,
                status: 'Draft',
                releaseDate: startDate,
                progress: 0,
                openRate: 0
            });
            return {
                success: true,
                data: {
                    message: `Campaign "${args.title}" created successfully in Draft mode.`,
                    status: "Draft"
                }
            };
        } catch (error: any) {
            return { success: false, error: `Failed to create campaign: ${error.message}` };
        }
    })
    .withTool({
        functionDeclarations: [{
            name: "write_press_release",
            description: "Write a formal press release.",
            parameters: {
                type: "OBJECT",
                properties: {
                    headline: { type: "STRING", description: "The major news headline." },
                    company_name: { type: "STRING", description: "Company Name." },
                    key_points: { type: "ARRAY", description: "List of key facts.", items: { type: "STRING" } },
                    contact_info: { type: "STRING", description: "Media contact details." }
                },
                required: ["headline", "company_name"]
            }
        }]
    }, async (args: { headline: string, company_name: string, key_points?: string[], contact_info?: string }) => {
        const missing = [];
        if (!args.key_points || args.key_points.length === 0) missing.push("Key Points");
        if (!args.contact_info) missing.push("Contact Info");

        const prompt = `Write a formal press release for ${args.company_name}.
        Headline: ${args.headline}
        Key Points: ${(args.key_points || []).join(', ')}
        Contact Info: ${args.contact_info}
        
        Format as a standard press release.`;

        try {
            const content = await firebaseAI.generateText(prompt);
            return {
                success: true,
                data: {
                    generated_content: content || "Failed to generate content.",
                    validation: {
                        is_complete: missing.length === 0,
                        missing_fields: missing,
                        word_count: content ? content.split(/\s+/).length : 0
                    }
                }
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    })
    .withTool({
        functionDeclarations: [{
            name: "generate_crisis_response",
            description: "Generate a response to a PR crisis or negative feedback.",
            parameters: {
                type: "OBJECT",
                properties: {
                    issue: { type: "STRING", description: "The negative event or comment." },
                    sentiment: { type: "STRING", description: "The current public sentiment." },
                    platform: { type: "STRING", description: "Where to post (Twitter, Email, etc)." }
                },
                required: ["issue"]
            }
        }]
    }, async (args: { issue: string, sentiment?: string, platform?: string }) => {
        const prompt = `Generate a crisis response for a public relations issue.
        Issue: ${args.issue}
        Sentiment: ${args.sentiment || 'Negative'}
        Platform: ${args.platform || 'General'}
        
        Strategy: Acknowledge, Empathize, Redirect. Keep it professional.`;

        try {
            const response = await firebaseAI.generateText(prompt);
            return {
                success: true,
                data: {
                    strategy: "Acknowledge, Empathize, Redirect",
                    draft_response: response
                }
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    })
    .withTool({
        functionDeclarations: [{
            name: "generate_social_post",
            description: "Generate a social media post.",
            parameters: {
                type: "OBJECT",
                properties: {
                    platform: { type: "STRING", description: "Platform (Twitter, LinkedIn, etc)." },
                    topic: { type: "STRING", description: "What the post is about." },
                    tone: { type: "STRING", description: "Desired tone." }
                },
                required: ["platform", "topic"]
            }
        }]
    }, async (args: { platform: string, topic: string, tone?: string }) => {
        const prompt = `Write a social media post for ${args.platform}.
        Topic: ${args.topic}
        Tone: ${args.tone || 'Excited'}
        Include relevant hashtags.`;

        try {
            const post = await firebaseAI.generateText(prompt);
            return {
                success: true,
                data: {
                    post_text: post
                }
            };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    })
    .build();
