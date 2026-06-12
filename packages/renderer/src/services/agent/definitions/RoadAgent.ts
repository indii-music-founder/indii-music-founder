import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';

import systemPrompt from '@agents/road/prompt.md?raw';
import { RoadTools } from '../tools/RoadTools';
import { ProjectTools } from '../tools/ProjectTools';
import { KnowledgeTools } from '../tools/KnowledgeTools';
import { SocialTools } from '../tools/SocialTools';
import { UniversalTools } from '../tools/UniversalTools';

export const RoadAgent: AgentConfig = {
    id: 'road',
    name: 'Road Director',
    description: 'Manages logistics and tour planning.',
    color: 'bg-slate-500',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            plan_tour_route: RoadTools.plan_tour_route,
            calculate_tour_budget: RoadTools.calculate_tour_budget,
            create_project: ProjectTools.create_project,
            search_knowledge: KnowledgeTools.search_knowledge,
            search_places: RoadTools.search_places,
            get_place_details: RoadTools.get_place_details,
            get_distance_matrix: RoadTools.get_distance_matrix,
            generate_social_post: SocialTools.generate_social_post,
            browser_tool: UniversalTools.browser_tool,
            credential_vault: UniversalTools.credential_vault,
            generate_visa_checklist: RoadTools.generate_visa_checklist,
            generate_itinerary: RoadTools.generate_itinerary,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['plan_tour_route', 'calculate_tour_budget', 'create_project', 'search_knowledge', 'search_places', 'get_place_details', 'get_distance_matrix', 'generate_social_post', 'browser_tool', 'credential_vault', 'generate_visa_checklist', 'generate_itinerary'],
    tools: [{
        functionDeclarations: [
            {
                name: "plan_tour_route",
                description: "Plan an optimized route for a tour.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        start_location: { type: "STRING", description: "Starting city." },
                        end_location: { type: "STRING", description: "Ending city." },
                        stops: { type: "ARRAY", items: { type: "STRING" }, description: "List of stops." }
                    },
                    required: ["start_location", "end_location"]
                }
            },
            {
                name: "calculate_tour_budget",
                description: "Calculate estimated budget for a tour.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        duration_days: { type: "NUMBER", description: "Length of tour in days." },
                        crew_size: { type: "NUMBER", description: "Number of people." }
                    },
                    required: ["duration_days", "crew_size"]
                }
            },
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
                name: "search_places",
                description: "Search for real-world places (venues, hotels, stores) using Google Maps.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query (e.g., 'Jazz clubs in Chicago')." },
                        type: { type: "STRING", description: "Optional place type (e.g., 'restaurant')." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_place_details",
                description: "Get details (address, phone, rating) for a specific place by ID.",
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
                description: "Calculate driving distance and time between locations.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        origins: { type: "ARRAY", description: "Starting points (addresses or cities).", items: { type: "STRING" } },
                        destinations: { type: "ARRAY", description: "Destinations (addresses or cities).", items: { type: "STRING" } }
                    },
                    required: ["origins", "destinations"]
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
            },
            {
                name: "browser_tool",
                description: "Use a web browser for navigation, traffic checks, or venue research.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action: open, click, type, get_dom, screenshot" },
                        url: { type: "STRING", description: "URL to open" },
                        selector: { type: "STRING" },
                        text: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "credential_vault",
                description: "Retrieve passwords for booking portals securely.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "retrieve" },
                        service: { type: "STRING", description: "Service name (e.g. Airbnb)" }
                    },
                    required: ["action", "service"]
                }
            },
            {
                name: "generate_visa_checklist",
                description: "Generates an automated documentation tracker for international touring requirements (e.g., P2 visas for US, Tier 5 for UK).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        artistCitizenship: { type: "STRING", description: "The origin country of the artist." },
                        tourDestination: { type: "STRING", description: "The destination country or region (e.g., 'United States', 'European Union')." },
                        crewSize: { type: "NUMBER", description: "Total number of touring personnel needing visas." },
                        timelineDays: { type: "NUMBER", description: "Days until the first tour date." }
                    },
                    required: ["artistCitizenship", "tourDestination", "timelineDays"]
                }
            },
            {
                name: "generate_itinerary",
                description: "Generate a detailed day-by-day tour itinerary including travel, load-in, soundcheck, and show times.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        tour_name: { type: "STRING", description: "Name of the tour." },
                        start_date: { type: "STRING", description: "Start date (YYYY-MM-DD)." },
                        end_date: { type: "STRING", description: "End date (YYYY-MM-DD)." },
                        cities: { type: "ARRAY", items: { type: "STRING" }, description: "List of cities to visit." }
                    },
                    required: ["tour_name", "start_date", "end_date", "cities"]
                }
            }
        ]
    }]
};

export default freezeAgentConfig(RoadAgent);
