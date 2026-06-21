import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';

import systemPrompt from '@agents/hospitality/prompt.md?raw';
import { ProjectTools } from '../tools/ProjectTools';
import { KnowledgeTools } from '../tools/KnowledgeTools';
import { SocialTools } from '../tools/SocialTools';
import { UniversalTools } from '../tools/UniversalTools';
import { RoadTools } from '../tools/RoadTools';

export const HospitalityAgent: AgentConfig = {
    id: 'hospitality',
    name: 'Hospitality Coordinator',
    description: 'Ensures exceptional artist care and venue hospitality through meticulous coordination.',
    color: 'bg-rose-500',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            search_places: RoadTools.search_places,
            get_place_details: RoadTools.get_place_details,
            get_distance_matrix: RoadTools.get_distance_matrix,
            create_project: ProjectTools.create_project,
            search_knowledge: KnowledgeTools.search_knowledge,
            generate_social_post: SocialTools.generate_social_post,
            browser_tool: UniversalTools.browser_tool,
            credential_vault: UniversalTools.credential_vault,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['search_places', 'get_place_details', 'get_distance_matrix', 'create_project', 'search_knowledge', 'generate_social_post', 'browser_tool', 'credential_vault'],
    tools: [{
        functionDeclarations: [
            {
                name: "search_places",
                description: "Find hotels, catering services, and vendors near venues.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query (e.g., 'Hotels in Nashville')." },
                        type: { type: "STRING", description: "Optional place type." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_place_details",
                description: "Get details on accommodations and vendors.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        place_id: { type: "STRING", description: "Google Place ID." }
                    },
                    required: ["place_id"]
                }
            },
            {
                name: "get_distance_matrix",
                description: "Calculate travel times between venues and accommodations.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        origins: { type: "ARRAY", description: "Starting points.", items: { type: "STRING" } },
                        destinations: { type: "ARRAY", description: "Destinations.", items: { type: "STRING" } }
                    },
                    required: ["origins", "destinations"]
                }
            },
            {
                name: "create_project",
                description: "Create a hospitality coordination project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Project name." },
                        type: { type: "STRING", enum: ["marketing", "creative", "music", "road"], description: "Project type." }
                    },
                    required: ["name"]
                }
            },
            {
                name: "search_knowledge",
                description: "Research touring standards and hospitality best practices.",
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
                description: "Draft hospitality updates for social media.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", description: "Platform (e.g. Instagram)." },
                        topic: { type: "STRING", description: "Update content." }
                    },
                    required: ["topic"]
                }
            },
            {
                name: "browser_tool",
                description: "Research venues, hotels, and catering services online.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action: open, click, type, get_dom" },
                        url: { type: "STRING", description: "URL to open" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "credential_vault",
                description: "Retrieve booking credentials for hotels and vendors securely.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "retrieve" },
                        service: { type: "STRING", description: "Service name (e.g. Airbnb)" }
                    },
                    required: ["action", "service"]
                }
            }
        ]
    }]
};

export default freezeAgentConfig(HospitalityAgent);
