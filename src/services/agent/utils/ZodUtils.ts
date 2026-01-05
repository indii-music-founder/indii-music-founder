import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FunctionDeclaration, ToolParameters, ToolParameterSchema, SchemaType } from '../types';

/**
 * Converts a Zod schema to the ToolParamters format expected by the AI SDK.
 * Handles recursion and type normalization.
 */
export function zodToToolParameters(schema: z.ZodType): ToolParameters {
    // Generate standard JSON schema
    const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as any;

    if (!jsonSchema || typeof jsonSchema !== 'object') {
        throw new Error('Failed to generate JSON schema from Zod type');
    }

    // If schema is just a ref or definition, we might need digging. 
    // But for typical z.object(), it returns an object with properties.

    const properties = jsonSchema.properties || {};
    const required = jsonSchema.required || [];

    return {
        type: 'OBJECT',
        properties: mapProperties(properties),
        required
    };
}

function mapProperties(props: Record<string, any>): Record<string, ToolParameterSchema> {
    const mapped: Record<string, ToolParameterSchema> = {};
    for (const [key, value] of Object.entries(props)) {
        mapped[key] = mapSchema(value);
    }
    return mapped;
}

function mapSchema(schema: any): ToolParameterSchema {
    let type = (schema.type || 'string').toUpperCase();

    // Map JSON schema types to AI SDK SchemaTypes
    // Spec: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
    if (type === 'CONST') type = 'STRING'; // Handle consts as string enums broadly

    // Handle array items
    let items: ToolParameterSchema | undefined;
    if (schema.items) {
        items = mapSchema(schema.items);
    }

    // Handle nested objects
    let properties: Record<string, ToolParameterSchema> | undefined;
    if (schema.properties) {
        properties = mapProperties(schema.properties);
    }

    return {
        type: type as SchemaType,
        description: schema.description,
        enum: schema.enum,
        items,
        properties,
        required: schema.required
    };
}

/**
 * createTool - Helper to define a tool with Zod validation.
 * Returns a FunctionDeclaration compatible with AgentConfig.
 */
export function createTool<T extends z.ZodType>(
    name: string,
    description: string,
    schema: T
): FunctionDeclaration {
    return {
        name,
        description,
        parameters: zodToToolParameters(schema),
        schema
    };
}
