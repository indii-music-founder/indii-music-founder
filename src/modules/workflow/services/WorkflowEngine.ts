import { CustomNode, CustomEdge, NodeData, DepartmentNodeData, LogicNodeData, InputNodeData, OutputNodeData, Status } from '../types';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { AI_MODELS } from '@/core/config/ai-models';

// Define the structure of a task in the execution queue
interface ExecutionTask {
    nodeId: string;
    inputs: Record<string, any>;
}

// Define the result of a node execution
interface ExecutionResult {
    nodeId: string;
    output: any;
    status: 'success' | 'error';
    error?: string;
}

export class WorkflowEngine {
    private nodes: CustomNode[];
    private edges: CustomEdge[];
    private executionQueue: ExecutionTask[] = [];
    private results: Map<string, any> = new Map(); // Store results by Node ID
    private isRunning: boolean = false;
    private setNodes: (nodes: CustomNode[]) => void;

    constructor(nodes: CustomNode[], edges: CustomEdge[], setNodes: (nodes: CustomNode[]) => void) {
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
        console.log("Workflow Execution Complete");
    }

    private async executeNode(task: ExecutionTask) {
        const node = this.nodes.find(n => n.id === task.nodeId);
        if (!node) return;

        // Update Node Status to Running
        this.updateNodeStatus(node.id, Status.WORKING);

        try {
            let output: any = null;

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
                    console.log("Workflow Output:", output);
                    break;
            }

            // Store Result
            this.results.set(node.id, output);
            this.updateNodeStatus(node.id, Status.DONE);

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
            console.error(`Error executing node ${node.id}:`, error);
            if (error instanceof Error) {
                this.updateNodeStatus(node.id, Status.ERROR);
            } else {
                this.updateNodeStatus(node.id, Status.ERROR);
            }
        }
    }

    private async executeDepartmentNode(node: CustomNode, inputs: any): Promise<any> {
        const data = node.data as DepartmentNodeData;
        const prompt = data.prompt || inputs.data || ''; // Use node prompt or input data

        // --- REAL AI EXECUTION ---
        if (data.departmentName === 'Art Department') {
            // Generate Image
            const images = await ImageGeneration.generateImages({ prompt, count: 1, aspectRatio: '1:1' });
            return images[0]?.url;
        } else if (data.departmentName === 'Marketing Department') {
            // Generate Text
            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: [{ role: 'user', parts: [{ text: `Write marketing copy for: ${prompt}` }] }]
            });
            return response.text();
        } else if (data.departmentName === 'Knowledge Base') {
            // RAG / Knowledge Base
            const { runAgenticWorkflow } = await import('@/services/rag/ragService');
            const { useStore } = await import('@/core/store');
            const userProfile = useStore.getState().userProfile;

            const result = await runAgenticWorkflow(
                prompt,
                userProfile,
                null,
                (status) => console.log(`[Research]: ${status}`),
                (id, status) => console.log(`[Doc ${id}]: ${status}`)
            );
            return result.asset.content;
        } else {
            // Generic
            return `Processed by ${data.departmentName}: ${prompt}`;
        }
    }

    private async executeLogicNode(node: CustomNode, inputs: any): Promise<any> {
        // Simple pass-through for now
        return inputs.data;
    }

    public async saveWorkflow(id: string, name: string, description: string, viewport: { x: number; y: number; zoom: number }): Promise<void> {
        const { saveWorkflowToStorage } = await import('@/services/storage/repository');

        const workflowData = {
            id,
            name,
            description,
            nodes: this.nodes,
            edges: this.edges,
            viewport,
            createdAt: new Date().toISOString(), // In a real app, preserve original creation time
            updatedAt: new Date().toISOString()
        };

        await saveWorkflowToStorage(workflowData);
        console.log(`Workflow ${id} saved.`);
    }

    public async loadWorkflow(id: string): Promise<any | null> {
        const { getWorkflowFromStorage } = await import('@/services/storage/repository');
        const data = await getWorkflowFromStorage(id);

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

    private updateNodeStatus(nodeId: string, status: Status) {
        // We need to update the store's state. 
        // Since we passed setNodes in constructor, we can use it.
        // However, we need the *latest* nodes to avoid overwriting.
        // This is a bit tricky with the current setup. 
        // Ideally, we'd dispatch an action. For now, let's assume we can update the local reference and call setNodes.

        this.nodes = this.nodes.map(n =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, status } }
                : n
        );
        this.setNodes([...this.nodes]); // Trigger React update
    }
}
