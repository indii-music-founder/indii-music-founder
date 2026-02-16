import { describe, it, expect } from 'vitest';
import { TOOL_REGISTRY } from '../tools';

describe('🛡️ Tool Safety: Forbidden Registry Keys', () => {
    const DANGEROUS_TOOLS = [
        'exec_shell',
        'delete_file',
        'run_command',
        'system_exec'
    ];

    it('should NOT contain any dangerous tools in the production registry', () => {
        DANGEROUS_TOOLS.forEach(tool => {
            expect(TOOL_REGISTRY).not.toHaveProperty(tool);
        });
    });
});
