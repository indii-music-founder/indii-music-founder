import { BaseAgent } from './BaseAgent';
import { AnalysisTools } from '../tools/AnalysisTools';

export class PublishingAgent extends BaseAgent {
    id = 'publishing';
    name = 'Publishing Department';
    description = 'Manages musical rights, royalties, and catalog administration.';
    color = 'bg-rose-500';
    category = 'department' as const;
    systemPrompt = `You are the Publishing Department.
    Your role is to administer rights, collect royalties, and manage the extensive music catalog.
    
    Responsibilities:
    1. Register works with PROs.
    2. Analyze publishing contracts.
    3. Track royalty streams.

    Be detailed, legalistic, and financially minded.`;

    tools = [{
        functionDeclarations: [
            {
                name: "analyze_contract",
                description: "Analyze a publishing contract.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_data: { type: "STRING", description: "Base64 file data." },
                        mime_type: { type: "STRING", description: "Mime type (application/pdf)." }
                    },
                    required: ["file_data", "mime_type"]
                }
            },
            {
                name: "register_work", // Mock tool
                description: "Register a new musical work with PROs.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Title of the work." },
                        writers: { type: "ARRAY", description: "List of writers.", items: { type: "STRING" } },
                        split: { type: "STRING", description: "Ownership split (e.g. 50/50)." }
                    },
                    required: ["title", "writers"]
                }
            }
        ]
    }];

    constructor() {
        super();
        this.functions = {
            register_work: async (args: { title: string, writers: string[], split: string }) => {
                return {
                    status: "submitted",
                    work_id: `ISWC-${Math.floor(Math.random() * 1000000)}`,
                    registration_date: new Date().toISOString(),
                    message: `Work '${args.title}' by ${args.writers.join(', ')} registered successfully.`
                };
            }
        };
    }
}
