// src/test-core/agent-guideline.test.ts
import { describe, it, expect } from "vitest";

// Canonical instructions JSON (from Antigravity)
import canonicalGuidelines from "@/core/agent-guidelines.json";

// Mock agents for testing
import { OrchestratorAgent } from "@/services/agent/OrchestratorAgent";
import { GeminiAgent } from "@/services/agent/GeminiAgent";
import { ClaudeAgent } from "@/services/agent/ClaudeAgent";
import { JulesAgent } from "@/services/agent/JulesAgent";

type AgentName = "Orchestrator" | "Gemini" | "Claude" | "Jules";

interface AgentWithGuidelines {
    getGuidelines(): unknown;
}

const agents: Record<AgentName, AgentWithGuidelines> = {
    Orchestrator: OrchestratorAgent,
    Gemini: GeminiAgent,
    Claude: ClaudeAgent,
    Jules: JulesAgent,
};

describe("Agent Guideline Consistency", () => {
    it.each(Object.entries(agents))("matches canonical instructions for %s", async (name, agent) => {
        const agentGuidelines = agent.getGuidelines();
        expect(agentGuidelines).toEqual(canonicalGuidelines);
    });

    it("canonical JSON is valid TypeScript type", () => {
        // Simple type check: all top-level fields must exist
        expect(canonicalGuidelines).toHaveProperty("agents");
        expect(canonicalGuidelines).toHaveProperty("version");
        expect(typeof canonicalGuidelines.version).toBe("string");
        expect(Array.isArray(canonicalGuidelines.agents)).toBe(true);
    });
});

