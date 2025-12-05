import { BaseAgent } from './BaseAgent';

export class RoadAgent extends BaseAgent {
    id = 'road';
    name = 'Road Manager';
    description = 'Manages logistics and tour planning.';
    color = 'bg-yellow-500';
    category = 'manager' as const;
    systemPrompt = `You are the Road Manager.
    Your role is to handle logistics, scheduling, and operational details.

    Responsibilities:
1. Create detailed itineraries and schedules.
    2. Manage logistics for events and tours.
    3. Anticipate operational risks and propose solutions.

    Be practical, organized, and detail - oriented.`;

    tools = [{
        functionDeclarations: [
            {
                name: "create_project",
                description: "Create a new tour or event project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Name of the tour/event." },
                        type: { type: "STRING", enum: ["marketing", "creative", "music", "road"], description: "Project type (usually 'road')." }
                    },
                    required: ["name"]
                }
            },
            {
                name: "search_knowledge",
                description: "Research venue details, logistics, or travel info from the knowledge base.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "generate_social_post",
                description: "Generate tour updates for social media.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", description: "Platform (e.g. Instagram)." },
                        topic: { type: "STRING", description: "Update content." }
                    },
                    required: ["topic"]
                }
            }
        ]
    }];
}
