/**
 * Diagnostic utility to detect mutations to the shared agent config.
 * Call this at the start of any suspected mutation point.
 * 
 * @param agent The agent configuration object to freeze.
 */
export function freezeBrandAgent(agent: any) {
    if (!agent || !agent.tools || !Array.isArray(agent.tools)) {
        console.warn('[FreezeDiagnostic] Invalid agent target provided to freezeBrandAgent.');
        return;
    }

    console.log(`[FreezeDiagnostic] Freezing Agent "${agent.id}" tools schema...`);

    // Check for existing corruption before freezing
    agent.tools.forEach((t: any) => {
        t.functionDeclarations?.forEach((fn: any) => {
            if (fn.name === 'analyze_brand_consistency') {
                const required = fn.parameters?.required;
                if (!required || required.length === 0) {
                    console.error(' [CRITICAL] BrandAgent schema is ALREADY CORRUPTED at freeze time!', {
                        name: fn.name,
                        required
                    });
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

    console.log(`[FreezeDiagnostic] Agent "${agent.id}" tools schema is now IMMUTABLE.`);
}
