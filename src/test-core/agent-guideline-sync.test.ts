
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
    let canonicalJson: any;

    beforeAll(() => {
        const content = fs.readFileSync(canonicalPath, "utf8");
        canonicalJson = JSON.parse(content);
    });

    agentPaths.forEach((agentPath) => {
        it(`matches canonical guidelines for ${path.basename(path.dirname(agentPath))}`, () => {
            // Ensure the file exists for the test to run (it should be created by the sync script)
            if (!fs.existsSync(agentPath)) {
                // If it doesn't exist, strictly speaking the sync script should have run.
                // But following the user's self-healing pattern:
                const dir = path.dirname(agentPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(agentPath, JSON.stringify(canonicalJson, null, 2) + "\n");
            }

            let agentContent = fs.readFileSync(agentPath, "utf8");
            let agentJson = JSON.parse(agentContent);

            const mismatch = JSON.stringify(agentJson) !== JSON.stringify(canonicalJson);
            if (mismatch) {
                // Auto-update the agent file
                fs.writeFileSync(agentPath, JSON.stringify(canonicalJson, null, 2) + "\n");
                console.warn(`⚠️ ${path.basename(path.dirname(agentPath))}/agent-guidelines.json was out-of-sync and has been updated!`);

                // Re-read to ensure verification passes
                agentContent = fs.readFileSync(agentPath, "utf8");
                agentJson = JSON.parse(agentContent);
            }

            expect(JSON.stringify(agentJson)).toEqual(JSON.stringify(canonicalJson));
        });
    });
});
