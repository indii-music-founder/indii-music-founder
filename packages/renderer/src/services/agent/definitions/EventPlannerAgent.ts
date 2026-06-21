import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';

import systemPrompt from '@agents/event-planner/prompt.md?raw';
import { ProjectTools } from '../tools/ProjectTools';
import { KnowledgeTools } from '../tools/KnowledgeTools';
import { SocialTools } from '../tools/SocialTools';
import { UniversalTools } from '../tools/UniversalTools';
import { RoadTools } from '../tools/RoadTools';

export const EventPlannerAgent: AgentConfig = {
    id: 'event-planner',
    name: 'Event Production Director',
    description: 'Designs and executes end-to-end event production through planning and vendor coordination.',
    color: 'bg-purple-500',
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
                description: "Find venues and production vendors.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query (e.g., 'Concert venues in Austin')." },
                        type: { type: "STRING", description: "Optional place type." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_place_details",
                description: "Retrieve venue specifications and capacity.",
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
                description: "Calculate travel times between venues for multi-stop events.",
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
                description: "Create an event production project for tracking.",
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
                description: "Research event production standards and technical requirements.",
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
                description: "Generate event announcements and promotional copy.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", description: "Platform (e.g. Instagram)." },
                        topic: { type: "STRING", description: "Event announcement content." }
                    },
                    required: ["topic"]
                }
            },
            {
                name: "browser_tool",
                description: "Research venues, promoters, and production services online.",
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
                description: "Retrieve contact info and booking credentials for venues and vendors.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "retrieve" },
                        service: { type: "STRING", description: "Service name" }
                    },
                    required: ["action", "service"]
                }
            }
        ]
    }]
};

export default freezeAgentConfig(EventPlannerAgent);
