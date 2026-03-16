import { CustomNode, CustomEdge, DepartmentNodeData, LogicNodeData, InputNodeData, Status, SavedWorkflow } from '../types';
import { GenAI as AI } from '@/services/ai/GenAI';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { SocialService } from '@/services/social/SocialService';
import { AI_MODELS } from '@/core/config/ai-models';
import { logger } from '@/utils/logger';

interface ExecutionTask {
    nodeId: string;
    inputs: Record<string, unknown>;
    /** For Router nodes: which outgoing handle triggered this task */
    sourceHandle?: string;
}

export class WorkflowEngine {
    private nodes: CustomNode[];
    private edges: CustomEdge[];
    private executionQueue: ExecutionTask[] = [];
    private results: Map<string, unknown> = new Map();
    private isRunning: boolean = false;
    private setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void;
    /** Shared blackboard for Variables nodes */
    private blackboard: Map<string, unknown> = new Map();
    /** Gatekeeper pause callbacks: nodeId → resolve function */
    private approvalCallbacks: Map<string, (approved: boolean) => void> = new Map();

    constructor(
        nodes: CustomNode[],
        edges: CustomEdge[],
        setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void
    ) {
        this.nodes = nodes;
        this.edges = edges;
        this.setNodes = setNodes;
    }

    // -----------------------------------------------------------------------
    // Public
    // -----------------------------------------------------------------------

    public async run() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.results.clear();
        this.blackboard.clear();
        this.executionQueue = [];

