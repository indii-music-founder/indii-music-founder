import { v4 as uuidv4 } from 'uuid';
import { AI } from '../../../services/ai/AIService';
import { NODE_REGISTRY, LOGIC_REGISTRY } from './nodeRegistry';
import type { SavedWorkflow } from '../types';
import { Status } from '../types';
import { isTextPart } from '@/shared/types/ai.dto';
import { AI_MODELS } from '@/core/config/ai-models';

// Helper to flatten registry for the AI context
const getRegistryContext = () => {
    const allDefs = { ...NODE_REGISTRY, ...LOGIC_REGISTRY };
    return Object.values(allDefs).map((def: any) => ({
        department: def.departmentName,
        jobs: def.jobs.map((j: any) => ({ id: j.id, description: j.description, inputs: j.inputs, outputs: j.outputs }))
    }));
};

export async function generateWorkflowFromPrompt(userPrompt: string): Promise<SavedWorkflow> {
    const registryContext = JSON.stringify(getRegistryContext(), null, 2);

    const systemInstruction = `You are a Workflow Architect for indiiOS. 
    Your goal is to translate a user's intent into a valid Node Graph JSON structure.
    
    AVAILABLE TOOLS (Node Registry):
    ${registryContext}
    
    RULES:
    1. **Start & End**: You MUST include an 'inputNode' (id: 'start') and an 'outputNode' (id: 'end').
    2. **Node Types**: 
       - Use 'departmentNode' for creative tasks (Art, Video, Marketing).
       - Use 'logicNode' for control flow (Router, Gatekeeper, Variables).
    3. **Job Selection**: You MUST specify the 'selectedJobId' for every department node based on the registry.
       - Example: For "Make a video from an image", use departmentName: 'Video Department' and selectedJobId: 'video-img-to-video'.
    4. **Logic**: If the user mentions conditions ("If high energy..."), use a 'logicNode' with jobId 'router'.
    5. **Layout**: Calculate reasonable 'position' {x, y} coordinates. Flow should generally go Left -> Right.
       - Start at x:0. Step ~300px right for each stage.
    6. **Connections**: Define 'edges'. 
       - 'sourceHandle' and 'targetHandle' must match the IDs in the registry (e.g. 'trigger', 'trigger_out', 'true', 'false').
       - Default input/output handles are usually 'trigger' / 'trigger_out' or 'default_in' / 'default_out'.
    
    Output strictly valid JSON matching the schema.
    `;

    // Define schema manually since SchemaType might be limited in current env
    const schema = {
        type: 'OBJECT',
        properties: {
            name: { type: 'STRING' },
            description: { type: 'STRING' },
            nodes: {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        id: { type: 'STRING' },
                        type: { type: 'STRING', enum: ['inputNode', 'outputNode', 'departmentNode', 'logicNode'] },
                        position: {
                            type: 'OBJECT',
                            properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }
                        },
                        data: {
                            type: 'OBJECT',
                            properties: {
                                nodeType: { type: 'STRING' },
                                departmentName: { type: 'STRING' },
                                selectedJobId: { type: 'STRING' },
                                prompt: { type: 'STRING' },
                                config: {
                                    type: 'OBJECT',
                                    properties: {
                                        condition: { type: 'STRING' },
                                        message: { type: 'STRING' },
                                        variableKey: { type: 'STRING' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            edges: {
                type: 'ARRAY',
                items: {
                    type: 'OBJECT',
                    properties: {
                        id: { type: 'STRING' },
                        source: { type: 'STRING' },
                        target: { type: 'STRING' },
                        sourceHandle: { type: 'STRING' },
                        targetHandle: { type: 'STRING' }
                    }
                }
            }
        }
    };

    const response = await AI.generateContent({
        model: AI_MODELS.TEXT.AGENT,
        contents: { role: 'user', parts: [{ text: `User Request: "${userPrompt}"\n\nGenerate the workflow JSON.` }] },
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
        }
    });

    const part = response.response.candidates?.[0]?.content?.parts?.[0];
    const text = (part && isTextPart(part)) ? part.text : '{}';
    const generated = JSON.parse(text);

    // Post-processing to ensure internal consistency (status, etc)
    const nodes = (generated.nodes || []).map((n: any) => ({
        ...n,
        data: { ...n.data, status: Status.PENDING }
    }));

    const edges = (generated.edges || []).map((e: any) => ({
        ...e,
        type: 'default', // Ensure edge type is set
        animated: false
    }));

    return {
        id: uuidv4(),
        name: generated.name || 'Generated Workflow',
        description: generated.description || userPrompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes,
        edges
    };
}
