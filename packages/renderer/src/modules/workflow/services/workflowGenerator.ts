import { v4 as uuidv4 } from 'uuid';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { AI_MODELS } from '@/core/config/ai-models';
import { NODE_REGISTRY, LOGIC_REGISTRY } from './nodeRegistry';
import type {
    SavedWorkflow,
    CustomNode,
    CustomEdge,
    SubgraphNodeData,
    WorkflowAuditionVariant,
    InputNodeData
} from '../types';
import { Status } from '../types';

interface JobSummary {
    id: string;
    description: string;
    inputs: string[];
    outputs: string[];
}

interface RegistryContextItem {
    department: string;
    jobs: JobSummary[];
}

// Helper to flatten registry for the Autonomous context
const getRegistryContext = (): RegistryContextItem[] => {
    const allDefs = { ...NODE_REGISTRY, ...LOGIC_REGISTRY };
    return Object.values(allDefs).map((def) => ({
        department: def.departmentName,
        jobs: def.jobs.map((j) => ({
            id: j.id,
            description: j.description,
            inputs: j.inputs.map(p => p.id),
            outputs: j.outputs.map(p => p.id)
        }))
    }));
};

interface GeneratedNodeData {
    nodeType: 'department' | 'input' | 'output' | 'audioSegment' | 'logic' | 'subgraph';
    departmentName?: string;
    selectedJobId?: string;
    prompt?: string;
    config?: {
        condition?: string;
        message?: string;
        variableKey?: string;
        [key: string]: unknown;
    };
}

interface GeneratedNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: GeneratedNodeData;
}

interface GeneratedEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

interface GeneratedWorkflow {
    name: string;
    description: string;
    nodes: GeneratedNode[];
    edges: GeneratedEdge[];
}

const WORKFLOW_JSON_SCHEMA = {
    type: 'object',
    properties: {
        id: { type: 'string', description: 'Unique ID for the workflow' },
        name: { type: 'string', description: 'Name of the generated workflow' },
        description: { type: 'string', description: 'What this workflow accomplishes' },
        nodes: {
            type: 'array',
            description: 'List of nodes in the workflow',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['inputNode', 'outputNode', 'departmentNode', 'logicNode', 'subgraphNode'] },
                    position: {
                        type: 'object',
                        properties: { x: { type: 'number' }, y: { type: 'number' } },
                        required: ['x', 'y']
                    },
                    data: {
                        type: 'object',
                        properties: {
                            nodeType: { type: 'string' },
                            departmentName: { type: 'string' },
                            selectedJobId: { type: 'string' },
                            prompt: { type: 'string' },
                            config: {
                                type: 'object',
                                properties: {
                                    condition: { type: 'string' },
                                    message: { type: 'string' },
                                    variableKey: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                required: ['id', 'type', 'position', 'data']
            }
        },
        edges: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    source: { type: 'string' },
                    target: { type: 'string' },
                    sourceHandle: { type: 'string', description: 'Optional source handle id' },
                    targetHandle: { type: 'string', description: 'Optional target handle id' }
                },
                required: ['id', 'source', 'target']
            }
        }
    }
};

/**
 * Validates generated graph structure (IDs, uniqueness, coordinates, job availability).
 */
