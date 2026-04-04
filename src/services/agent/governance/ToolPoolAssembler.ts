import { FunctionDeclaration } from '../types';
import { TOOL_RISK_REGISTRY } from '../ToolRiskRegistry';
import { SUPERPOWER_TOOLS } from '../definitions/SuperpowerTools';

export interface ToolPoolContext {
    agentId: string;
    moduleContext: string;
    isReadOnly?: boolean;
}

/**
 * ToolPoolAssembler — Governance and Context Tool Filtering
 * Implements Agentic Harness Primitive #9: Tool Pool Assemblies
 * 
 * Ensures agents only receive tools appropriate for their task,
 * reducing context clutter and attack surface by preventing
 * unneeded destructive tools from being exposed.
 */
export class ToolPoolAssembler {
    /**
     * Assembles a filtered list of tools available to an agent for a specific execution.
     * 
     * @param specialistTools - The specific tools declared by the agent
     * @param context - Context including agent ID, active module, and read-only flags
     * @param maxTools - Maximum tools to return (default 24)
     * @returns Filtered list of FunctionDeclarations
     */
    static assemble(
        specialistTools: FunctionDeclaration[],
        context: ToolPoolContext,
        maxTools: number = 24
    ): FunctionDeclaration[] {

        // 1. Gather all potential tools
        const specialistToolNames = new Set(specialistTools.map(f => f.name));
        const filteredSuperpowers = SUPERPOWER_TOOLS.filter(tool => !specialistToolNames.has(tool.name));

        const collaborationToolNames = ['delegate_task', 'consult_experts'];
        const collaborationTools = filteredSuperpowers.filter(t => collaborationToolNames.includes(t.name));
        const otherSuperpowers = filteredSuperpowers.filter(t => !collaborationToolNames.includes(t.name));

        // Initial pool (same as legacy BaseAgent approach)
        let pool = [
            ...collaborationTools,
            ...specialistTools,
            ...otherSuperpowers
        ];

        // 2. Filter out destructive tools if in read-only mode
        if (context.isReadOnly) {
            pool = pool.filter(tool => {
                const riskTier = TOOL_RISK_REGISTRY[tool.name]?.riskTier || 'write'; // Defaults to write if unknown
                return riskTier === 'read';
            });
        }

        // 3. Module Context Filtering (Minimize attack surface)
        // If an agent is in the 'creative' module, it likely doesn't need finance tools,
        // and vice versa, unless explicitly requested as a specialist tool.
        pool = pool.filter(tool => {
            // Collaboration tools are always needed
            if (collaborationToolNames.includes(tool.name)) return true;
            // Native tools requested by the specialist are prioritized
            if (specialistToolNames.has(tool.name)) return true;

            // Filter out specific superpowers based on context mismatches to save tokens
            const name = tool.name.toLowerCase();

            // Finance/Legal tools restricted outside their domains
            if (name.includes('invoice') || name.includes('payment') || name.includes('budget')) {
                return context.moduleContext.includes('finance') || context.agentId === 'finance' || context.agentId === 'generalist';
            }

            // Heavy distribution tools
            if (name.includes('ddex') || name.includes('isrc')) {
                return context.moduleContext.includes('distribution') || context.agentId === 'distribution' || context.agentId === 'generalist';
            }

            // System-level destruction tools only allowed for admin/devops/generalist
            if (name === 'rotate_credentials' || name === 'delete_user_memory') {
                return ['admin', 'devops', 'generalist'].includes(context.agentId);
            }

            return true;
        });

        // 4. Truncate to limit and return
        return pool.slice(0, maxTools);
    }
}
