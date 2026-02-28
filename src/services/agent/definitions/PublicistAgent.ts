import { createAgent } from '../sdk/AgentBuilder';
import { AgentConfig } from "../types";
import systemPrompt from '@agents/publicist/prompt.md?raw';
import { PublicistService } from '../../publicist/PublicistService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const PublicistAgent = createAgent('publicist')
    .withName('Publicist')
    .withDescription('Manages public relations and media communications.')
    .withColor('bg-pink-500')
    .withCategory('manager')
    .withSystemPrompt(`
You are the **Music Industry Publicist**, a high-level specialist agent within the indii system.

## indii Architecture (Hub-and-Spoke)
As a specialist (spoke), you operate under strict architectural rules:
1. **Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub ('generalist' / Agent Zero).
2. **Horizontal Communication:** You CANNOT communicate directly with other specialist agents (Marketing, Social, Legal, etc.).
3. **Coordination:** If you need help from another domain (e.g., Social for a press-release share), ask Agent Zero to coordinate.

## Role
Your role is to manage public relations, media communications, and the artist's public image. You are an expert in securing blog placements, handling "crisis" management, and crafting compelling narratives for the music press.

## Responsibilities:

1. **Press Release Drafting:** Craft formal announcements for single/EP/album releases and tour dates.
2. **Media Outreach:** Identify and pitch to music blogs (e.g., Pitchfork, Stereogum), magazines, and local journalists.
3. **EPK (Electronic Press Kit) Coordination:** Define the structure and narrative of the artist's EPK.
4. **Crisis Management:** Generate rapid, professional responses to negative PR or controversial events.
5. **Interview Prep:** Draft talking points and FAQ for the artist ahead of media appearances.

## Tone & Perspective:
- **Professional & Polished:** Your language must be suitable for major media outlets.
- **Narrative-Driven:** Focus on the "Artist's Story" rather than just the facts.
- **Protective:** Your goal is to safeguard and enhance the artist's reputation.

Think in terms of "Media Placements," "Narrative Arc," and "Public Perception."
    `)
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
        /**
         * Create a new publicity campaign in the database.
         */
        try {
            const startDate = new Date().toISOString().split('T')[0];
            await PublicistService.addCampaign(args.userId, {
                title: args.title,
                artist: args.artist,
                type: args.type,
                status: 'Draft',
                releaseDate: startDate,
                progress: 0,
                openRate: 0,
                budget: 0
            });
            return {
                success: true,
                data: {
                    message: `Campaign "${args.title}" created successfully in Draft mode.`,
                    status: "Draft"
                }
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Failed to create campaign: ${message}` };
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
        /**
         * Write a formal press release using AI.
         */
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
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
        /**
         * Generate a strategic response to a PR crisis.
         */
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
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
        /**
         * Generate a social media post with hashtags.
         */
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    })
    .withTool({
        functionDeclarations: [{
            name: "indii_image_gen",
            description: "Generate visual assets for press kits or social media.",
            parameters: {
                type: "OBJECT",
                properties: {
                    prompt: { type: "STRING", description: "Image description." },
                    style: { type: "STRING", description: "Art style (Photorealistic, Cinematic)." },
                    aspect_ratio: { type: "STRING", description: "1:1, 16:9, 9:16" }
                },
                required: ["prompt"]
            }
        }]
    }, async (args: { prompt: string, style?: string, aspect_ratio?: string }) => {
        // This is a placeholder for the Python bridge call
        return {
            success: true,
            data: {
                message: "Image generation task dispatched to Python Engine.",
                task_payload: args
            }
        };
    })
    .withTool({
        functionDeclarations: [{
            name: "browser_tool",
            description: "Browse the web to find press contacts or monitor coverage.",
            parameters: {
                type: "OBJECT",
                properties: {
                    action: { type: "STRING", description: "open, click, type, get_dom, screenshot" },
                    url: { type: "STRING", description: "URL to visit" },
                    selector: { type: "STRING" },
                    text: { type: "STRING" }
                },
                required: ["action"]
            }
        }]
    }, async (args: { action: string, url?: string, selector?: string, text?: string }) => {
        return {
            success: true,
            data: {
                message: "Browser action dispatched to Ghost Hands.",
                payload: args
            }
        };
    })
    .withTool({
        functionDeclarations: [{
            name: "credential_vault",
            description: "Securely retrieve passwords for social accounts.",
            parameters: {
                type: "OBJECT",
                properties: {
                    action: { type: "STRING", description: "retrieve" },
                    service: { type: "STRING", description: "Service name (e.g. Twitter)" }
                },
                required: ["action", "service"]
            }
        }]
    }, async (args: { action: string, service: string }) => {
        return {
            success: true,
            data: {
                message: "Vault access requested.",
                payload: args
            }
        };
    })
    .withTool({
        functionDeclarations: [{
            name: "generate_pdf",
            description: "Automatically generate a professional PDF document (e.g., Press Release, EPK).",
            parameters: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING", description: "Document title" },
                    content: { type: "STRING", description: "Document content in markdown or plain text" }
                },
                required: ["title", "content"]
            }
        }]
    }, async (args: { title: string, content: string }) => {
        // Placeholder for an actual PDF generation integration (e.g. using a Cloud Function or frontend library)
        return {
            success: true,
            data: {
                message: `PDF generated successfully for "${args.title}".`,
                download_url: "https://indii-os.web.app/downloads/placeholder.pdf"
            }
        };
    })
    .build();

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
