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
        it('should return disabled error for any valid code execution attempt', async () => {
            const result = await CodeExecutionTools.execute_code(
                {
                    language: 'python',
                    code: 'print("Hello, World!")',
                    description: 'Say hello'
                },
                null as any
            );

            expect(result.success).toBe(false);
            expect(result.message).toContain('Python code execution is currently disabled');
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
