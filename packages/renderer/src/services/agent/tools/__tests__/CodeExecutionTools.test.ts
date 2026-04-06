/**
 * Unit tests for CodeExecutionTools — Computer-as-a-Tool
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentContext } from '@/services/agent/types';

// Mock fetch for sidecar communication
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn(() => ({})),
        {
            getState: vi.fn(() => ({})),
            setState: vi.fn(),
            subscribe: vi.fn(() => () => { }),
        }
    ),
}));

// Must import AFTER mock is declared
const { CodeExecutionTools } = await import('@/services/agent/tools/CodeExecutionTools');

const mockContext: AgentContext = {
    userId: 'test-uid',
};

describe('CodeExecutionTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('execute_code', () => {
        it('should execute Python code successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    stdout: 'Hello, World!\n',
                    stderr: '',
                    exit_code: 0,
                    execution_time: 42,
                }),
            });

            const result = await CodeExecutionTools.execute_code(
                { code: 'print("Hello, World!")', language: 'python', description: 'Print hello world to stdout' },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.data?.stdout).toContain('Hello, World!');
            expect(result.data?.exit_code).toBe(0);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should handle execution failure (non-zero exit code)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    success: false,
                    stdout: '',
                    stderr: 'SyntaxError: invalid syntax',
                    exit_code: 1,
                    execution_time: 10,
                }),
            });

            const result = await CodeExecutionTools.execute_code(
                { code: 'def broken(', language: 'python', description: 'A broken script' },
                mockContext
            );

            // The tool reports failure for non-zero exit codes
            expect(result.success).toBe(false);
            expect(result.message).toContain('SyntaxError');
        });

        it('should handle sidecar unavailable', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const result = await CodeExecutionTools.execute_code(
                { code: 'print("test")', language: 'python', description: 'Test connectivity' },
                mockContext
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('Connection refused');
        });

        it('should reject empty code', async () => {
            const result = await CodeExecutionTools.execute_code(
                { code: '', language: 'python', description: 'Empty code test' },
                mockContext
            );

            expect(result.success).toBe(false);
        });

        it('should reject missing description', async () => {
            const result = await CodeExecutionTools.execute_code(
                { code: 'x = 1', language: 'python', description: '' },
                mockContext
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('description');
        });

        it('should reject code longer than 50KB', async () => {
            const longCode = 'x = 1\n'.repeat(10000); // ~60KB
            const result = await CodeExecutionTools.execute_code(
                { code: longCode, language: 'python', description: 'Oversized code test' },
                mockContext
            );

            expect(result.success).toBe(false);
        });
    });
});
