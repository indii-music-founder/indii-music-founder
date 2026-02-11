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

const agents: Record<AgentName, any> = {
    Orchestrator: OrchestratorAgent,
    Gemini: GeminiAgent,
    Claude: ClaudeAgent,
    Jules: JulesAgent,
};

// Helper: fetch agent’s current guidelines
async function getAgentGuidelines(agent: any) {
    if (agent.getGuidelines) return agent.getGuidelines();
    // fallback for agents that expose a `guidelines` property
    return agent.guidelines ?? {};
}

// Recursive deep equality check with descriptive error
function compareGuidelines(
    expected: Record<string, any>,
    actual: Record<string, any>,
    path = ""
) {
    for (const key of Object.keys(expected)) {
        const fullPath = path ? `${path}.${key}` : key;
        expect(actual).toHaveProperty(key);
        const expectedVal = expected[key];
        const actualVal = actual[key];

        if (expectedVal && typeof expectedVal === "object" && !Array.isArray(expectedVal)) {
            compareGuidelines(expectedVal, actualVal, fullPath);
        } else {
            expect(actualVal).toEqual(expectedVal);
        }
    }
}

describe("Agent Guideline Consistency", () => {
    it("all agents match the canonical instructions", async () => {
        for (const [name, agent] of Object.entries(agents)) {
            const agentGuidelines = await getAgentGuidelines(agent);
            compareGuidelines(canonicalGuidelines, agentGuidelines);
        }
    });

    it("canonical JSON is valid TypeScript type", () => {
        // Simple type check: all top-level fields must exist
        expect(canonicalGuidelines).toHaveProperty("agents");
        expect(canonicalGuidelines).toHaveProperty("version");
        expect(typeof canonicalGuidelines.version).toBe("string");
        expect(Array.isArray(canonicalGuidelines.agents)).toBe(true);
    });
});
