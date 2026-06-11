import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalAgent } from './LegalAgent';

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/legal/prompt.md?raw', () => ({
    default: 'Mock Legal Prompt'
}));

describe('LegalAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('analyze_rights', () => {
        it('should return CLEAN status when there are no copyright hurdles', async () => {
            const args = {
                isCover: false,
                hasSamples: false,
                aiGenerated: false
            };
            const result = await LegalAgent.functions!.analyze_rights(args);
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('CLEAN');
            expect(result.data.message).toContain('No obvious copyright hurdles detected');
        });

        it('should return ACTION REQUIRED status and list mechanical license for covers', async () => {
            const args = {
                isCover: true,
                hasSamples: false,
                aiGenerated: false
            };
            const result = await LegalAgent.functions!.analyze_rights(args);
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('ACTION REQUIRED');
            expect(result.data.risks).toContain('Mechanical License Required (Publishing)');
            expect(result.data.advice).toContain('Since this is a cover');
        });

        it('should return ACTION REQUIRED status and list master use/sync licenses for samples', async () => {
            const args = {
                isCover: false,
                hasSamples: true,
                aiGenerated: false
            };
            const result = await LegalAgent.functions!.analyze_rights(args);
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('ACTION REQUIRED');
            expect(result.data.risks).toContain('Master Use License Required');
            expect(result.data.risks).toContain('Sync/Publishing License Required');
            expect(result.data.advice).toContain('clearance from both the record label');
        });

        it('should return ACTION REQUIRED status and list uncertainty for AI-generated works', async () => {
            const args = {
                isCover: false,
                hasSamples: false,
                aiGenerated: true
            };
            const result = await LegalAgent.functions!.analyze_rights(args);
            expect(result.success).toBe(true);
            expect(result.data.status).toBe('ACTION REQUIRED');
            expect(result.data.risks).toContain('Copyright Eligibility Uncertainty');
            expect(result.data.advice).toContain('generated works may not be copyrightable');
        });
    });
});
