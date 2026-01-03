import { AgentConfig } from "../types";
import systemPrompt from '@agents/road/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const RoadAgent: AgentConfig = {
    id: 'road-manager',
    name: 'Road Manager',
    description: 'Manages logistics and tour planning.',
    color: 'bg-yellow-500',
    category: 'manager',
    systemPrompt,
    functions: {
        plan_tour_route: async (args: { start_location: string, end_location: string, stops: string[] }) => {
            const prompt = `Plan a music tour route.
            Start: ${args.start_location}
            End: ${args.end_location}
            Stops: ${args.stops.join(', ')}
            
            Provide:
            1. Optimized Route Order
            2. Estimated Drive Times
            3. Recommended Rest Stops`;

            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { route_plan: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        calculate_tour_budget: async (args: { duration_days: number, crew_size: number }) => {
            const prompt = `Calculate a detailed tour budget. Duration: ${args.duration_days} days, Crew: ${args.crew_size}. Return a JSON with total_estimated_budget and breakdown (accommodation, travel, per_diem, contingency).`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
                return { success: true, data: response };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        },
        search_places: async (args: { query: string }) => {
            const prompt = `Simulate a Google Maps search for "${args.query}". Return a list of realistic venues/places with ratings and addresses.`;
            const response = await firebaseAI.generateText(prompt);
            return { success: true, data: { results: response } };
        },
        get_distance_matrix: async () => {
            const prompt = `Generate a realistic distance matrix for a tour route (e.g., LA to SF). Return distance and duration.`;
            const response = await firebaseAI.generateText(prompt);
            return { success: true, data: { matrix: response } };
        }
    },
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
            }
        ]
    }]
};
