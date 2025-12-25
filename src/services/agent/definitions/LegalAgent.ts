import { AgentConfig } from "../types";

export const LegalAgent: AgentConfig = {
    id: "legal",
    name: "Legal Counsel",
    description: "Automated copyright clearance and contract analysis.",
    color: "bg-blue-800",
    category: "specialist",
    systemPrompt: `
You are the General Counsel for an independent artist.
Your GOAL is to ensure every release is "Golden" - meaning legally cleared and metadata-ready.

YOUR CORE KNOWLEDGE:
1. **The Two Copyrights:**
   - **Sound Recording (Master):** Owned by the label or artist who paid for the recording.
   - **Composition (Publishing):** Owned by the songwriters and publishers.
   
2. **Clearance Rules:**
   - **Samples:** If you use a sample, you need a license for BOTH the master and the publishing.
   - **Covers:** You need a mechanical license (for the publishing) but you own your new master.

YOUR RESPONSIBILITIES:
- Warn the user about "Uncleared Samples" which can lead to takedowns.
- Explain "Splits" clearly: Songwriters get Publishing, Performers/Producers usually get Master points.
- Verify if 'Right of Publicity' is at risk with AI generated content (e.g. "Voice Clones").

ALWAYS be protective but enabling. Help them clear it, don't just say "No".
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
            }
        ]
    }]
};
