import { AgentConfig } from "../types";
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { Schema } from 'firebase/ai';

const systemPrompt = `
You are the **DevOps Engineer** (also known as the Site Reliability Engineer).
Your primary responsibility is to manage the cloud infrastructure, ensure system stability, and handle confident deployment operations.

You have access to tools that simulate interaction with Google Kubernetes Engine (GKE) and Google Compute Engine (GCE).

**Capabilities:**
- Monitor the health and status of GKE clusters.
- Scale deployments to handle traffic changes.
- List and monitor GCE virtual machine instances.
- Restart specific services if they are misbehaving.

**Personality:**
- Precise, calm, and efficiency-focused.
- You prioritize system stability above all else.
- You provide clear, technical updates on system status.
- When performing destructive actions (like restarting services), you confirm the intent unless it's a routine check.
`;

export const DevOpsAgent: AgentConfig = {
    id: "devops",
    name: "DevOps / SRE",
    description: "Manages cloud infrastructure, GKE clusters, and system reliability.",
    color: "bg-orange-600",
    category: "specialist",
    systemPrompt,
    functions: {
        list_clusters: async () => {
            const prompt = "Generate a status list of GKE clusters (PROD-US, STAGING-EU) with version, nodes, and status. Return as JSON.";
            return { success: true, data: await firebaseAI.generateStructuredData(prompt, { type: 'object' } as Schema) };
        },
        get_cluster_status: async (args: { cluster_id: string }) => {
            const prompt = `Generate a detailed health report for GKE cluster "${args.cluster_id}". Include cpu_usage, memory_usage, and active_alerts. Return as JSON.`;
            return { success: true, data: await firebaseAI.generateStructuredData(prompt, { type: 'object' } as Schema) };
        },
        scale_deployment: async (args: { deployment: string, replicas: number }) => {
            const prompt = `Simulate scaling deployment "${args.deployment}" to ${args.replicas} replicas. Return a success message and new status.`;
            return { success: true, data: { message: await firebaseAI.generateText(prompt) } };
        },
        list_instances: async () => {
            const prompt = "List active GCE instances (web-server-1, db-node-primary) with zones and IPs. Return as JSON.";
            return { success: true, data: await firebaseAI.generateStructuredData(prompt, { type: 'object' } as Schema) };
        },
        restart_service: async (args: { service_name: string }) => {
            const prompt = `Simulate restarting service "${args.service_name}". Generate a log of the shutdown and startup process.`;
            return { success: true, data: { logs: await firebaseAI.generateText(prompt) } };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "list_clusters",
                description: "List all Google Kubernetes Engine (GKE) clusters and their basic status.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                    required: []
                }
            },
            {
                name: "get_cluster_status",
                description: "Get detailed health status and alerts for a specific GKE cluster.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        cluster_id: { type: "STRING", description: "The name or ID of the cluster." }
                    },
                    required: ["cluster_id"]
                }
            },
            {
                name: "scale_deployment",
                description: "Scale a Kubernetes deployment to a specific number of replicas.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        deployment: { type: "STRING", description: "Name of the deployment." },
                        replicas: { type: "NUMBER", description: "Number of replicas to scale to." },
                        namespace: { type: "STRING", description: "Kubernetes namespace (optional, defaults to default)." }
                    },
                    required: ["deployment", "replicas"]
                }
            },
            {
                name: "list_instances",
                description: "List all Google Compute Engine (GCE) VM instances.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                    required: []
                }
            },
            {
                name: "restart_service",
                description: "Restart a specific service or application.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        service_name: { type: "STRING", description: "Name of the service to restart." }
                    },
                    required: ["service_name"]
                }
            }
        ]
    }]
};
