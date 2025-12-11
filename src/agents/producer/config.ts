import { AgentConfig } from "@/services/agent/types";
import systemPrompt from './prompt.md?raw';
import { ProducerTools } from "@/services/agent/tools/ProducerTools";

export const ProducerAgent: AgentConfig = {
    id: 'producer',
    name: 'Producer',
    description: 'Manages logistics, scheduling, and budgets.',
    color: 'bg-emerald-600',
    category: 'manager',
    systemPrompt,
    tools: [{
        functionDeclarations: [
            {
                name: "create_call_sheet",
                description: "Generate a daily call sheet for the production.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING", description: "Date of the shoot." },
                        location: { type: "STRING", description: "Location name or address." },
                        cast: { type: "ARRAY", items: { type: "STRING" }, description: "List of cast members needed." }
                    },
                    required: ["date", "location", "cast"]
                }
            },
            {
                name: "breakdown_script",
                description: "Analyze a script for production requirements (props, costumes, etc).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        script: { type: "STRING", description: "Script text to analyze." }
                    },
                    required: ["script"]
                }
            }
        ]
    }],
    functions: {
        create_call_sheet: ProducerTools.create_call_sheet,
        breakdown_script: ProducerTools.breakdown_script
    }
};
