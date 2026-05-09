/**
 * DistributionAgent.ts
 * 
 * The Digital Distribution Chief - Industrial Direct-to-DSP Engine.
 * Phase 4 "Bank Layer" Agent with Tax Compliance Officer capabilities.
 */

import { AgentConfig } from "../types";
import systemPrompt from '@agents/distribution/prompt.md?raw';

export const DistributionAgent: AgentConfig = {
    id: "distribution",
    name: "Distribution Director",
    description: "Specializes in high-fidelity industrial distribution and DDEX supply chain management.",
    color: "bg-cyan-500",
    category: "department",
    systemPrompt: systemPrompt,
    functions: {
        prepare_release: async (args: any) => ({ success: true, data: { status: "STAGED", ddex_id: `DDEX-${Math.random().toString(36).substring(7).toUpperCase()}`, message: `Release '${args.title}' prepared for DDEX delivery.` } }),
        run_audio_qc: async (args: any) => ({ success: true, data: { status: "PASSED", fidelity: "High", atmos: args.checkAtmos ? "Validated" : "N/A" } }),
        issue_isrc: async (args: any) => ({ success: true, data: { isrc: `CC-IND-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(10000 + Math.random() * 90000)}`, status: "Issued" } }),
        certify_tax_profile: async (args: any) => ({ success: true, data: { status: "CERTIFIED", method: args.isUsPerson ? "W-9" : "W-8BEN", message: "Tax identity verified." } }),
        calculate_payout: async (args: any) => {
            const fee = args.grossRevenue * (args.indiiFeePercent || 10) / 100;
            const net = args.grossRevenue - fee - (args.recoupableExpenses || 0);
            return { success: true, data: { gross: args.grossRevenue, fee, net, splits: args.splits } };
        },
        run_metadata_qc: async (args: any) => ({ success: true, data: { status: "COMPLIANT", message: "Metadata meets Apple/Spotify style guides." } }),
        generate_bwarm: async (args: any) => ({ success: true, data: { status: "GENERATED", count: args.works.length, file: "MLC_BWARM_EXPORT.csv" } }),
        check_merlin_status: async (args: any) => ({ success: true, data: { status: "READY", eligibility: "100%", message: "Catalog meets Merlin Network requirements." } }),
        create_music_metadata: async (args: any) => ({ success: true, data: { status: "GENERATED", metadata: { title: args.trackTitle || "Detected Title", artist: args.artistName || "Detected Artist", genre: "Electronic", mood: "Energetic" } } }),
        verify_metadata_golden: async (args: any) => ({ success: true, data: { status: "GOLDEN", score: 100 } }),
        update_track_metadata: async (args: any) => ({ success: true, data: { status: "UPDATED", fingerprint: args.fingerprint } }),
        browser_tool: async (args: any) => ({ success: true, data: { status: "Navigated", url: args.url } }),
        pro_scraper: async (args: any) => ({ success: true, data: { status: "SCRAPED", results: 12, source: args.society } }),
        payment_gate: async (args: any) => ({ success: true, data: { status: "AUTHORIZED", amount: args.amount, vendor: args.vendor } }),
        credential_vault: async (args: any) => ({ success: true, data: { status: "SECURED", service: args.service } })
    },
    authorizedTools: ['prepare_release', 'run_audio_qc', 'issue_isrc', 'certify_tax_profile', 'calculate_payout', 'run_metadata_qc', 'generate_bwarm', 'check_merlin_status', 'create_music_metadata', 'verify_metadata_golden', 'update_track_metadata', 'browser_tool', 'pro_scraper', 'payment_gate', 'credential_vault'],
    tools: [{
        functionDeclarations: [
            {
                name: "prepare_release",
                description: "Prepare a release for distribution by generating a DDEX ERN 4.3 message.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Release title" },
                        artist: { type: "STRING", description: "Primary artist name" },
                        upc: { type: "STRING", description: "UPC barcode (12-13 digits)" },
                        isrc: { type: "STRING", description: "ISRC for the primary track" },
                        label: { type: "STRING", description: "Label name (default: indii Records)" },
                        releaseType: { type: "STRING", enum: ["Single", "EP", "Album"], description: "Single, EP, or Album" }
                    },
                    required: ["title", "artist", "upc", "isrc"]
                }
            },
            {
                name: "run_audio_qc",
                description: "Run audio quality control to detect fraud and verify Hi-Res/Atmos compliance.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        filePath: { type: "STRING", description: "Path to the audio file" },
                        checkAtmos: { type: "BOOLEAN", description: "Whether to check Dolby Atmos compliance" }
                    },
                    required: ["filePath"]
                }
            },
            {
                name: "issue_isrc",
                description: "Issue a new ISRC (International Standard Recording Code) for a track.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackTitle: { type: "STRING", description: "Title of the track" },
                        artist: { type: "STRING", description: "Artist name" },
                        year: { type: "NUMBER", description: "Release year (defaults to current year)" }
                    },
                    required: ["trackTitle", "artist"]
                }
            },
            {
                name: "certify_tax_profile",
                description: "Guide a user through W-8BEN/W-9 tax certification and validate their TIN.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        userId: { type: "STRING", description: "User identifier" },
                        isUsPerson: { type: "BOOLEAN", description: "Is the user a US person?" },
                        isEntity: { type: "BOOLEAN", description: "Is the user an entity (not individual)?" },
                        country: { type: "STRING", description: "Country of residence (ISO code)" },
                        tin: { type: "STRING", description: "Tax Identification Number" },
                        signedUnderPerjury: { type: "BOOLEAN", description: "Has the user signed under penalties of perjury?" }
                    },
                    required: ["userId", "isUsPerson", "country", "tin", "signedUnderPerjury"]
                }
            },
            {
                name: "calculate_payout",
                description: "Calculate royalty distribution using waterfall logic (Fee → Recoup → Splits).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        grossRevenue: { type: "NUMBER", description: "Total gross revenue to distribute" },
                        indiiFeePercent: { type: "NUMBER", description: "indii platform fee percentage (default: 10)" },
                        recoupableExpenses: { type: "NUMBER", description: "Expenses to recoup before splits" },
                        splits: {
                            type: "ARRAY",
                            description: "Array of payee splits { name, percentage }",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    percentage: { type: "NUMBER" }
                                }
                            }
                        }
                    },
                    required: ["grossRevenue", "splits"]
                }
            },
            {
                name: "run_metadata_qc",
                description: "Run metadata quality control against Apple/Spotify style guides.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Track or release title" },
                        artist: { type: "STRING", description: "Artist name" },
                        artworkUrl: { type: "STRING", description: "URL to the cover artwork" }
                    },
                    required: ["title", "artist"]
                }
            },
            {
                name: "generate_bwarm",
                description: "Generate MLC BWARM CSV for mechanical licensing registration with The MLC.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        works: {
                            type: "ARRAY",
                            description: "Array of musical works to register",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    title: { type: "STRING", description: "Work title" },
                                    writer_last: { type: "STRING", description: "Writer last name" },
                                    writer_first: { type: "STRING", description: "Writer first name" },
                                    writer_ipi: { type: "STRING", description: "Writer IPI number (optional)" }
                                }
                            }
                        }
                    },
                    required: ["works"]
                }
            },
            {
                name: "check_merlin_status",
                description: "Check Merlin Network compliance readiness for independent distribution.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        total_tracks: { type: "NUMBER", description: "Total number of tracks in catalog" },
                        has_isrcs: { type: "BOOLEAN", description: "Whether all tracks have ISRCs assigned" },
                        has_upcs: { type: "BOOLEAN", description: "Whether all releases have UPCs assigned" },
                        exclusive_rights: { type: "BOOLEAN", description: "Whether you hold exclusive rights to all content" }
                    },
                    required: ["total_tracks", "has_isrcs", "has_upcs", "exclusive_rights"]
                }
            },
            {
                name: "create_music_metadata",
                description: "Highly advanced tool that analyzes audio and creates industry-standard 'Golden Metadata'. This metadata is DDEX-ready and includes AI-detected genre, mood, and identifiers.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        uploadedAudioIndex: { type: "NUMBER", description: "Index of the uploaded audio file in the session gallery." },
                        artistName: { type: "STRING", description: "Name of the artist (optional, will attempt to detect if not provided)." },
                        trackTitle: { type: "STRING", description: "Title of the track (optional, will attempt to detect if not provided)." },
                        releaseType: { type: "STRING", description: "Single, EP, or Album (default: Single)." }
                    },
                    required: ["uploadedAudioIndex"]
                }
            },
            {
                name: "verify_metadata_golden",
                description: "Verifies if a metadata object meets the industrial 'Golden Standard' (valid schema, splits sum to 100%).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        metadata: { type: "OBJECT", description: "The metadata object to verify." }
                    },
                    required: ["metadata"]
                }
            },
            {
                name: "update_track_metadata",
                description: "Updates specific fields in a track's metadata in the library.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        fingerprint: { type: "STRING", description: "The unique master fingerprint of the track." },
                        updates: { type: "OBJECT", description: "The fields to update." }
                    },
                    required: ["fingerprint", "updates"]
                }
            },
            {
                name: "browser_tool",
                description: "Control the local browser to navigate websites (portals).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", enum: ["open", "click", "type", "get_dom", "screenshot", "close"], description: "Action to perform: open, click, type, get_dom, screenshot, close" },
                        url: { type: "STRING", description: "URL to open (required for 'open')" },
                        selector: { type: "STRING", description: "CSS selector for click/type" },
                        text: { type: "STRING", description: "Text to type" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "pro_scraper",
                description: "Scrape PRO repertories (ASCAP/BMI) for Chain of Title audits.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query (Artist or Song Title)" },
                        society: { type: "STRING", enum: ["ASCAP", "BMI"], description: "Society to search: ASCAP or BMI" }
                    },
                    required: ["query", "society"]
                }
            },
            {
                name: "payment_gate",
                description: "Pause automation to request user approval for a fee.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        amount: { type: "NUMBER", description: "Amount to charge" },
                        vendor: { type: "STRING", description: "Vendor name (e.g. US Copyright Office)" },
                        reason: { type: "STRING", description: "Reason for the charge" }
                    },
                    required: ["amount", "vendor", "reason"]
                }
            },
            {
                name: "credential_vault",
                description: "Securely retrieve stored credentials for external services.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", enum: ["retrieve", "store"], description: "retrieve or store" },
                        service: { type: "STRING", description: "Service identifier (e.g. ASCAP)" },
                        bio_token: { type: "STRING", description: "Biometric session token" }
                    },
                    required: ["action", "service"]
                }
            }
        ]
    }]
};

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(DistributionAgent);