function validateGeneratedGraph(generated: GeneratedWorkflow): void {
    if (!generated || !Array.isArray(generated.nodes) || !generated.nodes.length || !Array.isArray(generated.edges)) {
        throw new Error('The workflow architect returned an incomplete graph. Please try again with a shorter request.');
    }
    const nodeIds = new Set<string>();
    for (const node of generated.nodes) {
        if (!node || typeof node.id !== 'string' || !node.id || nodeIds.has(node.id) ||
            !node.data || !node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
            throw new Error('The workflow architect returned an invalid node. Please regenerate the workflow.');
        }
        nodeIds.add(node.id);
        if (node.type === 'departmentNode') {
            const definition = Object.values(NODE_REGISTRY).find(def => def.departmentName === node.data.departmentName);
            if (!definition?.jobs.some(job => job.id === node.data.selectedJobId)) {
                throw new Error('The workflow architect selected an unavailable job. Please regenerate the workflow.');
            }
        }
    }
    if (generated.edges.some(edge => !edge || !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
        throw new Error('The workflow architect returned a disconnected reference. Please regenerate the workflow.');
    }
}

/**
 * Translates an artist's high-level intent into an executable Flow-Be graph.
 */
export async function generateWorkflowFromPrompt(userPrompt: string): Promise<SavedWorkflow> {
    const registryContext = JSON.stringify(getRegistryContext(), null, 2);

    const systemInstruction = `You are a Lead Workflow Architect for independent music artists.
Your goal is to translate an artist's vision and release plan into a valid Node Graph JSON structure.

AVAILABLE TOOLS (Node Registry):
${registryContext}

RULES:
1. **Start & End**: You MUST include an 'inputNode' (id: 'start') and an 'outputNode' (id: 'end').
2. **Music Lifecycle**: Include Notes Ingest, Audio QC, Metadata, Splits, Visuals/Video, and Pre-Flight whenever an end-to-end release is requested.
3. **Job Selection**: You MUST specify 'selectedJobId' for every department node based on the registry.
4. **Logic & Human Gates**: Use 'logicNode' with jobId 'router' for branching, or 'gatekeeper' for artist review before release steps.
5. **Layout**: Left-to-right flow with progressive x-coordinates (~300px per step).
6. **Connections**: 'sourceHandle' and 'targetHandle' must match valid handles (e.g. 'trigger', 'trigger_out', 'true', 'false', 'approve').

Output strictly valid JSON matching the schema.`;

    const generated = await AI.generateStructuredData<GeneratedWorkflow>(
        `User Request: "${userPrompt}"\n\nGenerate the workflow JSON.`,
        WORKFLOW_JSON_SCHEMA as Record<string, unknown>,
        undefined,
        systemInstruction,
        AI_MODELS.TEXT.AGENT
    );

    validateGeneratedGraph(generated);

    const nodes: SavedWorkflow['nodes'] = (generated.nodes || []).map((n: GeneratedNode, index: number) => ({
        ...n,
        position: {
            x: n.position?.x ?? (index * 300),
            y: n.position?.y ?? 100
        },
        data: { ...n.data, status: Status.PENDING }
    })) as SavedWorkflow['nodes'];

    const edges: SavedWorkflow['edges'] = (generated.edges || []).map((e: GeneratedEdge) => ({
        ...e,
        type: 'default',
        animated: false
    })) as SavedWorkflow['edges'];

    return {
        id: uuidv4(),
        name: generated.name || 'Generated Music Workflow',
        description: generated.description || userPrompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes,
        edges
    };
}

/**
 * AI Co-Pilot: Collaboratively modifies an existing workflow based on the artist's natural language instructions.
 * E.g., "Add an Art micro-flow", "Insert a Gatekeeper approval before social posting", "Add TikTok canvas video".
 */
export async function modifyWorkflowWithAI(
    currentWorkflow: SavedWorkflow,
    instruction: string
): Promise<SavedWorkflow> {
    const registryContext = JSON.stringify(getRegistryContext(), null, 2);
    const serializedExisting = JSON.stringify({
        nodes: currentWorkflow.nodes.map(n => ({
            id: n.id,
            type: n.type,
            data: n.data,
            position: n.position
        })),
        edges: currentWorkflow.edges
    }, null, 2);

    const systemInstruction = `You are an AI Co-Pilot working with an independent music artist to edit their Flow-Be workflow.
You will be provided with their EXISTING workflow graph and a request for changes.

AVAILABLE TOOLS (Node Registry):
${registryContext}

RULES:
1. Maintain existing nodes and connections unless the user explicitly asks to remove or reroute them.
2. Insert new nodes cleanly between appropriate steps, connecting input and output handles properly.
3. Ensure the graph starts with an 'inputNode' and ends with an 'outputNode'.
4. Position new nodes logically near their upstream/downstream neighbors.
5. All 'selectedJobId' values must strictly exist in the registry.

Output strictly valid JSON matching the schema.`;

    const promptText = `EXISTING WORKFLOW:
${serializedExisting}

ARTIST REQUEST:
"${instruction}"

Output the complete, updated workflow JSON.`;

    const generated = await AI.generateStructuredData<GeneratedWorkflow>(
        promptText,
        WORKFLOW_JSON_SCHEMA as Record<string, unknown>,
        undefined,
        systemInstruction,
        AI_MODELS.TEXT.AGENT
    );

    validateGeneratedGraph(generated);

    const nodes: SavedWorkflow['nodes'] = (generated.nodes || []).map((n: GeneratedNode) => ({
        ...n,
        data: { ...n.data, status: Status.PENDING }
    })) as SavedWorkflow['nodes'];

    const edges: SavedWorkflow['edges'] = (generated.edges || []).map((e: GeneratedEdge) => ({
        ...e,
        type: 'default',
        animated: false
    })) as SavedWorkflow['edges'];

    return {
        ...currentWorkflow,
        name: generated.name || currentWorkflow.name,
        description: generated.description || currentWorkflow.description,
        updatedAt: new Date().toISOString(),
        nodes,
        edges
    };
}

/**
 * Creative Auditions: Generates 3 distinct artistic directions or variations
 * for a specific node on the canvas so the artist can audition options.
 */
export async function auditionWorkflowVariants(
    node: CustomNode,
    songContext: string,
    count: number = 3
): Promise<WorkflowAuditionVariant[]> {
    const nodeLabel = 'label' in node.data ? node.data.label : ('departmentName' in node.data ? node.data.departmentName : node.type);
    const existingPrompt = 'prompt' in node.data ? String(node.data.prompt || '') : '';

    const systemInstruction = `You are a creative music director proposing alternative artistic directions.
Given a song concept and a workflow node, generate ${count} distinctly different creative variations.
For example, for artwork: one analog film style, one hyper-modern 3D render, one minimal typographic look.
For social copy: one cryptic tease, one emotional narrative, one punchy call-to-action.`;

    const auditionSchema = {
        type: 'object',
        properties: {
            variants: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        prompt: { type: 'string' },
                        styleRationale: { type: 'string' }
                    },
                    required: ['id', 'title', 'description', 'prompt', 'styleRationale']
                }
            }
        },
        required: ['variants']
    };

    const promptText = `SONG CONTEXT:
"${songContext}"

NODE:
"${nodeLabel}" (Current prompt: "${existingPrompt}")

Generate ${count} creative audition variants.`;

    interface AuditionResult {
        variants: WorkflowAuditionVariant[];
    }

    try {
        const result = await AI.generateStructuredData<AuditionResult>(
            promptText,
            auditionSchema as Record<string, unknown>,
            undefined,
            systemInstruction,
            AI_MODELS.TEXT.AGENT
        );

        if (result && Array.isArray(result.variants) && result.variants.length > 0) {
            return result.variants.slice(0, count);
        }
    } catch (_err) {
        // Fallback variants if offline or generation errors
    }

    // Default creative audition options
    return [
        {
            id: 'audition-1',
            title: 'Cinematic & Atmospheric',
            description: 'Dramatic lighting, anamorphic lens bokeh, high dynamic range.',
            prompt: `Cinematic wide composition, dramatic moody lighting, atmospheric: ${existingPrompt || songContext}`,
            styleRationale: 'Creates strong visual gravitas ideal for Spotify Canvas and press features.'
        },
        {
            id: 'audition-2',
            title: 'Analog 35mm Grain',
            description: 'Vintage film stock, natural color grading, organic grain texture.',
            prompt: `35mm film photograph, subtle grain, editorial music portrait aesthetic: ${existingPrompt || songContext}`,
            styleRationale: 'Gives an intimate, authentic indie feel favored by playlist curators.'
        },
        {
            id: 'audition-3',
            title: 'Bold Editorial Minimalist',
            description: 'High contrast, striking color blocks, typography-centric layout.',
            prompt: `Minimalist graphic design, high contrast silhouette, bold editorial style: ${existingPrompt || songContext}`,
            styleRationale: 'Instantly readable and eye-catching as a small thumbnail on streaming platforms.'
        }
    ];
}

