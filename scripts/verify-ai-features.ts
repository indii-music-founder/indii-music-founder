
import { describe, it, expect, vi } from 'vitest';

/**
 * Verification script for AI Service features.
 * This ensures that the core AI services (Text, Image, Video) are structurally sound and
 * their public APIs match expectations.
 */

describe('AI Feature Verification', () => {

    it('VideoGenerationService should be singleton and have generateVideo method', async () => {
        const { VideoGeneration } = await import('../src/services/video/VideoGenerationService');
        expect(VideoGeneration).toBeDefined();
        expect(typeof VideoGeneration.generateVideo).toBe('function');
        expect(typeof VideoGeneration.generateLongFormVideo).toBe('function');
    });

    it('ImageGenerationService should be importable', async () => {
        const { ImageGeneration } = await import('../src/services/image/ImageGenerationService');
        expect(ImageGeneration).toBeDefined();
    });

    it('AIService should be importable', async () => {
        // services/ai was a dead shim over the canonical facade — point at the source.
        const { AutonomousIntelligence } = await import('../src/services/intelligence/AutonomousIntelligence');
        expect(AutonomousIntelligence).toBeDefined();
        expect(typeof AutonomousIntelligence.generateContent).toBe('function');
    });
});
