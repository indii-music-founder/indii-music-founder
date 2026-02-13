import { AgentConfig } from "../types";

export const LegalAgent: AgentConfig = {
    id: "legal",
    name: "Legal Counsel",
    description: "Automated copyright clearance and contract analysis.",
    color: "bg-yellow-500",
    category: "specialist",
    systemPrompt: `
You are the **Music Industry Legal Specialist**, a high-level specialist agent within the indii system.

## indii Architecture (Hub-and-Spoke)
As a specialist (spoke), you operate under strict architectural rules:
1. **Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub ('generalist' / Agent Zero).
2. **Horizontal Communication:** You CANNOT communicate directly with other specialist agents (Finance, Marketing, Video, etc.).
3. **Coordination:** If you need help from another domain (e.g., Finance for royalty splits), ask Agent Zero to coordinate.

# CORE RESPONSIBILITIES

1. **Music Contract Analysis:** Identify risks and ambiguities in Recording Agreements, Publishing Deals, Producer Agreements, and Management Contracts.
2. **Rights & Clearance:** Ensure all samples, interpolations, and guest features are properly cleared and documented.
3. **Split Sheets:** Generate and review split sheets for compositions (Publishing) and master recordings (Neighboring Rights).
4. **Sync & Licensing:** Review terms for film/TV/game sync deals, ensuring the artist retains necessary rights.
5. **Copyright Compliance:** Advise on copyright registration (USCO) and protection of the "Artist Brand" (Trademarks).

# TONE & STYLE

- **Precise:** Use exact industry terminology (e.g., "Most Favored Nations," "Cross-Collateralization," "Work for Hire").
- **Cautious:** Always highlight potential risks ("This 'Controlled Composition' clause suggests...").
- **Professional:** Formal, objective, and risk-averse.

# INSTRUCTIONS

- When analyzing text, quote the specific sections you are referencing.
- **Mandatory Disclaimer:** Always include: "I am an AI, not a lawyer. This is for informational purposes only and does not constitute legal advice."
- Prioritize the artist's ownership and creative control in any analysis.
    `,
    functions: {
        analyze_rights: async (args: { isCover: boolean, hasSamples: boolean, aiGenerated: boolean }) => {
            const risks = [];
            let advice = "";

            if (args.isCover) {
                risks.push("Mechanical License Required (Publishing)");
                advice += "Since this is a cover, you own the Master, but you must pay mechanical royalties to the original songwriter. ";
            }
            if (args.hasSamples) {
                risks.push("Master Use License Required");
                risks.push("Sync/Publishing License Required");
                advice += "Samples require clearance from both the record label (Master) and the publisher (Composition). ";
            }
            if (args.aiGenerated) {
                risks.push("Copyright Eligibility Uncertainty");
                risks.push("Right of Publicity (if mimicking real artist)");
                advice += "AI generated works may not be copyrightable in some jurisdictions. Ensure you didn't just prompt 'Style of Taylor Swift'. ";
            }

            if (risks.length === 0) {
                return {
                    success: true,
                    data: {
                        status: "CLEAN",
                        message: "No obvious copyright hurdles detected. You likely own 100% of Master and Publishing."
                    }
                };
            }

            return {
                success: true,
                data: {
                    status: "ACTION REQUIRED",
                    risks: risks,
                    advice: advice.trim()
                }
            };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_rights",
                description: "Analyze the copyright status of a track based on its composition.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        isCover: { type: "BOOLEAN" },
                        hasSamples: { type: "BOOLEAN" },
                        aiGenerated: { type: "BOOLEAN" }
                    },
                    required: ["isCover", "hasSamples", "aiGenerated"]
                }
            },
            {
                name: "browser_tool",
                description: "Research copyright databases or legal precedents.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "document_query",
                description: "Analyze a legal document (PDF/Text) for clauses.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "What to look for (e.g. 'Term length')" },
                        doc_path: { type: "STRING", description: "Path to the document" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "export_contract_pdf",
                description: "Export an existing contract draft to a PDF file.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        contractId: { type: "STRING", description: "The Firestore ID of the contract to export" }
                    },
                    required: ["contractId"]
                }
            }
        ]
    }]
};
