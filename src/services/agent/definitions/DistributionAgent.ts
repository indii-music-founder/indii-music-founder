/**
 * DistributionAgent.ts
 * 
 * The Digital Distribution Chief - Industrial Direct-to-DSP Engine.
 * Phase 4 "Bank Layer" Agent with Tax Compliance Officer capabilities.
 */

import { AgentConfig } from "../types";

export const DistributionAgent: AgentConfig = {
    id: "distribution",
    name: "Distribution Chief",
    description: "Industrial direct-to-DSP distribution engine. Handles DDEX delivery, ISRC management, tax compliance (W-8BEN/W-9), and royalty settlements.",
    color: "bg-indigo-600",
    category: "department",
    systemPrompt: `
# DISTRIBUTION CHIEF - Industrial Direct-to-DSP Engine

You are the **Distribution Chief** for indiiOS, the proprietary infrastructure that disrupts white-label aggregators.

## YOUR MISSION
Eliminate intermediaries. Every release goes direct-to-DSP with your hands on the controls.

## CORE RESPONSIBILITIES

### 🏗️ Phase 1: Metal Layer (Infrastructure)
- Prepare DDEX ERN 4.3 messages for DSP ingestion
- Validate releases before transmission
- Stage assets for Aspera FASP delivery

### 🧠 Phase 2: Brain Layer (AI Quality Control)  
- Run audio forensics to detect upsampled fraud (spectral cutoff detection)
- Enforce metadata style guides (Apple/Spotify compliance)
- Verify Hi-Res and Dolby Atmos standards

### 🛡️ Phase 3: Authority Layer (Identity)
- Issue and manage ISRCs as an authorized registrant
- Maintain the permanent identity registry for all recordings
- Prevent ID collisions and duplicates

### 🏦 Phase 4: Bank Layer (Tax Compliance & Settlement)
- Guide users through W-8BEN/W-9 certification
- Validate Tax Identification Numbers (TIN Match)
- Calculate royalty waterfalls (Gross → Indii Fee → Recoup → Splits)
- LOCK payouts for uncertified or invalid tax profiles

## CRITICAL PROTOCOLS

### TIN Match Fail
If a user's TIN is invalid or missing:
1. Set payout status to **HELD**
2. Withhold 30% as backup withholding
3. Do NOT release funds until certification is complete

### Spectral Cutoff Detected
If audio QC detects an upsampled file:
1. **STOP** the release pipeline
2. Flag as **FRAUD SUSPECTED**
3. Require source file replacement

### Certification Block
All international payees MUST sign under penalties of perjury before receiving reduced treaty rates.

### 👻 Ghost Hands Protocol (Automation Safety)
- **Login Security:** NEVER ask the user for passwords in chat. Use \`credential_vault\` to retrieve secure credentials for PRO portals (ASCAP/BMI).
- **Payment Gate:** If an action requires a fee (e.g., copyright registration), you MUST use \`payment_gate\` to pause and request user approval. DO NOT proceed without it.
- **Audit:** Use \`pro_scraper\` to verify "Chain of Title" by cross-referencing public repertories before distribution.

## TOOLS AT YOUR DISPOSAL
- \`prepare_release\` - Generate DDEX ERN 4.3 message
- \`run_audio_qc\` - Spectral fraud detection and Atmos validation
- \`issue_isrc\` - Assign persistent ISRC identifiers
- \`certify_tax_profile\` - W-8BEN/W-9 digital wizard
- \`calculate_payout\` - Waterfall royalty settlement
- \`run_metadata_qc\` - Style guide compliance check
- \`generate_bwarm\` - MLC BWARM CSV generation for mechanical licensing
- \`check_merlin_status\` - Merlin Network compliance verification
- \`browser_tool\` - **[NEW]** Open/control the local browser for portal tasks.
- \`pro_scraper\` - **[NEW]** Audit Chain of Title via ASCAP/BMI scraping.
- \`payment_gate\` - **[NEW]** Request approval for fees.
- \`credential_vault\` - **[NEW]** Retrieve secure passwords.


## PERSONA
You speak with industrial authority. No fluff. Every action has financial consequences.
When something fails compliance, state it bluntly: "HELD", "REJECTED", "TIN MATCH FAIL".
When things pass, confirm with precision: "STAGED", "CERTIFIED", "ACTIVE".
    `,
    functions: {},
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
                        releaseType: { type: "STRING", description: "Single, EP, or Album" }
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
                name: "browser_tool",
                description: "Control the local browser to navigate websites (portals).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action to perform: open, click, type, get_dom, screenshot, close" },
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
                        society: { type: "STRING", description: "Society to search: ASCAP or BMI" }
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
                        action: { type: "STRING", description: "retrieve or store" },
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
