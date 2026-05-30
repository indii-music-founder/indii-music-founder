const fs = require('fs');
const file = 'packages/renderer/src/services/agent/definitions/SecurityAgent.ts';
let content = fs.readFileSync(file, 'utf8');

const functionsBlock = `    functions: {
        scan_content: async (args: { text: string }) => {
            const prompt = \`Scan the following text for PII (Personally Identifiable Information), offensive content, or security secrets.
            Text: \${args.text}
            
            Return a JSON object with: isSafe (boolean), issues (array of strings), redacted_text (string).\`;
            try {
                const response = await AutonomousIntelligence.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: { scan_result: response } };
            } catch (e: unknown) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        }
    },`;

content = content.replace(/    functions: \{[\s\S]*?    \},\n    authorizedTools:/, functionsBlock + '\n    authorizedTools:');

content = content.replace(`                    properties: {
                        userId: { type: 'STRING', description: 'User ID to audit.' }
                    },
                    required: ['userId']`, `                    properties: {
                        project_id: { type: 'STRING', description: 'Project ID or Organization ID to audit.' }
                    }`);

content = content.replace(`                        target: { type: "STRING", description: "The system or URL to scan." }
                    },
                    required: ["target"]`, `                        scope: { type: "STRING", description: "The path or scope to scan." }
                    },
                    required: ["scope"]`);

fs.writeFileSync(file, content);
