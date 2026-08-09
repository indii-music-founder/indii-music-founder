import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';

import systemPrompt from '@agents/road/prompt.md?raw';
import { RoadTools } from '../tools/RoadTools';
import { ProjectTools } from '../tools/ProjectTools';
import { KnowledgeTools } from '../tools/KnowledgeTools';
import { SocialTools } from '../tools/SocialTools';
import { UniversalTools } from '../tools/UniversalTools';
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';



const roadRetrievalConfig = {
    'tour_itineraries': { path: 'tour_itineraries', requiresUserIdFilter: true },
    'tour_vehicles': { path: 'tour_vehicles', requiresUserIdFilter: true },
    'tour_rider_items': { path: 'tour_rider_items', requiresUserIdFilter: true },
    'tour_emergency_contacts': { path: 'tour_emergency_contacts', requiresUserIdFilter: true }
};
const roadRetrievalTools = buildDomainRetrievalTools('Road', roadRetrievalConfig);
const roadRetrievalDeclarations = buildDomainRetrievalDeclarations('Road', roadRetrievalConfig);

export const RoadAgent: AgentConfig = {
    id: 'road',
    name: 'Road Director',
    description: 'Manages logistics and tour planning.',
    color: 'bg-slate-500',
    category: 'department',
    systemPrompt: systemPrompt,
    get functions() {
        return {
            ...roadRetrievalTools,
            plan_tour_route: RoadTools.plan_tour_route,
            estimate_tour_budget: RoadTools.estimate_tour_budget,
            create_project: ProjectTools.create_project,
            search_knowledge: KnowledgeTools.search_knowledge,
            search_places: RoadTools.search_places,
            get_place_details: RoadTools.get_place_details,
            get_distance_matrix: RoadTools.get_distance_matrix,
            generate_social_post: SocialTools.generate_social_post,
            browser_tool: UniversalTools.browser_tool,
            credential_vault: UniversalTools.credential_vault,
            generate_visa_checklist: RoadTools.generate_visa_checklist,
            generate_technical_rider: RoadTools.generate_technical_rider,
            draft_tour_itinerary: RoadTools.draft_tour_itinerary,
            log_live_setlist_for_pro: RoadTools.log_live_setlist_for_pro,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['list_domain_records', 'plan_tour_route', 'estimate_tour_budget', 'create_project', 'search_knowledge', 'search_places', 'get_place_details', 'get_distance_matrix', 'generate_social_post', 'browser_tool', 'credential_vault', 'generate_visa_checklist', 'generate_technical_rider', 'draft_tour_itinerary', 'log_live_setlist_for_pro'],
    tools: [{
        functionDeclarations: [
            ...roadRetrievalDeclarations,
            {
                name: "plan_tour_route",
                description: "Create an ordered route draft from user-entered waypoints. Does not optimize routing or calculate distance, drive time, traffic, or audience reach.",
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
                name: "estimate_tour_budget",
                description: "Calculate a non-persisted planning estimate from disclosed fixed defaults. Does not obtain quotes, book services, or verify market prices.",
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
                description: "Unavailable until the secured Maps backend is connected. Calling this tool returns an explicit unavailable error and performs no search.",
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
                description: "Unavailable until the secured Maps backend is connected. Calling this tool returns an explicit unavailable error and no place details.",
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
                description: "Unavailable until the secured Maps backend is connected. Calling this tool returns an explicit unavailable error and no distance or drive time.",
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
                description: "Use the Electron browser bridge for manual web research when the bridge is available. This does not verify routing, traffic, venue availability, contact, or booking.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", enum: ["navigate", "extract", "capture", "click", "type", "scroll", "wait"], description: "Browser bridge operation." },
                        url: { type: "STRING", description: "Required for navigate or extract." },
                        selector: { type: "STRING", description: "Required for click, type, scroll, or wait." },
                        text: { type: "STRING", description: "Optional text for a type operation." }
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
                description: "Create an unverified travel-document planning checklist. Does not determine a visa route, eligibility, deadline, urgency, or approval likelihood.",
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
                name: "generate_technical_rider",
                description: "Generate an unsaved, unapproved technical-rider draft for human review. Does not create a PDF or send, approve, or export the rider.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        artistName: { type: "STRING", description: "Artist or act name." },
                        stageSetup: { type: "STRING", description: "User-provided stage and performer setup." },
                        audioRequirements: { type: "STRING", description: "User-provided audio requirements and preferences." }
                    },
                    required: ["artistName", "stageSetup", "audioRequirements"]
                }
            },
            {
                name: "draft_tour_itinerary",
                description: "Create and save an authenticated user's route draft from user-entered cities and a date range. Does not calculate routing, drive times, traffic, venues, or show-day operations.",
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
            },
            {
                name: "log_live_setlist_for_pro",
                description: "Save an authenticated user's live-performance setlist as an account draft for manual PRO filing. This does not submit to a PRO or calculate royalties.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        venue: { type: "STRING", description: "Venue where the performance occurred." },
                        date: { type: "STRING", description: "Performance date in YYYY-MM-DD format." },
                        tracks: { type: "ARRAY", items: { type: "STRING" }, description: "Performed track titles." }
                    },
                    required: ["venue", "date", "tracks"]
                }
            }
        ]
    }]
};

export default freezeAgentConfig(RoadAgent);