/**
 * Encapsulate Subgraph: Collapses a selected cluster of nodes on the canvas into
 * a single composite `subgraphNode` (Micro-Workflow).
 */
export function encapsulateSubgraph(
    workflow: SavedWorkflow,
    selectedNodeIds: string[],
    label: string = 'Micro-Workflow'
): SavedWorkflow {
    if (!selectedNodeIds || selectedNodeIds.length === 0) return workflow;

    const selectedSet = new Set(selectedNodeIds);
    const subNodes = workflow.nodes.filter(n => selectedSet.has(n.id));
    if (subNodes.length === 0) return workflow;

    const subEdges = workflow.edges.filter(
        e => selectedSet.has(e.source) && selectedSet.has(e.target)
    );

    // Calculate center coordinate for the new composite node
    const avgX = subNodes.reduce((sum, n) => sum + n.position.x, 0) / subNodes.length;
    const avgY = subNodes.reduce((sum, n) => sum + n.position.y, 0) / subNodes.length;

    const compositeId = `subgraph-${uuidv4().slice(0, 8)}`;
    const compositeNode: CustomNode = {
        id: compositeId,
        type: 'subgraphNode',
        position: { x: Math.round(avgX), y: Math.round(avgY) },
        data: {
            nodeType: 'subgraph',
            label,
            description: `Nested micro-workflow containing ${subNodes.length} steps`,
            subgraph: {
                nodes: subNodes,
                edges: subEdges
            },
            status: Status.PENDING
        }
    };

    // External incoming edges (source outside, target inside sub-flow)
    const incomingExternal = workflow.edges.filter(
        e => !selectedSet.has(e.source) && selectedSet.has(e.target)
    );
    // External outgoing edges (source inside, target outside sub-flow)
    const outgoingExternal = workflow.edges.filter(
        e => selectedSet.has(e.source) && !selectedSet.has(e.target)
    );

    const rewiredEdges: CustomEdge[] = [];
    const seenEdges = new Set<string>();

    for (const inEdge of incomingExternal) {
        const edgeKey = `${inEdge.source}->${compositeId}`;
        if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            rewiredEdges.push({
                ...inEdge,
                id: `e-${inEdge.source}-${compositeId}`,
                target: compositeId,
                targetHandle: 'default_in'
            });
        }
    }

    for (const outEdge of outgoingExternal) {
        const edgeKey = `${compositeId}->${outEdge.target}`;
        if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            rewiredEdges.push({
                ...outEdge,
                id: `e-${compositeId}-${outEdge.target}`,
                source: compositeId,
                sourceHandle: 'default_out'
            });
        }
    }

    // Retain external nodes not in the subgraph, and add the composite node
    const remainingNodes = workflow.nodes.filter(n => !selectedSet.has(n.id)).concat(compositeNode);

    // Retain untouched edges
    const untouchedEdges = workflow.edges.filter(
        e => !selectedSet.has(e.source) && !selectedSet.has(e.target)
    );

    return {
        ...workflow,
        updatedAt: new Date().toISOString(),
        nodes: remainingNodes,
        edges: [...untouchedEdges, ...rewiredEdges]
    };
}

