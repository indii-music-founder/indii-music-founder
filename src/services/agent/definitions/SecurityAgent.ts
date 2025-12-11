import { AgentConfig } from '../types';

export const SecurityAgent: AgentConfig = {
    id: 'security-agent',
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

Behavior:
-   Always prioritize safety. If you detect sensitive info (PII, secrets), flag it immediately.
-   Be concise and professional.
-   When checking API status, report the status clearly.
`,
    tools: [{
        functionDeclarations: [
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
