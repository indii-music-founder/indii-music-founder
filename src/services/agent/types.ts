export interface ToolParameterProperties {
    [key: string]: {
        type: string;
        description: string;
        enum?: string[];
        items?: {
            type: string;
            properties?: ToolParameterProperties;
        };
        properties?: ToolParameterProperties;
    };
}

export interface ToolParameters {
    type: "OBJECT" | "object";
    properties: ToolParameterProperties;
    required?: string[];
}

export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: ToolParameters;
}

export interface ToolDefinition {
    functionDeclarations: FunctionDeclaration[];
}

export type AgentCategory = 'manager' | 'department' | 'specialist';

export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    color: string;
    category: AgentCategory;
    systemPrompt: string;
    tools: ToolDefinition[];
    // Map function names to their implementations
    functions?: Record<string, (args: any, context?: any) => Promise<any>>;
}
