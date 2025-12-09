import { AgentConfig } from './BaseAgent';
import { MusicTools } from './tools/MusicTools';
import { LegalTools } from './tools/LegalTools';

export const AGENT_CONFIGS: AgentConfig[] = [
    {
        id: 'marketing',
        name: 'Marketing Department',
        description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
        color: 'bg-orange-500',
        category: 'manager',
        systemPrompt: `You are the Campaign Manager.
    Your role is to design and execute comprehensive marketing campaigns.

    Responsibilities:
    1. Develop strategic campaign concepts.
    2. Create content calendars and distribution plans.
    3. Coordinate messaging across social, email, and web channels.
    4. Analyze campaign performance and adjust strategy.

    Think holistically about the brand's narrative and audience engagement.`,
        tools: []
    },
    {
        id: 'legal',
        name: 'Legal Department',
        description: 'Drafts contracts, reviews compliance, and manages intellectual property.',
        color: 'bg-red-700',
        category: 'department',
        systemPrompt: `You are the Head of Legal.
    Your role is to protect the studio and its artists.

    Responsibilities:
    1. Draft and review contracts (recording, publishing, touring).
    2. Manage copyright and trademark registrations.
    3. Ensure compliance with labor laws and industry regulations.
    4. Advise on risk management.

    Be precise, cautious, and formal in your language.`,

        functions: {
            analyze_contract: LegalTools.analyze_contract,
            generate_nda: LegalTools.generate_nda
        },
        tools: [{
            functionDeclarations: [
                {
                    name: "analyze_contract",
                    description: "Analyze a legal contract for risks and provide a summary.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            fileData: { type: "STRING", description: "Base64 encoded file data." },
                            mimeType: { type: "STRING", description: "MIME type of the file (e.g., application/pdf)." }
                        },
                        required: ["fileData"]
                    }
                },
                {
                    name: "generate_nda",
                    description: "Generate a generic NDA for specified parties.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            parties: { type: "ARRAY", items: { type: "STRING" }, description: "List of parties involved." },
                            purpose: { type: "STRING", description: "The purpose of the NDA." }
                        },
                        required: ["parties"]
                    }
                }
            ]
        }]
    },
    {
        id: 'finance',
        name: 'Finance Department',
        description: 'Manages budgets, ROI analysis, and financial planning.',
        color: 'bg-teal-600',
        category: 'department',
        systemPrompt: `You are the Finance Department.
    Your role is to oversee the financial health of the studio and its projects.

            Responsibilities:
        1. Analyze budgets and expenses.
    2. Forecast project ROI.
    3. Approve or reject financial requests.

    Be conservative, analytical, and numbers- driven.`,
        functions: {
            analyze_budget: async (args: { amount: number, breakdown: string }) => {
                const efficiency = args.amount < 50000 ? "High" : "Medium";
                return {
                    status: "approved",
                    efficiency_rating: efficiency,
                    notes: `Budget of $${args.amount} is within acceptable limits.Breakdown: ${args.breakdown}`,
                    timestamp: new Date().toISOString()
                };
            }
        },
        tools: [{
            functionDeclarations: [
                {
                    name: "analyze_budget",
                    description: "Analyze a project budget or expense report.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            project_id: { type: "STRING", description: "ID of the project." },
                            amount: { type: "NUMBER", description: "Total budget amount." },
                            breakdown: { type: "STRING", description: "Breakdown of costs." }
                        },
                        required: ["amount"]
                    }
                }
            ]
        }]
    },
    {
        id: 'music',
        name: 'Music Supervisor',
        description: 'Manages music selection and licensing.',
        color: 'bg-lime-500',
        category: 'specialist',
        systemPrompt: `You are the Music Supervisor for a creative studio.
    Your role is to analyze audio requirements and suggest tracks.
    You understand BPM, key, mood, and genre.
    Be precise about musical terminology.`,
        functions: {
            analyze_audio: MusicTools.analyze_audio,
            get_audio_metadata: MusicTools.get_audio_metadata
        },
        tools: [{
            functionDeclarations: [{
                name: 'analyze_audio',
                description: 'Analyze an audio file for BPM, key, energy, and mood.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        filePath: { type: 'STRING', description: 'Absolute path to the audio file.' }
                    },
                    required: ['filePath']
                }
            }, {
                name: 'get_audio_metadata',
                description: 'Retrieve metadata for an audio file using its hash.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        hash: { type: 'STRING', description: 'The unique hash of the audio file.' }
                    },
                    required: ['hash']
                }
            }]
        }]
    },
    {
        id: 'director',
        name: 'Creative Director',
        description: 'Oversees the creative vision and direction of projects.',
        color: 'bg-pink-500',
        category: 'manager',
        systemPrompt: `You are the Creative Director.
    Your role is to conceptualize and generate stunning visuals.

    Responsibilities:
1. Generate images based on user requests.
    2. Provide art direction and style advice.
    3. Refine prompts for better visual output.
    
    Use the 'generate_image' tool to create visuals.`,
        tools: [{
            functionDeclarations: [
                {
                    name: "generate_image",
                    description: "Generate images based on a text prompt.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "The visual description." },
                            count: { type: "NUMBER", description: "Number of images (default 1)." },
                            negativePrompt: { type: "STRING", description: "What to avoid." }
                        },
                        required: ["prompt"]
                    }
                },
                {
                    name: "batch_edit_images",
                    description: "Edit uploaded images using a text instruction.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "The editing instruction." },
                            imageIndices: { type: "ARRAY", description: "Optional list of indices to edit.", items: { type: "NUMBER" } }
                        },
                        required: ["prompt"]
                    }
                },
                {
                    name: "generate_video",
                    description: "Generate a video from a text prompt or start image.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "Description of motion/scene." },
                            image: { type: "STRING", description: "Optional base64 start image." },
                            duration: { type: "NUMBER", description: "Duration in seconds." }
                        },
                        required: ["prompt"]
                    }
                },
                {
                    name: "batch_edit_videos",
                    description: "Edit/grade uploaded videos with an instruction.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "Editing instruction." },
                            videoIndices: { type: "ARRAY", description: "Optional list of indices.", items: { type: "NUMBER" } }
                        },
                        required: ["prompt"]
                    }
                },
                {
                    name: "run_showroom_mockup",
                    description: "Generate a product mockup in the Showroom.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            productType: { type: "STRING", enum: ['T-Shirt', 'Hoodie', 'Mug', 'Bottle', 'Poster', 'Phone Screen'] },
                            scenePrompt: { type: "STRING", description: "Visual description of the scene." }
                        },
                        required: ["productType", "scenePrompt"]
                    }
                },
                {
                    name: "generate_high_res_asset",
                    description: "Generate a 4K/UHD asset for physical media printing using Nano Banana Pro.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING", description: "Visual description of the asset." },
                            templateType: { type: "STRING", description: "The physical format (e.g. 'cd_front', 'vinyl_jacket')." },
                            style: { type: "STRING", description: "Artistic style." }
                        },
                        required: ["prompt", "templateType"]
                    }
                }
            ]
        }]
    },
    {
        id: 'video',
        name: 'Video Department',
        description: 'Specializes in video production, editing, and VFX.',
        color: 'bg-blue-500',
        category: 'department',
        systemPrompt: `You are the Head of Video Production.
    Your role is to bring visual stories to life.

    Responsibilities:
1. Direct music videos and promotional content.
    2. oversee video editing and color grading.
    3. Manage VFX and animation workflows.
    4. Ensure visual consistency with the brand.

    Think cinematically.`,
        tools: []
    },
    {
        id: 'social',
        name: 'Social Media Department',
        description: 'Manages social media presence, trends, and community engagement.',
        color: 'bg-blue-400',
        category: 'department',
        systemPrompt: `You are the Social Media Department.
    Your role is to manage the brand's online presence, engage with the community, and track trends.

Responsibilities:
1. Create engaging social content.
    2. Monitor trends and sentiment.
    3. Interact with the community in the brand's voice.

    Be trendy, responsive, and engaging.`,
        functions: {
            analyze_trends: async (args: { topic: string }) => {
                return {
                    trend_score: 85,
                    sentiment: "positive",
                    keywords: ["viral", "trending", "hot"],
                    summary: `The topic '${args.topic}' is currently trending with positive sentiment.`
                };
            }
        },
        tools: [{
            functionDeclarations: [
                {
                    name: "generate_social_post",
                    description: "Generate a social media post.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            platform: { type: "STRING", description: "Platform (Twitter, LinkedIn, Instagram, etc)." },
                            topic: { type: "STRING", description: "What the post is about." },
                            tone: { type: "STRING", description: "Desired tone." }
                        },
                        required: ["platform", "topic"]
                    }
                },
                {
                    name: "analyze_trends",
                    description: "Analyze current trends for a topic.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            topic: { type: "STRING", description: "Topic to analyze." }
                        },
                        required: ["topic"]
                    }
                }
            ]
        }]
    },
    {
        id: 'publicist',
        name: 'Publicist',
        description: 'Manages public relations and media communications.',
        color: 'bg-orange-400',
        category: 'manager',
        systemPrompt: `You are the Publicist(Manager Level) for a creative studio.
    Your role is to manage the brand's public image, write press releases, and handle crisis communication.
DISTINCTION: You are NOT the Publishing Department(which handles rights / royalties).
    Be professional, articulate, and strategic.`,
        tools: [{
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
        }]
    },
    {
        id: 'road',
        name: 'Road Manager',
        description: 'Manages logistics and tour planning.',
        color: 'bg-yellow-500',
        category: 'manager',
        systemPrompt: `You are the Road Manager.
    Your role is to handle logistics, scheduling, and operational details.

    Responsibilities:
1. Create detailed itineraries and schedules.
    2. Manage logistics for events and tours.
    3. Anticipate operational risks and propose solutions.

    Be practical, organized, and detail - oriented.`,
        tools: [{
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
        }]
    },
    {
        id: 'publishing',
        name: 'Publishing Department',
        description: 'Manages musical rights, royalties, and catalog administration.',
        color: 'bg-rose-500',
        category: 'department',
        systemPrompt: `You are the Publishing Department.
    Your role is to administer rights, collect royalties, and manage the extensive music catalog.

    Responsibilities:
1. Register works with PROs.
    2. Analyze publishing contracts.
    3. Track royalty streams.

    Be detailed, legalistic, and financially minded.`,
        functions: {
            register_work: async (args: { title: string, writers: string[], split: string }) => {
                return {
                    status: "submitted",
                    work_id: `ISWC - ${Math.floor(Math.random() * 1000000)} `,
                    registration_date: new Date().toISOString(),
                    message: `Work '${args.title}' by ${args.writers.join(', ')} registered successfully.`
                };
            }
        },
        tools: [{
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
                    name: "register_work",
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
        }]
    },
    {
        id: 'licensing',
        name: 'Licensing Department',
        description: 'Manages rights clearances and third-party licensing deals.',
        color: 'bg-indigo-600',
        category: 'department',
        systemPrompt: `You are the Licensing Department.
    Your role is to clear rights for samples, sync deals, and third - party content.

    Responsibilities:
1. Check rights availability.
    2. Negotiate sync licenses.
    3. Ensure all content is cleared for release.

    Be diligent, cautious, and thorough.`,
        functions: {
            check_availability: async (args: { title: string, artist: string, usage: string }) => {
                // Determine random availability
                const available = Math.random() > 0.3;
                return {
                    status: available ? "available" : "restricted",
                    title: args.title,
                    artist: args.artist,
                    quote: available ? "$2,500" : "N/A",
                    notes: available
                        ? `Cleared for ${args.usage}.Contact label for final signature.`
                        : `Rights held by estate.Clearance unlikely for ${args.usage}.`
                };
            }
        },
        tools: [{
            functionDeclarations: [
                {
                    name: "check_availability",
                    description: "Check if a piece of content is available for licensing.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING", description: "Title of work." },
                            artist: { type: "STRING", description: "Artist name." },
                            usage: { type: "STRING", description: "Intended usage (e.g. film, social, ad)." }
                        },
                        required: ["title", "artist"]
                    }
                },
                {
                    name: "analyze_contract",
                    description: "Analyze a licensing agreement.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            file_data: { type: "STRING", description: "Base64 file data." },
                            mime_type: { type: "STRING", description: "Mime type." }
                        },
                        required: ["file_data", "mime_type"]
                    }
                }
            ]
        }]
    },
    {
        id: 'brand',
        name: 'Brand Manager',
        description: 'Ensures brand consistency, visual identity, and tone of voice across all outputs.',
        color: 'bg-amber-500',
        category: 'manager',
        systemPrompt: `You are the Brand Manager.
    Your role is to strictly enforce the brand's visual identity, tone of voice, and core values.

Responsibilities:
1. Review content for brand alignment.
    2. Provide specific feedback on colors, fonts, and tone.
    3. Maintain the "Show Bible" consistency.

    Always reference the Brand Context provided in the prompt.`,
        tools: [{
            functionDeclarations: [{
                name: 'verify_output',
                description: 'Critique and verify generated content against a goal (Brand Bible).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        goal: { type: 'STRING', description: 'The original goal or brand guidelines.' },
                        content: { type: 'STRING', description: 'The content to verify.' }
                    },
                    required: ['goal', 'content']
                }
            }]
        }]
    }
];
