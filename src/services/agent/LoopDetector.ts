/**
 * Advanced Loop Detection System
 *
 * Prevents agent loops by tracking:
 * 1. Tool call sequences (detects A→B→A→B patterns)
 * 2. Tool call frequency (prevents spam)
 * 3. Cross-agent delegation chains (prevents A→B→A loops)
 *
 * Phase 2: Stability Fixes
 */

export interface ToolCall {
    name: string;
    args: string;
    timestamp: number;
}

export interface LoopDetectionResult {
    isLoop: boolean;
    reason?: string;
    pattern?: string;
}

export class LoopDetector {
    private toolCallHistory: ToolCall[] = [];
    private maxHistorySize = 20; // Track last 20 tool calls

    /**
     * Record a tool call
     */
    recordToolCall(name: string, args: Record<string, unknown>): void {
        const argsStr = JSON.stringify(args);
        this.toolCallHistory.push({
            name,
            args: argsStr,
            timestamp: Date.now()
        });

        // Keep history bounded
        if (this.toolCallHistory.length > this.maxHistorySize) {
            this.toolCallHistory.shift();
        }
    }

    /**
     * Detect if current tool call would create a loop
     */
    detectLoop(name: string, args: Record<string, unknown>): LoopDetectionResult {
        const argsStr = JSON.stringify(args);

        // Check 1: Exact same tool+args called twice in a row
        const lastCall = this.toolCallHistory[this.toolCallHistory.length - 1];
        if (lastCall && lastCall.name === name && lastCall.args === argsStr) {
            return {
                isLoop: true,
                reason: 'Same tool with same arguments called consecutively',
                pattern: `${name}(${argsStr}) → ${name}(${argsStr})`
            };
        }

        // Check 2: Alternating pattern (A→B→A→B)
        if (this.toolCallHistory.length >= 3) {
            const last3 = this.toolCallHistory.slice(-3);
            const [call1, call2, call3] = last3;

            if (call1.name === call3.name && call1.args === call3.args &&
                call2.name === name && call2.args === argsStr) {
                return {
                    isLoop: true,
                    reason: 'Alternating pattern detected',
                    pattern: `${call1.name} → ${call2.name} → ${call3.name} → ${name}`
                };
            }
        }

        // Check 3: Tool frequency (same tool called too many times)
        const recentCalls = this.toolCallHistory.slice(-10); // Last 10 calls
        const sameToolCount = recentCalls.filter(call => call.name === name).length;
        const MAX_SAME_TOOL_FREQUENCY = 5; // Max 5 times in last 10 calls

        if (sameToolCount >= MAX_SAME_TOOL_FREQUENCY) {
            return {
                isLoop: true,
                reason: `Tool '${name}' called ${sameToolCount} times in last ${recentCalls.length} calls`,
                pattern: `Excessive ${name} calls`
            };
        }

        // Check 4: Repeating sequence pattern (A→B→C→A→B→C)
        if (this.toolCallHistory.length >= 6) {
            const last6 = this.toolCallHistory.slice(-6);
            const sequence1 = last6.slice(0, 3).map(c => c.name).join('→');
            const sequence2 = last6.slice(3, 6).map(c => c.name).join('→');

            if (sequence1 === sequence2) {
                return {
                    isLoop: true,
                    reason: 'Repeating sequence detected',
                    pattern: `${sequence1} → ${sequence2}`
                };
            }
        }

        // Check 5: Consecutive speak calls (anti-spam)
        if (name === 'speak') {
            const recentSpeakCalls = this.toolCallHistory.slice(-3).filter(c => c.name === 'speak');
            if (recentSpeakCalls.length >= 2) {
                return {
                    isLoop: true,
                    reason: 'Excessive consecutive speak calls',
                    pattern: 'speak spam detected'
                };
            }
        }

        // Check 6: After generation tools, only allow 'speak' - block everything else
        const FINAL_TOOLS = ['generate_image', 'generate_video'];
        const finalToolCalls = this.toolCallHistory.filter(c => FINAL_TOOLS.includes(c.name));
        if (finalToolCalls.length > 0) {
            // After a generation tool, only 'speak' is allowed to announce the result
            const ALLOWED_AFTER_GENERATION = ['speak'];
            if (!ALLOWED_AFTER_GENERATION.includes(name)) {
                return {
                    isLoop: true,
                    reason: `Task complete - '${name}' blocked after generation`,
                    pattern: `${finalToolCalls[0].name} → ${name} (blocked)`
                };
            }
        }

        // Check 7: Calling generate_image or generate_video twice (unless explicitly chaining)
        if (FINAL_TOOLS.includes(name)) {
            const previousGenerations = this.toolCallHistory.filter(c => FINAL_TOOLS.includes(c.name));
            if (previousGenerations.length >= 1) {
                return {
                    isLoop: true,
                    reason: `Multiple generation calls detected - task should be complete`,
                    pattern: `${previousGenerations.map(c => c.name).join(' → ')} → ${name}`
                };
            }
        }

        return { isLoop: false };
    }

    /**
     * Get call history for debugging
     */
    getHistory(): ToolCall[] {
        return [...this.toolCallHistory];
    }

    /**
     * Get recent pattern summary
     */
    getRecentPattern(): string {
        const recent = this.toolCallHistory.slice(-5);
        return recent.map(c => c.name).join(' → ');
    }

    /**
     * Clear history (use when starting new task)
     */
    clear(): void {
        this.toolCallHistory = [];
    }

    /**
     * Get statistics about tool usage
     */
    getStats(): { [toolName: string]: number } {
        const stats: { [toolName: string]: number } = {};
        this.toolCallHistory.forEach(call => {
            stats[call.name] = (stats[call.name] || 0) + 1;
        });
        return stats;
    }
}

/**
 * Cross-agent delegation loop detector
 * Tracks delegation chains to prevent A→B→A or A→B→C→A loops
 */
export class DelegationLoopDetector {
    private static delegationChains: Map<string, string[]> = new Map();

    /**
     * Record an agent delegation
     * @param traceId Unique trace ID for this execution chain
     * @param agentId Agent being delegated to
     * @returns LoopDetectionResult
     */
    static recordDelegation(traceId: string, agentId: string): LoopDetectionResult {
        const chain = this.delegationChains.get(traceId) || [];

        // Check for loop: same agent appearing twice in chain
        const agentOccurrences = chain.filter(id => id === agentId).length;

        if (agentOccurrences >= 1) {
            return {
                isLoop: true,
                reason: `Agent '${agentId}' already in delegation chain`,
                pattern: [...chain, agentId].join(' → ')
            };
        }

        // Check for excessive delegation depth
        const MAX_DELEGATION_DEPTH = 4;
        if (chain.length >= MAX_DELEGATION_DEPTH) {
            return {
                isLoop: true,
                reason: `Delegation chain too deep (${chain.length} levels)`,
                pattern: [...chain, agentId].join(' → ')
            };
        }

        // Record this delegation
        chain.push(agentId);
        this.delegationChains.set(traceId, chain);

        return { isLoop: false };
    }

    /**
     * Clean up completed delegation chain
     */
    static cleanup(traceId: string): void {
        this.delegationChains.delete(traceId);
    }

    /**
     * Get current delegation chain for debugging
     */
    static getChain(traceId: string): string[] {
        return this.delegationChains.get(traceId) || [];
    }
}
