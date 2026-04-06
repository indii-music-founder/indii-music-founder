import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

const targets = {
    generalist: 15,
    director: 16,
    merchandise: 16,
    screenwriter: 16,
    brand: 16,
    licensing: 17,
    road: 17,
    video: 17,
    devops: 18
};

const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("API Key not found.");
    process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

async function main() {
    for (const [agent, targetCount] of Object.entries(targets)) {
        console.log(`\nGenerating ${targetCount} expert examples for ${agent}...`);

        let remaining = targetCount;
        const valid = [];

        while (remaining > 0) {
            const batchCount = Math.min(remaining, 10);
            console.log(`Requesting ${batchCount} examples...`);

            const prompt = `You are generating high-quality training data for the "${agent}" AI agent.
            
Generate EXACTLY ${batchCount} training examples representing EXPERT difficulty scenarios.
Each must be a valid JSON object on a single line. No markdown formatting.

Format schema:
{
  "agent_id": "${agent}",
  "scenario_id": "${agent}_expert_[random_slug]",
  "scenario": "very complex specialized task description",
  "category": "domain category",
  "quality_tier": "gold",
  "source": "expert_synth",
  "difficulty": "expert",
  "framing": "Detailed context and user situation",
  "input": {"user_message": "...", "context": {"key": "value"}},
  "expected": {"mode": "direct", "tools_called": ["some_tool", "if_any"], "response_contains": ["keyword1", "keyword2"], "output_sample": "Lengthy expert answer"}
}

Ensure:
- Expert-level domain knowledge is used. Give specific, deep expertise rather than generic answers.
- "difficulty" is exactly "expert".
- Output ONLY the JSON lines, one per line, no other text (do not wrap in \`\`\`json).`;

            try {
                const result = await genAI.models.generateContent({
                    model: 'gemini-3-pro-preview',
                    contents: prompt,
                    config: { temperature: 0.8 }
                });

                let text = result.text || '';
                text = text.replace(/^```json\s*/gm, '').replace(/^```\s*/gm, '');

                const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));

                let addedInBatch = 0;
                for (const line of lines) {
                    if (valid.length >= targetCount) break;
                    try {
                        JSON.parse(line);
                        valid.push(line);
                        addedInBatch++;
                    } catch (_e) { /* skip invalid JSON lines */ }
                }
                remaining -= addedInBatch;
                console.log(`Received ${addedInBatch} valid examples in this batch. Total so far: ${valid.length}/${targetCount}`);

            } catch (e) {
                console.error(`Failed to generate batch for ${agent}:`, e);
                break;
            }

            await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`Appending ${valid.length} valid examples for ${agent} to disk.`);

        const filePath = path.join(process.cwd(), 'docs', 'agent-training', 'datasets', `${agent}.jsonl`);
        for (const v of valid) {
            fs.appendFileSync(filePath, '\n' + v);
        }
    }
}

main().catch(console.error);
