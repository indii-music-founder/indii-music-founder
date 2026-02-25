import { BrandAgent } from './definitions/BrandAgent';

/**
 * Diagnostic utility to detect mutations to the shared agent config.
 * Call this at the start of any suspected mutation point.
 */
export function freezeBrandAgent() {
    console.log('[FreezeDiagnostic] Freezing BrandAgent tools schema...');

    // Deep freeze the tools array and its declarations
    Object.freeze(BrandAgent.tools);
    BrandAgent.tools.forEach(t => {
        Object.freeze(t);
        Object.freeze(t.functionDeclarations);
        t.functionDeclarations.forEach(fn => {
            Object.freeze(fn);
            if (fn.parameters) {
                Object.freeze(fn.parameters);
                if (fn.parameters.required) {
                    Object.freeze(fn.parameters.required);
                }
            }
        });
    });

    console.log('[FreezeDiagnostic] BrandAgent tools schema is now IMMUTABLE.');
}
