import { CustomNode, CustomEdge, NodeData, DepartmentNodeData, LogicNodeData, InputNodeData, OutputNodeData, Status, SavedWorkflow } from '../types';
import { useStore } from '@/core/store';
import { GenAI as AI } from '@/services/ai/GenAI';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';

// Define the structure of a task in the execution queue
interface ExecutionTask {
    nodeId: string;
    inputs: Record<string, unknown>;
}

// Define the result of a node execution
interface ExecutionResult {
    nodeId: string;
    output: unknown;
    status: 'success' | 'error';
    error?: string;
}

export class WorkflowEngine {
    private nodes: CustomNode[];
    private edges: CustomEdge[];
    private executionQueue: ExecutionTask[] = [];
    private results: Map<string, unknown> = new Map(); // Store results by Node ID
    private isRunning: boolean = false;
    private setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void;

    constructor(nodes: CustomNode[], edges: CustomEdge[], setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void) {
        this.nodes = nodes;
        this.edges = edges;
        this.setNodes = setNodes;
    }

    public async run() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.results.clear();
        this.executionQueue = [];

        // 1. Identify Start Nodes (Input Nodes)
        const startNodes = this.nodes.filter(node => node.type === 'inputNode');

        // 2. Initialize Queue with Start Nodes
        for (const node of startNodes) {
            this.executionQueue.push({
                nodeId: node.id,
                inputs: { prompt: (node.data as InputNodeData).prompt }
            });
        }

        // 3. Process Queue
        while (this.executionQueue.length > 0) {
            const task = this.executionQueue.shift()!;
            await this.executeNode(task);
        }

        this.isRunning = false;

    }

    private async executeNode(task: ExecutionTask) {
        const node = this.nodes.find(n => n.id === task.nodeId);
        if (!node) return;

        // Update Node Status to Running
        this.updateNodeStatus(node.id, Status.WORKING);

        try {
            let output: unknown = null;

            // --- EXECUTION LOGIC BASED ON NODE TYPE ---
            switch (node.type) {
                case 'inputNode':
                    // Input nodes just pass their prompt through
                    output = task.inputs.prompt;
                    break;

                case 'departmentNode':
                    output = await this.executeDepartmentNode(node, task.inputs);
                    break;

                case 'logicNode':
                    output = await this.executeLogicNode(node, task.inputs);
                    break;

                case 'outputNode':
                    output = task.inputs.data; // Just pass through
                    break;
            }

            // Store Result
            this.results.set(node.id, output);
            // Update Node Status to DONE and save result to node data for persistence/UI
            this.updateNodeStatus(node.id, Status.DONE, output);

            // Find Next Nodes
            const outgoingEdges = this.edges.filter(edge => edge.source === node.id);
            for (const edge of outgoingEdges) {
                const targetNode = this.nodes.find(n => n.id === edge.target);
                if (targetNode) {
                    // Check if target is ready (do we have all required inputs?)
                    // For simplicity in this v1, we assume single-input dependencies or we just pass the previous result
                    this.executionQueue.push({
                        nodeId: targetNode.id,
                        inputs: { data: output } // Pass output as 'data' input to next node
                    });
                }
            }

        } catch (error: unknown) {
            logger.error(`Error executing node ${node.id}:`, error);
            if (error instanceof Error) {
                this.updateNodeStatus(node.id, Status.ERROR, error.message);
            } else {
                this.updateNodeStatus(node.id, Status.ERROR, 'Unknown error');
            }
        }
    }

    private async executeDepartmentNode(node: CustomNode, inputs: Record<string, unknown>): Promise<unknown> {
        const data = node.data as DepartmentNodeData;
        const prompt = (data.prompt || (typeof inputs.data === 'string' ? inputs.data : '')) as string;

        // --- REAL AI EXECUTION ---
        if (data.departmentName === 'Art Department') {
            // Generate Image
            const images = await ImageGeneration.generateImages({ prompt, count: 1, aspectRatio: '1:1' });
            return images[0]?.url;
        } else if (data.departmentName === 'Marketing Department') {
            // Generate Text (Multimodal Aware)
            const isImage = typeof prompt === 'string' && prompt.startsWith('data:image');

            let contents;
            if (isImage) {
                // Parse Data URL securely
                const dataUrlRegex = /^data:([^;]+);base64,(.+)$/;
                const match = prompt.match(dataUrlRegex);
                if (!match) {
                    throw new Error('Invalid Data URL format provided for prompt image content');
                }
                const [, mimeType, base64Data] = match;

                contents = [{
                    role: 'user' as const,
                    parts: [
                        { inlineData: { mimeType, data: base64Data } },
                        { text: "Write marketing copy for this visual asset." }
                    ]
                }];
            } else {
                contents = [{
                    role: 'user' as const,
                    parts: [{ text: `Write marketing copy for: ${prompt}` }]
                }];
            }

            const response = await AI.generateContent(
                contents,
                AI_MODELS.TEXT.AGENT // Both modes use the Pro Agent model
            );
            return response.response.text();
        } else if (data.departmentName === 'Knowledge Base') {
            // RAG / Knowledge Base
            const { runAgenticWorkflow } = await import('@/services/rag/ragService');
            const { useStore } = await import('@/core/store');
            const userProfile = useStore.getState().userProfile;

            const result = await runAgenticWorkflow(
                prompt,
                userProfile,
                null,
                (_status) => { /* logger.debug(`[Research]: ${status}`) */ },
                (_id, _status) => { /* logger.debug(`[Doc ${id}]: ${status}`) */ },
                undefined // No fileContent currently available in workflow engine
            );
            if (!result || !result.asset) {
                throw new Error('Agentic workflow failed to produce a valid asset');
            }
            return result.asset.content;
        } else {
            // Generic
            return `Processed by ${data.departmentName}: ${prompt}`;
        }
    }

    private async executeLogicNode(node: CustomNode, inputs: Record<string, unknown>): Promise<unknown> {
        // Simple pass-through for now
        return inputs.data;
    }

    public async saveWorkflow(id: string, name: string, description: string, viewport: { x: number; y: number; zoom: number }): Promise<void> {
        const { getWorkflowFromStorage, saveWorkflowToStorage } = await import('@/services/storage/repository');

        const existingWorkflow = await getWorkflowFromStorage(id) as SavedWorkflow | undefined;

        const workflowData = {
            id,
            name,
            description,
            nodes: this.nodes,
            edges: this.edges,
            viewport,
            createdAt: existingWorkflow?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await saveWorkflowToStorage(workflowData);

    }

    public async loadWorkflow(id: string): Promise<SavedWorkflow | null> {
        const { getWorkflowFromStorage } = await import('@/services/storage/repository');
        const data = await getWorkflowFromStorage(id) as SavedWorkflow | undefined;

        if (data) {
            this.nodes = data.nodes;
            this.edges = data.edges;
            this.setNodes([...this.nodes]);
            // Note: Edges and Viewport handling should be done by the consumer (ReactFlow component)
            // or we need a setEdges callback too. 
            // For now, we just return the data so the UI can update.
            return data;
        }
        return null;
    }

    private updateNodeStatus(nodeId: string, status: Status, result?: unknown) {
        this.setNodes((currentNodes) => {
            const updatedNodes = currentNodes.map(n =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, status, result: result !== undefined ? result : (n.data as any).result } }
                    : n
            );
            // Keep local reference in sync for workflow queue resolution logic
            this.nodes = updatedNodes;
            return updatedNodes;
        });
    }
}
