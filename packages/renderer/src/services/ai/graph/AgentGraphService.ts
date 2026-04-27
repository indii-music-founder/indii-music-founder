import { AgentGraph, AgentNode, AgentEdge, AgentGraphContext, AgentNodeStatus } from './types';
import { ModuleId } from '@/core/constants';

class EventEmitter {
    private listeners: Record<string, ((data: any) => void)[]> = {};

    on(event: string, callback: (data: any) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event: string, callback: (data: any) => void) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    protected emit(event: string, data?: any) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }
}

/**
 * AgentGraphService
 * Manages the orchestration of multi-agent tasks using a graph-based approach.
 * This bridges the high-level planning (AgentZero) with the execution (specialist agents).
 */
export class AgentGraphService extends EventEmitter {
    private activeGraphs: Map<string, AgentGraphContext> = new Map();

    constructor() {
        super();
    }

    /**
     * Initializes a new graph from a plan
     */
    public createGraph(id: string, definition: AgentGraph): AgentGraphContext {
        const context: AgentGraphContext = {
            graphId: id,
            currentNodes: definition.nodes.filter(n => n.type === 'human' || n.id === 'start').map(n => n.id),
            history: [],
            payload: {}
        };
        this.activeGraphs.set(id, context);
        return context;
    }

    /**
     * Transitions from one node to another
     */
    public async transition(graphId: string, fromNodeId: string, toNodeId: string, payloadUpdates: Record<string, any>) {
        const context = this.activeGraphs.get(graphId);
        if (!context) throw new Error(`Graph ${graphId} not found`);

        // Update context
        context.history.push(fromNodeId);
        context.currentNodes = context.currentNodes.filter(id => id !== fromNodeId);
        context.currentNodes.push(toNodeId);
        Object.assign(context.payload, payloadUpdates);

        this.emit('transition', { graphId, fromNodeId, toNodeId, context });
    }

    /**
     * Executes a node's logic
     */
    public async executeNode(graphId: string, nodeId: string) {
        // To be implemented: dispatching to specialist agents
        this.emit('nodeStart', { graphId, nodeId });
        
        try {
            // Mock execution delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.emit('nodeComplete', { graphId, nodeId });
        } catch (error) {
            this.emit('nodeError', { graphId, nodeId, error });
        }
    }

    public getContext(graphId: string): AgentGraphContext | undefined {
        return this.activeGraphs.get(graphId);
    }
}

export const agentGraphService = new AgentGraphService();
