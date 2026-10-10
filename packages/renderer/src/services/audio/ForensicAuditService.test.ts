import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForensicAuditService } from './ForensicAuditService';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: vi.fn(),
    },
}));

vi.mock('@/core/logger/Logger', () => ({
    Logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('ForensicAuditService', () => {
    let service: ForensicAuditService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ForensicAuditService();
    });

    it('preScreenTechnical flags clipping and brickwall compression correctly', () => {
        const clean = service.preScreenTechnical({
            bpm: 120,
            key: 'C',
            scale: 'Major',
            duration: 180,
            loudness: -14,
            energy: 0.7,
            danceability: 0.8,
        });
        expect(clean.hasClippingRisk).toBe(false);
        expect(clean.hasDynamicRange).toBe(true);
        expect(clean.preScreenNote).toContain('No technical flags');

        const clipping = service.preScreenTechnical({
            bpm: 128,
            key: 'A',
            scale: 'Minor',
            duration: 210,
            loudness: 0.5, // > -1
            energy: 0.95,
            danceability: 0.9,
        });
        expect(clipping.hasClippingRisk).toBe(true);
        expect(clipping.hasDynamicRange).toBe(false);
        expect(clipping.preScreenNote).toContain('clipping risk');
    });

    it('auditTrack includes explicit instructions protecting human electronic music and loops from false AI flags', async () => {
        const mockFile = new File(['mock audio data'], 'test-track.mp3', { type: 'audio/mp3' });
        const mockResult = {
            certificationStatus: 'CERTIFIED',
            overallArtifactSeverity: 'clean',
            autonomousGenerationProbability: 0.05,
            findings: [],
            findingCounts: { severe: 0, moderate: 0, minor: 0 },
            auditorNote: 'Clean master, excellent dynamic range.',
            recommendation: 'clear_for_distribution',
        };

        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValueOnce(mockResult as any);

        const result = await service.auditTrack(mockFile, {
            bpm: 124,
            key: 'F',
            scale: 'Minor',
            duration: 320,
            loudness: -9,
            energy: 0.8,
            danceability: 0.85,
        });

        expect(result.certificationStatus).toBe('CERTIFIED');
        expect(AutonomousIntelligence.generateStructuredData).toHaveBeenCalledTimes(1);

        const callArgs = vi.mocked(AutonomousIntelligence.generateStructuredData).mock.calls[0]!;
        const promptText = (callArgs[0] as Array<{ text?: string }>)[0]?.text || '';

        // Must explicitly instruct model not to treat MIDI grid quantization or loops as generative AI
        expect(promptText).toContain('CRITICAL PRINCIPLE: Human-produced electronic music');
        expect(promptText).toContain('DO NOT treat grid quantization, loop boundaries, synthetic timbres, or transient cleanliness as evidence of generative AI');
        expect(promptText).toContain('Licensed Royalty-Free Loops & Samples');
        expect(promptText).toContain('Automated detector scores alone MUST NEVER issue an irreversible BLOCKED verdict against human artists');
    });
});