/**
 * Expand Subgraph: Unwraps an embedded `subgraphNode` back into its full constituent
 * nodes and edges on the parent canvas.
 */
export function expandSubgraph(
    workflow: SavedWorkflow,
    subgraphNodeId: string
): SavedWorkflow {
    const compositeNode = workflow.nodes.find(n => n.id === subgraphNodeId);
    if (!compositeNode || compositeNode.type !== 'subgraphNode') return workflow;

    const subgraphData = compositeNode.data as SubgraphNodeData;
    const subNodes = subgraphData.subgraph?.nodes || [];
    const subEdges = subgraphData.subgraph?.edges || [];
    if (subNodes.length === 0) return workflow;

    // Identify entry and exit nodes of the subgraph
    const entryNode = subNodes.find(n => n.type === 'inputNode') || subNodes[0];
    const exitNode = subNodes.find(n => n.type === 'outputNode') || subNodes[subNodes.length - 1];

    // Rewire incoming edges pointing to compositeNode -> entryNode
    const incomingToComposite = workflow.edges.filter(e => e.target === subgraphNodeId);
    // Rewire outgoing edges originating from compositeNode -> exitNode
    const outgoingFromComposite = workflow.edges.filter(e => e.source === subgraphNodeId);

    const rewiredEdges: CustomEdge[] = [];
    if (entryNode) {
        for (const inEdge of incomingToComposite) {
            rewiredEdges.push({
                ...inEdge,
                id: `e-${inEdge.source}-${entryNode.id}`,
                target: entryNode.id,
                targetHandle: inEdge.targetHandle || 'trigger'
            });
        }
    }

    if (exitNode) {
        for (const outEdge of outgoingFromComposite) {
            rewiredEdges.push({
                ...outEdge,
                id: `e-${exitNode.id}-${outEdge.target}`,
                source: exitNode.id,
                sourceHandle: outEdge.sourceHandle || 'trigger_out'
            });
        }
    }

    const remainingNodes = workflow.nodes.filter(n => n.id !== subgraphNodeId).concat(subNodes);
    const untouchedEdges = workflow.edges.filter(
        e => e.source !== subgraphNodeId && e.target !== subgraphNodeId
    );

    return {
        ...workflow,
        updatedAt: new Date().toISOString(),
        nodes: remainingNodes,
        edges: [...untouchedEdges, ...subEdges, ...rewiredEdges]
    };
}
