import { ToolFunctionResult, ToolFunction, ToolFunctionArgs, AgentContext } from '../types';

/**
 * Standardized helper to create a success ToolFunctionResult
 */
export function toolSuccess(data: any, message?: string, metadata?: Record<string, unknown>): ToolFunctionResult {
    return {
        success: true,
        data,
        message,
        metadata: {
            timestamp: Date.now(),
            ...metadata
        }
    };
}

/**
 * Standardized helper to create an error ToolFunctionResult
 */
export function toolError(error: string, code?: string, metadata?: Record<string, unknown>): ToolFunctionResult {
    return {
        success: false,
        error,
        message: error,
        metadata: {
            timestamp: Date.now(),
            errorCode: code,
            ...metadata
        }
    };
}

/**
 * Wraps a tool function with consistent error handling and standardizes the return format.
 * This ensures that even if a tool throws an unhandled exception, it returns a valid ToolFunctionResult.
 */
export function wrapTool<TArgs extends ToolFunctionArgs>(
    toolName: string,
    fn: (args: TArgs, context?: AgentContext) => Promise<any>
): ToolFunction<TArgs> {
    return async (args: TArgs, context?: AgentContext): Promise<ToolFunctionResult> => {
        const startTime = Date.now();
        try {
            const result = await fn(args, context);

            // If the tool already returns a ToolFunctionResult, just ensure metadata is there
            if (result && typeof result === 'object' && 'success' in result) {
                return {
                    ...result,
                    metadata: {
                        ...result.metadata,
                        latencyMs: Date.now() - startTime,
                        toolName
                    }
                };
            }

            // Otherwise, wrap the raw result in a success object
            return toolSuccess(result, undefined, {
                latencyMs: Date.now() - startTime,
                toolName
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Tool:${toolName}] execution failed:`, error);

            return toolError(errorMessage, 'TOOL_EXECUTION_ERROR', {
                latencyMs: Date.now() - startTime,
                toolName,
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    };
}

/**
 * Validates tool arguments against a simple schema or logic before execution.
 */
export function validateArgs<TArgs extends ToolFunctionArgs>(
    args: TArgs,
    required: string[]
): string | null {
    for (const key of required) {
        if (args[key] === undefined || args[key] === null || args[key] === '') {
            return `Missing required parameter: ${key}`;
        }
    }
    return null;
}
