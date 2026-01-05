import {
    AgentConfig,
    ToolDefinition,
    AnyToolFunction,
    ValidAgentId,
    AgentCategory,
    ToolFunctionResult
} from '../types';

/**
 * A builder class for creating AgentConfig objects with a fluent API.
 * 
 * Example usage:
 * ```typescript
 * const myAgent = createAgent('marketing')
 *   .withName('Marketing Pro')
 *   .withSystemPrompt('You are a marketing expert...')
 *   .build();
 * ```
 */
export class AgentBuilder {
    private config: Partial<AgentConfig> = {
        tools: [],
        functions: {}
    };

    constructor(id?: ValidAgentId) {
        if (id) this.config.id = id;
    }

    /**
     * Sets the ID of the agent. Must be one of the ValidAgentId values.
     */
    withId(id: ValidAgentId): this {
        this.config.id = id;
        return this;
    }

    /**
     * Sets the display name of the agent.
     */
    withName(name: string): this {
        this.config.name = name;
        return this;
    }

    /**
     * Sets the description of the agent.
     */
    withDescription(description: string): this {
        this.config.description = description;
        return this;
    }

    /**
     * Sets the category of the agent (manager, department, specialist).
     */
    withCategory(category: AgentCategory): this {
        this.config.category = category;
        return this;
    }

    /**
     * Sets the UI color string for the agent.
     */
    withColor(color: string): this {
        this.config.color = color;
        return this;
    }

    /**
     * Sets the system prompt for the agent.
     */
    withSystemPrompt(prompt: string): this {
        this.config.systemPrompt = prompt;
        return this;
    }

    /**
     * Adds a tool to the agent's capability set.
     * @param definition The tool definition (schema)
     * @param implementation Optional implementation function. If provided, it will be registered in the functions map.
     */
    withTool(definition: ToolDefinition, implementation?: AnyToolFunction): this {
        if (!this.config.tools) {
            this.config.tools = [];
        }
        this.config.tools.push(definition);

        if (implementation && definition.functionDeclarations.length > 0) {
            const name = definition.functionDeclarations[0].name;
            if (!this.config.functions) {
                this.config.functions = {};
            }
            this.config.functions[name] = implementation;
        }
        return this;
    }

    /**
     * Builds and validates the agent configuration.
     * @throws Error if required fields (id, name, systemPrompt) are missing.
     */
    build(): AgentConfig {
        if (!this.config.id) throw new Error('Agent ID is required');
        if (!this.config.name) throw new Error('Agent name is required');
        if (!this.config.systemPrompt) throw new Error('Agent system prompt is required');

        // Defaults
        if (!this.config.description) this.config.description = `${this.config.name} Agent`;
        if (!this.config.category) this.config.category = 'specialist';
        if (!this.config.color) this.config.color = 'bg-gray-500';

        return this.config as AgentConfig;
    }
}

/**
 * Factory function to start building an agent.
 */
export const createAgent = (id: ValidAgentId) => new AgentBuilder(id);
