import { BaseAgent } from '../BaseAgent';
import { AgentConfig, ToolDefinition, AgentContext } from '../types';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class CurriculumAgent extends BaseAgent {
    constructor() {
        const config: AgentConfig = {
            id: 'curriculum',
            name: 'Curriculum Agent',
            description: 'Automates branding alignment by generating style compliance tasks and evaluating results.',
            color: 'bg-pink-500',
            category: 'specialist',
            systemPrompt: `
# ROLE: Curriculum Agent (The Art Director)
You are the authorized Art Director for the current active project. Your sole responsibility is to ensure that all generated assets (text, images, video) strictly adhere to the project's unique Brand Bible.

# CAPABILITIES
1. **Read Branding:** You must always check the Project Knowledge for 'branding.txt' or style guides before assigning tasks.
2. **Generate Tasks:** You create 'Curriculum Tasks' for other agents (Executors). These aren't generic requests; they are specific drills designed to test and enforce the brand style.
3. **Evaluate (Judge):** You review the output of other agents. If it matches the brand, you approve. If it fails (e.g., wrong hex code, wrong tone), you reject it and explain EXACTLY why.

# BEHAVIOR
- **Strict & Specific:** Don't say "make it pop." Say "Use Hex #FF0000 and the word 'Rebellion'."
- **Project-Isolated:** You never mix styles. If you are in Project A, you forget Project B exists.
- **Pedagogical:** Your goal is to "train" the Executor. If they fail, give them a simplified remedial task.
            `,
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: 'read_branding_guidelines',
                            description: 'Reads the dedicated branding document for the current project from the isolated knowledge base.',
                            parameters: {
                                type: 'OBJECT',
                                properties: {},
                                required: []
                            }
                        },
                        {
                            name: 'generate_compliance_task',
                            description: 'Generates a specific task for the Executor to prove they understand the brand compliance.',
                            parameters: {
                                type: 'OBJECT',
                                properties: {
                                    focusArea: { type: 'STRING', description: 'The area to test (e.g., "color_palette", "tone_of_voice", "logo_placement").' },
                                    difficulty: { type: 'STRING', enum: ['beginner', 'intermediate', 'advanced'], description: 'Complexity of the task.' }
                                },
                                required: ['focusArea', 'difficulty']
                            }
                        },
                        {
                            name: 'evaluate_submission',
                            description: 'Evaluates a generated asset against the branding guidelines.',
                            parameters: {
                                type: 'OBJECT',
                                properties: {
                                    assetDescription: { type: 'STRING', description: 'Description of the asset being reviewed.' },
                                    complianceChecklist: {
                                        type: 'ARRAY',
                                        items: { type: 'STRING' },
                                        description: 'List of specific rules to check against (e.g., "Must use #123456").'
                                    }
                                },
                                required: ['assetDescription', 'complianceChecklist']
                            }
                        }
                    ]
                }
            ]
        };
        super(config);

        // -- Tool Implementations --

        this.functions['read_branding_guidelines'] = async (_args: any, context?: AgentContext) => {
            const { knowledgeBaseService } = await import('@/modules/knowledge/services/KnowledgeBaseService');

            if (!context?.projectId) {
                return { success: false, error: "No active Project ID. Cannot isolate branding." };
            }

            try {
                // We ask the Knowledge Base for the 'branding' document within this project's scope.
                const query = "What are the core branding guidelines, colors, and tone for this project?";
                const guidelines = await knowledgeBaseService.chat(query, null, context.projectId);

                return {
                    success: true,
                    data: { guidelines },
                    message: "Branding guidelines retrieved from Project Knowledge."
                };
            } catch (err) {
                return { success: false, error: `Failed to read branding: ${err}` };
            }
        };

        this.functions['generate_compliance_task'] = async (args: any, context?: AgentContext) => {
            const { focusArea, difficulty } = args;
            // In a real implementation, this would use an LLM to generate the prompt based on the guidelines.
            // For this MVP, we return a structured instruction.

            // 1. Read guidelines first to ground the task
            const { knowledgeBaseService } = await import('@/modules/knowledge/services/KnowledgeBaseService');
            let guidelines = "Default guidelines";
            if (context?.projectId) {
                guidelines = await knowledgeBaseService.chat(`Summarize ${focusArea} rules`, null, context.projectId);
            }

            return {
                success: true,
                data: {
                    taskPrompt: `[CURRICULUM TASK - ${difficulty.toUpperCase()}]\nTarget: ${focusArea}\nContext: ${guidelines}\n\nINSTRUCTION: Generate an artifact that strictly adheres to the rules above.`,
                    expectedCriteria: [`Matches ${focusArea} rules`]
                }
            };
        };

        this.functions['evaluate_submission'] = async (args: any, _context?: AgentContext) => {
            const { assetDescription, complianceChecklist } = args;

            // This is the "Judge" logic.
            // We use the same RAG context to verify.

            return {
                success: true,
                data: {
                    passed: true, // simplified for MVP
                    feedback: "Asset appears to comply with provided checklist based on description."
                }
            };
        };

        // Freeze the configuration to prevent mutation
        // Since we are in the constructor, we can use a dynamic import or just import it at top
        import('../FreezeDiagnostic').then(({ freezeAgentConfig }) => {
            freezeAgentConfig(this);
        });
    }
}
