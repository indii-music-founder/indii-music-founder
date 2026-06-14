import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityAgent } from './SecurityAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock AutonomousIntelligence
vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    return {
        AutonomousIntelligence: {
            generateText: vi.fn().mockResolvedValue('{"isSafe": true, "issues": [], "redacted_text": "hello"}'),
            generateStructuredData: vi.fn().mockResolvedValue({}),
            handleError: vi.fn((e) => e)
        }
    };
});

describe('SecurityAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct ID and metadata', () => {
        expect(SecurityAgent.id).toBe('security');
        expect(SecurityAgent.name).toBe('Security Director');
        expect(SecurityAgent.category).toBe('department');
    });

    it('should expose the correct authorized tools', () => {
        expect(SecurityAgent.authorizedTools).toContain('audit_permissions');
        expect(SecurityAgent.authorizedTools).toContain('check_api_status');
        expect(SecurityAgent.authorizedTools).toContain('scan_content');
        expect(SecurityAgent.authorizedTools).toContain('rotate_credentials');
        expect(SecurityAgent.authorizedTools).toContain('browser_tool');
        expect(SecurityAgent.authorizedTools).toContain('credential_vault');
        expect(SecurityAgent.authorizedTools).toContain('scan_for_vulnerabilities');
    });

    it('should map the functions to correct tool declarations', () => {
        expect(SecurityAgent.functions!.scan_content).toBeDefined();
    });

    it('should execute scan_content successfully', async () => {
        const result = await SecurityAgent.functions!.scan_content({ text: 'safe text' });
        expect(result.success).toBe(true);
        expect(result.data?.scan_result).toBe('{"isSafe": true, "issues": [], "redacted_text": "hello"}');
        expect(AutonomousIntelligence.generateText).toHaveBeenCalled();
    });
});
