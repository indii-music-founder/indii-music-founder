import { AgentConfig } from "@/services/agent/types";
import systemPrompt from './prompt.md?raw';
import { ScreenwriterTools } from "@/services/agent/tools/ScreenwriterTools";

export const ScreenwriterAgent: AgentConfig = {
    id: 'screenwriter',
    name: 'Screenwriter',
    description: 'Specializes in scriptwriting, formatting, and narrative structure.',
    color: 'bg-indigo-500',
    category: 'specialist',
    systemPrompt,
    tools: [{
        functionDeclarations: [
            {
                name: "format_screenplay",
                description: "Format raw text into standard screenplay format.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        text: { type: "STRING", description: "The raw text or rough draft." }
                    },
                    required: ["text"]
                }
            },
            {
                name: "analyze_script_structure",
                description: "Analyze the narrative structure of a script.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        script: { type: "STRING", description: "The script content." }
                    },
                    required: ["script"]
                }
            }
        ]
    }],
    functions: {
        format_screenplay: ScreenwriterTools.format_screenplay,
        analyze_script_structure: ScreenwriterTools.analyze_script_structure
    }
};
