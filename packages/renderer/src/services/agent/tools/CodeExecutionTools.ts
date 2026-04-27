import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

/**
 * CodeExecutionTools — Computer-as-a-Tool
 *
 * Enables agents to write and execute arbitrary Python scripts via the
 * Python sidecar. This is the Agent Zero "computer as a tool" capability
 * adapted for indiiOS — the agent writes its own code when no pre-built
 * tool exists for a task.
 *
 * SECURITY: Gated through ToolRiskRegistry as HIGH risk.
 * Requires explicit user approval via DigitalHandshake before execution.
 */


export const CodeExecutionTools = {
    /**
     * Execute a Python script via the sandboxed Python sidecar.
     *
     * The agent provides:
     * - language: currently only 'python' is supported
     * - code: the full Python script to execute
     * - description: a human-readable explanation of what the code does (shown to user for approval)
     *
     * The code runs in a subprocess with:
     * - 30-second timeout
     * - 256MB memory limit
     * - stdout + stderr captured
     *
     * On success, the agent may choose to store the script in UserMemory for reuse.
     */
    execute_code: wrapTool('execute_code', async (args: {
        language: 'python';
        code: string;
        description: string;
    }) => {
        try {
            const { language, code, description } = args;

            if (language !== 'python') {
                return toolError(
                    `Language "${language}" is not supported. Only "python" is currently available.`,
                    'CODE_UNSUPPORTED_LANG'
                );
            }

            if (!code || code.trim().length === 0) {
                return toolError('Code to execute is required.', 'CODE_EMPTY');
            }

            if (!description || description.trim().length === 0) {
                return toolError('A human-readable description of the code is required for approval.', 'CODE_NO_DESCRIPTION');
            }

            // The Python sidecar has been formally removed.
            // Return an immediate error explaining this to the agent.
            return toolError(
                `Python code execution is currently disabled in this environment (Sidecar removed). ` +
                `Please try to accomplish the task using native TypeScript tools or suggest an alternative approach.`,
                'CODE_EXECUTION_DISABLED'
            );
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return toolError('Code execution timed out after 35 seconds.', 'CODE_TIMEOUT');
            }
            logger.error('[CodeExecutionTools] execute_code error:', error);
            return toolError(`Failed to execute code: ${String(error)}`, 'CODE_ERROR');
        }
    }),
} satisfies Record<string, AnyToolFunction>;
