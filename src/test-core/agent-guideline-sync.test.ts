
import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to canonical agent guidelines
const canonicalPath = path.resolve(__dirname, "../../.docs/agent_guidelines.json");

// Define agent paths
const agentPaths = [
    path.resolve(__dirname, "../agents/Orchestrator/agent-guidelines.json"),
    path.resolve(__dirname, "../agents/Gemini/agent-guidelines.json"),
    path.resolve(__dirname, "../agents/Claude/agent-guidelines.json"),
    path.resolve(__dirname, "../agents/Jules/agent-guidelines.json"),
];

describe("Agent Guidelines Sync", () => {
    let canonicalJson: Record<string, unknown>;

    beforeAll(() => {
        const content = fs.readFileSync(canonicalPath, "utf8");
        canonicalJson = JSON.parse(content);
    });

    agentPaths.forEach((agentPath) => {
        it(`matches canonical guidelines for ${path.basename(path.dirname(agentPath))}`, () => {
            // 1. Fail fast if file is missing (do not auto-create)
            if (!fs.existsSync(agentPath)) {
                throw new Error(
                    `Agent guidelines file missing at ${agentPath}.\n` +
                    `Run 'npm run sync:agents' to generate it.`
                );
            }

            // 2. Read and parse
            const agentContent = fs.readFileSync(agentPath, "utf8");
            const agentJson = JSON.parse(agentContent);

            // 3. Strict equality check (excluding generated metadata)
            const { _comment, _generated, lastUpdated, ...cleanAgentJson } = agentJson as any;
            const { _comment: _c, _generated: _g, lastUpdated: _l, ...cleanCanonical } = canonicalJson as any;

            expect(cleanAgentJson).toEqual(cleanCanonical);
        });
    });
});
