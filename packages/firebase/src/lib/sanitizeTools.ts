/**
 * Server-side tool schema sanitizer for Vertex AI / Gemini APIs.
 * Vertex AI rejects any function declaration where an ARRAY parameter lacks an items field.
 * This ensures legacy or packaged clients with unpatched schemas never trigger provider 400 rejections.
 */
export function sanitizeBackendTools(tools: unknown[]): unknown[] {
    if (!Array.isArray(tools)) return tools;
    return tools.map(tool => {
        if (!tool || typeof tool !== 'object') return tool;
        const toolRecord = { ...(tool as Record<string, unknown>) };
        if (Array.isArray(toolRecord.functionDeclarations)) {
            toolRecord.functionDeclarations = toolRecord.functionDeclarations.map(fn => {
                if (!fn || typeof fn !== 'object') return fn;
                const fnRecord = { ...(fn as Record<string, unknown>) };
                if (fnRecord.parameters && typeof fnRecord.parameters === 'object') {
                    fnRecord.parameters = sanitizeSchemaObject(fnRecord.parameters as Record<string, unknown>);
                }
                return fnRecord;
            });
        }
        return toolRecord;
    });
}

function sanitizeSchemaObject(schema: Record<string, unknown>): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') return schema;
    const cloned = { ...schema };
    const typeUpper = typeof cloned.type === 'string' ? cloned.type.toUpperCase() : '';
    if (typeUpper === 'ARRAY' && !cloned.items) {
        cloned.items = { type: 'OBJECT', description: 'Item record' };
    } else if (cloned.items && typeof cloned.items === 'object') {
        cloned.items = sanitizeSchemaObject(cloned.items as Record<string, unknown>);
    }
    if (cloned.properties && typeof cloned.properties === 'object') {
        const nested: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(cloned.properties as Record<string, unknown>)) {
            if (prop && typeof prop === 'object') {
                nested[key] = sanitizeSchemaObject(prop as Record<string, unknown>);
            } else {
                nested[key] = prop;
            }
        }
        cloned.properties = nested;
    }
    return cloned;
}
