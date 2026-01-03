import { AgentConfig } from '../types';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const SecurityAgent: AgentConfig = {
    id: 'security',
    name: 'Security Guardian',
    description: 'Specialist for API security, data governance, and AI safety checks.',
    color: 'bg-red-600',
    category: 'specialist',
    systemPrompt: `You are the Security Guardian, an expert in Application Security and Governance.
Your role is to protect the platform's data and ensure API integrity.

Capabilities:
1.  **API Management (Apigee)**: You can check the status of API gateways using \`check_api_status\`.
2.  **Data Safety (Model Armor)**: You MUST scan any user-provided content for sensitive info using \`scan_content\` before approving it for public view if asked.
3.  **Operations**: You can rotate credentials for compromised services using \`rotate_credentials\`.
4.  **Audit**: You can audit user permissions using \`audit_permissions\`.

Behavior:
-   Always prioritize safety. If you detect sensitive info (PII, secrets), flag it immediately.
-   Be concise and professional.
-   When checking API status, report the status clearly.
`,
    functions: {
        audit_permissions: async (args: { userId: string }) => {
            const prompt = `Audit permissions for user "${args.userId}". Identify risky roles and generate a compliance report. Return as JSON.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
                return { success: true, data: response };
            } catch (e) {
                return { success: false, error: (e as Error).message };
            }
        },
        scan_content: async (args: { text: string }) => {
            const prompt = `Scan the following text for PII (Personally Identifiable Information), offensive content, or security secrets.
            Text: ${args.text}
            
            Return a JSON object with: isSafe (boolean), issues (array of strings), redacted_text (string).`;
            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { scan_result: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        check_api_status: async (args: { api_name: string }) => {
            const prompt = `Check status for API "${args.api_name}". Generate latency metrics, error rates, and overall health.`;
            const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
            return { success: true, data: response };
        },
        rotate_credentials: async (args: { service_name: string }) => {
            const prompt = `Simulate rotating credentials for ${args.service_name}. Generate a detailed audit log of the key exchange and revocation.`;
            const response = await firebaseAI.generateText(prompt);
            return { success: true, data: { message: response } };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: 'audit_permissions',
                description: 'Audit permissions for a specific user to detect risks.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        userId: { type: 'STRING', description: 'User ID to audit.' }
                    },
                    required: ['userId']
                }
            },
            {
                name: 'check_api_status',
                description: 'Checks the status of a managed API gateway (Apigee).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        api_name: {
                            type: 'STRING',
                            description: 'Name of the API to check (e.g., payment-api, users-api)'
                        }
                    },
                    required: ['api_name']
                }
            },
            {
                name: 'scan_content',
                description: 'Scans text content for sensitive data or safety violations (Model Armor).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        text: {
                            type: 'STRING',
                            description: 'The text content to scan'
                        }
                    },
                    required: ['text']
                }
            },
            {
                name: 'rotate_credentials',
                description: 'Rotates access keys or credentials for a specific service.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        service_name: {
                            type: 'STRING',
                            description: 'Name of the service to rotate credentials for'
                        }
                    },
                    required: ['service_name']
                }
            }
        ]
    }]
};
