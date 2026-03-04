import { logger } from '@/utils/logger';
/**
 * Diagnostic utility to detect mutations to the shared agent config.
 * Call this at the start of any suspected mutation point.
 * 
 * @param agent The agent configuration object to freeze.
 */
export function freezeAgentConfig(agent: any) {
    if (!agent || !agent.tools || !Array.isArray(agent.tools)) {
        logger.warn(`[FreezeDiagnostic] Invalid agent target provided to freezeAgentConfig: ${agent?.id || 'unknown'}`);
        return;
    }

    logger.debug(`[FreezeDiagnostic] Freezing Agent "${agent.id}" tools schema...`);

    // Check for existing corruption before freezing
    agent.tools.forEach((t: any) => {
        t.functionDeclarations?.forEach((fn: any) => {
            if (fn.name === 'analyze_brand_consistency') {
                const required = fn.parameters?.required;
                if (!required || required.length === 0) {
                    logger.error(' [CRITICAL] BrandAgent schema is ALREADY CORRUPTED at freeze time!', {
                        agentId: agent.id,
                        toolName: fn.name,
                        required,
                        parameters: JSON.stringify(fn.parameters)
                    });
                    console.trace('Corruption Trace:');
                }
            }
        });
    });

    // Deep freeze the tools array and its declarations
    Object.freeze(agent.tools);
    agent.tools.forEach((t: any) => {
        Object.freeze(t);
        if (t.functionDeclarations) {
            Object.freeze(t.functionDeclarations);
            t.functionDeclarations.forEach((fn: any) => {
                Object.freeze(fn);
                if (fn.parameters) {
                    Object.freeze(fn.parameters);
                    if (fn.parameters.required) {
                        Object.freeze(fn.parameters.required);
                    }
                    if (fn.parameters.properties) {
                        Object.freeze(fn.parameters.properties);
                        Object.values(fn.parameters.properties).forEach(p => Object.freeze(p));
                    }
                }
            });
        }
    });

    // Finally freeze the root agent object
    Object.freeze(agent);

    logger.debug(`[FreezeDiagnostic] Agent "${agent.id}" tools schema is now IMMUTABLE.`);
}

/** @deprecated Use freezeAgentConfig */
export const freezeBrandAgent = freezeAgentConfig;