        try {
            const startNodes = this.nodes.filter(n => n.type === 'inputNode');
            for (const node of startNodes) {
                this.executionQueue.push({
                    nodeId: node.id,
                    inputs: { prompt: (node.data as InputNodeData).prompt },
                });
            }

            while (this.executionQueue.length > 0) {
                const task = this.executionQueue.shift()!;
                await this.executeNode(task);
            }
        } finally {
            this.isRunning = false;
        }
    }

    /** Resolve a pending Gatekeeper node.  Call from the UI approve/reject buttons. */
    public resolveGatekeeper(nodeId: string, approved: boolean) {
        const cb = this.approvalCallbacks.get(nodeId);
        if (cb) {
            this.approvalCallbacks.delete(nodeId);
            cb(approved);
        }
    }

    public async saveWorkflow(
        id: string,
        name: string,
        description: string,
        viewport: { x: number; y: number; zoom: number }
    ): Promise<void> {
        const { getWorkflowFromStorage, saveWorkflowToStorage } = await import('@/services/storage/repository');

        const existingWorkflow = await getWorkflowFromStorage(id) as SavedWorkflow | undefined;

        await saveWorkflowToStorage({
            id,
            name,
            description,
            nodes: this.nodes,
            edges: this.edges,
            viewport,
            createdAt: existingWorkflow?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    public async loadWorkflow(id: string): Promise<SavedWorkflow | null> {
        const { getWorkflowFromStorage } = await import('@/services/storage/repository');
        const data = await getWorkflowFromStorage(id) as SavedWorkflow | undefined;
        if (data) {
            this.nodes = data.nodes;
            this.edges = data.edges;
            this.setNodes([...this.nodes]);
            return data;
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Private — execution pipeline
    // -----------------------------------------------------------------------

    private async executeNode(task: ExecutionTask) {
        const node = this.nodes.find(n => n.id === task.nodeId);
        if (!node) return;

        this.updateNodeStatus(node.id, Status.WORKING);

        try {
            let output: unknown = null;
            let routerHandle: string | undefined;

            switch (node.type) {
                case 'inputNode':
                    output = task.inputs.prompt;
                    break;

                case 'outputNode':
                    output = task.inputs.data;
                    break;

                case 'departmentNode':
                    output = await this.executeDepartmentNode(node, task.inputs);
                    break;

                case 'logicNode': {
                    const res = await this.executeLogicNode(node, task.inputs);
                    output = res.output;
                    routerHandle = res.handle;
                    break;
                }
            }

            this.results.set(node.id, output);
            this.updateNodeStatus(node.id, Status.DONE, output);

            // Enqueue downstream nodes, respecting router handle filtering
            const outgoing = this.edges.filter(e => e.source === node.id);
            for (const edge of outgoing) {
                // If this node produced a handle (Router), only follow matching edges
                if (routerHandle && edge.sourceHandle && edge.sourceHandle !== routerHandle) {
                    continue;
                }
                const target = this.nodes.find(n => n.id === edge.target);
                if (target) {
                    this.executionQueue.push({ nodeId: target.id, inputs: { data: output } });
                }
            }
        } catch (err: unknown) {
            logger.error(`[WorkflowEngine] Node ${node.id} failed:`, err);
            const msg = err instanceof Error ? err.message : 'Unknown error';
            this.updateNodeStatus(node.id, Status.ERROR, msg);
        }
    }

    // -----------------------------------------------------------------------
    // Department handlers
    // -----------------------------------------------------------------------

    private async executeDepartmentNode(
        node: CustomNode,
        inputs: Record<string, unknown>
    ): Promise<unknown> {
        const data = node.data as DepartmentNodeData;
        const jobId = data.selectedJobId ?? '';
        const prompt = (data.prompt || (typeof inputs.data === 'string' ? inputs.data : '')) as string;

        switch (data.departmentName) {

            // ── Art Department ──────────────────────────────────────────────
            case 'Art Department': {
                if (jobId === 'art-upscale' && inputs.image_input) {
                    // Image-to-image refinement: use the prompt as a refinement instruction
                    const images = await ImageGeneration.generateImages({
                        prompt: `Refine and upscale: ${prompt}`,
                        count: 1,
                        aspectRatio: '1:1',
                    });
                    return images[0]?.url;
                }
                const images = await ImageGeneration.generateImages({ prompt, count: 1, aspectRatio: '1:1' });
                return images[0]?.url;
            }

            // ── Video Department ────────────────────────────────────────────
            case 'Video Department': {
                if (jobId === 'video-img-to-video') {
                    // Image → video: pass the image url as the first frame
                    const imageUrl = (inputs.image_input as string) || undefined;
                    const results = await VideoGeneration.generateVideo({
                        prompt,
                        durationSeconds: 5,
                        aspectRatio: '16:9',
                        ...(imageUrl ? { imageUrl } : {}),
                    });
                    return results[0]?.url;
                }
                if (jobId === 'video-extend') {
                    // Extend the incoming video clip
                    const results = await VideoGeneration.generateVideo({
                        prompt: `Continue seamlessly: ${prompt}`,
                        durationSeconds: 5,
                        aspectRatio: '16:9',
                    });
                    return results[0]?.url;
                }
                // Default: text-to-video
                const results = await VideoGeneration.generateVideo({ prompt, durationSeconds: 5, aspectRatio: '16:9' });
                return results[0]?.url;
            }

            // ── Marketing Department ────────────────────────────────────────
            case 'Marketing Department': {
                const isImage = typeof prompt === 'string' && prompt.startsWith('data:image');
                const contents = isImage
                    ? [{
                        role: 'user' as const,
                        parts: [
                            { inlineData: { mimeType: prompt.split(':')[1].split(';')[0], data: prompt.split(',')[1] } },
                            { text: 'Write marketing copy for this visual asset.' },
                        ],
                    }]
                    : [{ role: 'user' as const, parts: [{ text: `Write marketing copy for: ${prompt}` }] }];

                const res = await AI.generateContent(contents, AI_MODELS.TEXT.AGENT);
                return res.response.text();
            }

            // ── Social Media Department ─────────────────────────────────────
            case 'Social Media Department': {
                // Generate caption via AI then schedule as a draft post
                const captionRes = await AI.generateContent(
                    [{ role: 'user' as const, parts: [{ text: `Write a social media caption for: ${prompt}` }] }],
                    AI_MODELS.TEXT.AGENT
                );
                const caption = captionRes.response.text();

                // Schedule as a post (no real publish — leaves it as DRAFT for human approval)
                const mediaUrls: string[] = typeof inputs.data === 'string' && inputs.data.startsWith('http')
                    ? [inputs.data]
                    : [];
                await SocialService.createPost(caption, mediaUrls);
                return caption;
            }

            // ── Campaign Manager ────────────────────────────────────────────
            case 'Campaign Manager': {
                const res = await AI.generateContent(
                    [{ role: 'user' as const, parts: [{ text: `Create a detailed campaign strategy for: ${prompt}` }] }],
                    AI_MODELS.TEXT.AGENT
                );
                return res.response.text();
            }

            // ── Knowledge Base ──────────────────────────────────────────────
            case 'Knowledge Base': {
                const { runAgenticWorkflow } = await import('@/services/rag/ragService');
                const { useStore } = await import('@/core/store');
                const userProfile = useStore.getState().userProfile;
                const result = await runAgenticWorkflow(
                    prompt, userProfile, null,
                    () => { }, () => { }, undefined
                );
                if (!result || !result.asset) {
                    throw new Error('Agentic workflow failed to produce a valid asset');
                }
                return result.asset.content;
            }

            default:
                return `Processed by ${data.departmentName}: ${prompt}`;
        }
    }

    // -----------------------------------------------------------------------
    // Logic node handlers
    // -----------------------------------------------------------------------

    private async executeLogicNode(
        node: CustomNode,
        inputs: Record<string, unknown>
    ): Promise<{ output: unknown; handle?: string }> {
        const data = node.data as LogicNodeData;

        switch (data.jobId) {

            // ── Router (Switch) ─────────────────────────────────────────────
            case 'router': {
                const condition = data.config?.condition ?? '';
                let result = false;

                if (condition) {
                    try {
                        // Safe eval: interpolate only the data value into a boolean expression
                        const dataStr = typeof inputs.data === 'string' ? inputs.data : JSON.stringify(inputs.data);
                        // Replace token $data with the stringified value
                        const expr = condition.replace(/\$data/g, JSON.stringify(dataStr));
                        // eslint-disable-next-line no-new-func
                        result = Boolean(new Function(`return (${expr})`)());
                    } catch {
                        result = Boolean(inputs.data);
                    }
                } else {
                    result = Boolean(inputs.data);
                }

                return { output: inputs.data, handle: result ? 'true' : 'false' };
            }

            // ── Gatekeeper (Human-in-the-loop) ──────────────────────────────
            case 'gatekeeper': {
                this.updateNodeStatus(node.id, Status.WAITING_FOR_APPROVAL, inputs.data);

                const approved = await new Promise<boolean>((resolve) => {
                    this.approvalCallbacks.set(node.id, resolve);
                    // 5-minute timeout — auto-reject if nobody responds
                    setTimeout(() => {
                        if (this.approvalCallbacks.has(node.id)) {
                            this.approvalCallbacks.delete(node.id);
                            resolve(false);
                        }
                    }, 5 * 60 * 1000);
                });

                return { output: inputs.data, handle: approved ? 'approve' : 'reject' };
            }

            // ── Variables: Set ───────────────────────────────────────────────
            case 'set_variable': {
                const key = data.config?.variableKey ?? node.id;
                this.blackboard.set(key, inputs.data ?? inputs.value);
                return { output: inputs.data ?? inputs.value };
            }

            // ── Variables: Get ───────────────────────────────────────────────
            case 'get_variable': {
                const key = data.config?.variableKey ?? node.id;
                return { output: this.blackboard.get(key) ?? null };
            }

            default:
                return { output: inputs.data };
        }
    }

    // -----------------------------------------------------------------------
    // Node status helper
    // -----------------------------------------------------------------------

    private updateNodeStatus(nodeId: string, status: Status, result?: unknown) {
        this.setNodes((currentNodes) => {
            const updated = currentNodes.map(n =>
                n.id === nodeId
                    ? { ...n, data: { ...n.data, status, result: result !== undefined ? result : (n.data as any).result } }
                    : n
            );
            this.nodes = updated;
            return updated;
        });
    }
}
