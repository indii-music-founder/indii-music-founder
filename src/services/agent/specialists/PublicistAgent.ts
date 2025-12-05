import { BaseAgent } from './BaseAgent';


export class PublicistAgent extends BaseAgent {
    id = 'publicist';
    name = 'Publicist';
    description = 'Manages public relations and media communications.';
    color = 'bg-orange-400';
    category = 'manager' as const;
    systemPrompt = `You are the Publicist (Manager Level) for a creative studio.
    Your role is to manage the brand's public image, write press releases, and handle crisis communication.
    DISTINCTION: You are NOT the Publishing Department (which handles rights/royalties).
    Be professional, articulate, and strategic.`;

    tools = [{
        functionDeclarations: [
            {
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
            },
            {
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
            },
            {
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
            }
        ]
    }];
}
