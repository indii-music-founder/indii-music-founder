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

const SIDECAR_BASE = import.meta.env.VITE_SIDECAR_URL || 'http://localhost:50080';

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

            // Call the Python sidecar code execution endpoint
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s client-side timeout

            const response = await fetch(`${SIDECAR_BASE}/api/execute-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language,
                    code,
                    description,
                    timeout: 30,
                    memory_limit_mb: 256,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                return toolError(
                    `Sidecar returned ${response.status}: ${errorText}`,
                    'CODE_SIDECAR_ERROR'
                );
            }

            const result = await response.json();

            if (result.success) {
                logger.info(`[CodeExecutionTools] Script executed successfully in ${result.execution_time}ms`);
                return toolSuccess(
                    {
                        stdout: result.stdout || '',
                        stderr: result.stderr || '',
                        exit_code: result.exit_code,
                        execution_time_ms: result.execution_time,
                    },
                    `Code executed successfully (${result.execution_time}ms). stdout: ${(result.stdout || '').substring(0, 500)}`
                );
            } else {
                return toolError(
                    `Script failed (exit code ${result.exit_code}): ${result.stderr || 'Unknown error'}`,
                    'CODE_EXECUTION_FAILED'
                );
            }
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return toolError('Code execution timed out after 35 seconds.', 'CODE_TIMEOUT');
            }
            logger.error('[CodeExecutionTools] execute_code error:', error);
            return toolError(`Failed to execute code: ${String(error)}`, 'CODE_ERROR');
        }
    }),
} satisfies Record<string, AnyToolFunction>;
